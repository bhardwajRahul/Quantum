import mongoose from 'mongoose';
import Domain from '@models/domain';
import AnalyticsEvent from '@models/analyticsEvent';
import AnalyticsRollup from '@models/analyticsRollup';
import { readNewLines } from '@services/analytics/tailState';
import { parseTraefikLine, parseUserAgent, extractUtm } from '@services/analytics/logParser';
import { lookupCountry } from '@services/analytics/geo';
import logger from '@utilities/logger';
import { IJob } from '@typings/models/job';

interface DomainRef{
    domain: mongoose.Types.ObjectId;
    organization: mongoose.Types.ObjectId;
}

const hourBucket = (date: Date): Date => {
    const d = new Date(date);
    d.setMinutes(0, 0, 0);
    return d;
};

interface RollupAcc{
    organization: mongoose.Types.ObjectId;
    domain: mongoose.Types.ObjectId;
    host: string;
    bucket: Date;
    pageviews: number;
    maps: {
        topPaths: Record<string, number>;
        topReferrers: Record<string, number>;
        countries: Record<string, number>;
        devices: Record<string, number>;
        browsers: Record<string, number>;
        os: Record<string, number>;
    };
    ips: Set<string>;
}

const bump = (obj: Record<string, number>, key: string | undefined | null) => {
    if(!key) return;

    const safe = String(key).replace(/[.$]/g, '_').slice(0, 180);
    if(!safe) return;
    obj[safe] = (obj[safe] || 0) + 1;
};

export const runAnalyticsSample = async (_job: IJob): Promise<void> => {
    const logPath = process.env.TRAEFIK_ACCESS_LOG || '/logs/access.log';

    let lines: string[];
    try{
        lines = await readNewLines(logPath);
    }catch(error){
        logger.warn('@services/orchestrator/handlers/analyticsHandler.ts (readNewLines): ' + error);
        return;
    }
    if(!lines.length) return;

    const domainCache = new Map<string, DomainRef | null>();
    const resolveDomain = async (host: string): Promise<DomainRef | null> => {
        if(domainCache.has(host)) return domainCache.get(host) as DomainRef | null;
        let ref: DomainRef | null = null;
        try{
            const doc: any = await Domain.findOne({ host }).select('organization').lean();
            if(doc && doc.organization){
                ref = { domain: doc._id, organization: doc.organization };
            }
        }catch(error){
            logger.warn(`@services/orchestrator/handlers/analyticsHandler.ts (resolveDomain:${host}): ` + error);
        }
        domainCache.set(host, ref);
        return ref;
    };

    const events: any[] = [];
    const rollups = new Map<string, RollupAcc>();

    for(const line of lines){
        try{
            let obj: any;
            try{
                obj = JSON.parse(line);
            }catch{
                continue;
            }

            const hit = parseTraefikLine(obj);
            if(!hit) continue;

            const ref = await resolveDomain(hit.host);
            if(!ref) continue;

            const ua = parseUserAgent(hit.userAgent);
            const utm = extractUtm(hit.path + (hit.query ? '?' + hit.query : ''));
            const country = lookupCountry(hit.clientIp);
            const bucket = hourBucket(hit.ts);

            events.push({
                organization: ref.organization,
                domain: ref.domain,
                host: hit.host,
                path: hit.path,
                status: hit.status,
                method: hit.method,
                referrer: hit.referrer,
                device: ua.device,
                browser: ua.browser,
                os: ua.os,
                country: country || undefined,
                utmSource: utm.source || undefined,
                utmMedium: utm.medium || undefined,
                utmCampaign: utm.campaign || undefined,
                durationMs: hit.durationMs,
                ts: hit.ts
            });

            const key = `${String(ref.domain)}|${bucket.getTime()}`;
            let acc = rollups.get(key);
            if(!acc){
                acc = {
                    organization: ref.organization,
                    domain: ref.domain,
                    host: hit.host,
                    bucket,
                    pageviews: 0,
                    maps: { topPaths: {}, topReferrers: {}, countries: {}, devices: {}, browsers: {}, os: {} },
                    ips: new Set<string>()
                };
                rollups.set(key, acc);
            }
            acc.pageviews++;
            bump(acc.maps.topPaths, hit.path);
            if(hit.referrer) bump(acc.maps.topReferrers, hit.referrer);
            if(country) bump(acc.maps.countries, country);
            bump(acc.maps.devices, ua.device);
            if(ua.browser) bump(acc.maps.browsers, ua.browser);
            if(ua.os) bump(acc.maps.os, ua.os);
            if(hit.clientIp) acc.ips.add(hit.clientIp);
        }catch(error){

            logger.warn('@services/orchestrator/handlers/analyticsHandler.ts (line): ' + error);
        }
    }

    if(events.length){
        try{
            await AnalyticsEvent.insertMany(events, { ordered: false });
        }catch(error){
            logger.warn('@services/orchestrator/handlers/analyticsHandler.ts (insertMany): ' + error);
        }
    }

    for(const acc of rollups.values()){
        try{
            const inc: Record<string, number> = {
                pageviews: acc.pageviews,

                visitors: acc.ips.size
            };
            for(const [field, counts] of Object.entries(acc.maps)){
                for(const [k, v] of Object.entries(counts)){
                    inc[`${field}.${k}`] = v;
                }
            }
            await AnalyticsRollup.updateOne(
                { domain: acc.domain, bucket: acc.bucket },
                {
                    $inc: inc,
                    $setOnInsert: { organization: acc.organization, host: acc.host }
                },
                { upsert: true }
            );
        }catch(error){
            logger.warn('@services/orchestrator/handlers/analyticsHandler.ts (rollup upsert): ' + error);
        }
    }
};

export default runAnalyticsSample;
