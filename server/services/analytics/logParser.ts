import { UAParser } from 'ua-parser-js';

export interface NormalizedHit{
    host: string;
    path: string;
    query: string;
    status: number;
    method: string;
    referrer: string;
    userAgent: string;
    clientIp: string;
    durationMs: number;
    ts: Date;
}

export interface ParsedUserAgent{
    device: 'mobile' | 'desktop' | 'tablet' | 'bot';
    browser: string;
    os: string;
}

export interface ParsedUtm{
    source: string;
    medium: string;
    campaign: string;
}

export const splitPath = (pathWithQuery: string): { pathname: string; query: string } => {
    const raw = pathWithQuery || '/';
    const qIndex = raw.indexOf('?');
    if(qIndex === -1) return { pathname: raw, query: '' };
    return { pathname: raw.slice(0, qIndex) || '/', query: raw.slice(qIndex + 1) };
};

export const parseTraefikLine = (obj: any): NormalizedHit | null => {
    if(!obj || typeof obj !== 'object') return null;
    const host = obj.RequestHost;
    if(!host || typeof host !== 'string') return null;

    const rawPath = typeof obj.RequestPath === 'string' ? obj.RequestPath : '/';
    const { pathname, query } = splitPath(rawPath);

    const durationNs = Number(obj.Duration) || 0;
    const ts = obj.StartUTC ? new Date(obj.StartUTC) : new Date();

    return {
        host: String(host).toLowerCase(),
        path: pathname,
        query,
        status: Number(obj.DownstreamStatus) || 0,
        method: typeof obj.RequestMethod === 'string' ? obj.RequestMethod : '',
        referrer: typeof obj['request_Referer'] === 'string' ? obj['request_Referer'] : '',
        userAgent: typeof obj['request_User-Agent'] === 'string' ? obj['request_User-Agent'] : '',
        clientIp: typeof obj.ClientHost === 'string' ? obj.ClientHost : '',
        durationMs: durationNs > 0 ? Math.round(durationNs / 1e6) : 0,
        ts: isNaN(ts.getTime()) ? new Date() : ts
    };
};

export const parseUserAgent = (ua: string): ParsedUserAgent => {
    if(!ua || !ua.trim()){
        return { device: 'bot', browser: '', os: '' };
    }
    const result = new UAParser(ua).getResult();
    const browser = result.browser?.name || '';
    const os = result.os?.name || '';

    const isCrawler = result.browser?.type === 'crawler'
        || /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless/i.test(ua);
    if(isCrawler){
        return { device: 'bot', browser, os };
    }

    const type = result.device?.type;
    let device: ParsedUserAgent['device'];
    if(type === 'mobile') device = 'mobile';
    else if(type === 'tablet') device = 'tablet';
    else device = 'desktop';
    return { device, browser, os };
};

export const extractUtm = (pathWithQuery: string): ParsedUtm => {
    const { query } = splitPath(pathWithQuery || '');
    if(!query) return { source: '', medium: '', campaign: '' };
    const params = new URLSearchParams(query);
    return {
        source: params.get('utm_source') || '',
        medium: params.get('utm_medium') || '',
        campaign: params.get('utm_campaign') || ''
    };
};

export default {
    parseTraefikLine,
    parseUserAgent,
    extractUtm,
    splitPath
};
