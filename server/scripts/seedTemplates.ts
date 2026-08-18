import fs from 'fs';
import path from 'path';
import { slug } from '@utilities/slug';
import Template from '@models/template';
import { parseCompose } from '@services/templates/compose';
import logger from '@utilities/logger';

const BUILTIN_VERSION = '1.0.0';

const inferCategory = (name: string, image: string): string => {
    const haystack = `${name} ${image}`.toLowerCase();
    if(/postgres|mysql|mariadb|mongo|redis|postgis/.test(haystack)) return 'database';
    if(/nginx|traefik|proxy/.test(haystack)) return 'networking';
    if(/wordpress|ghost|directus|owncloud/.test(haystack)) return 'cms';
    if(/n8n|activepieces|tooljet|appsmith|automation/.test(haystack)) return 'automation';
    if(/code-server|kali|ubuntu|alpine|debian/.test(haystack)) return 'development';
    if(/ollama|kuma|homarr|mosquitto/.test(haystack)) return 'tools';
    return 'other';
};

const CATALOG_PATH = path.resolve(__dirname, '../assets/one-click-services.json');

export interface SeedResult{
    created: number;
    updated: number;
    skipped: number;
}

export const runTemplateSeed = async (): Promise<SeedResult> => {
    const raw = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8')) as any[];

    const result: SeedResult = { created: 0, updated: 0, skipped: 0 };

    for(const entry of raw){
        try{
            const spec = parseCompose(entry);
            const templateSlug = slug(entry.name);
            const primaryImage = entry.image ? `${entry.image.name}` : '';
            const category = inferCategory(entry.name, primaryImage);

            const update = {
                name: entry.name,
                slug: templateSlug,
                version: BUILTIN_VERSION,
                category,
                description: entry.description || '',
                website: entry.website || '',
                source: 'builtin' as const,
                organization: null,
                spec,
                inputsSchema: [],
                isLatest: true
            };

            const existing = await Template.findOne({ slug: templateSlug, version: BUILTIN_VERSION });
            if(existing){
                await Template.updateOne({ _id: existing._id }, update);
                result.updated++;
            }else{
                await Template.create(update);
                result.created++;
            }
        }catch(error){

            logger.warn(`@scripts/seedTemplates.ts (runTemplateSeed): skipped "${entry?.name}": ${error}`);
            result.skipped++;
        }
    }

    logger.info(`@scripts/seedTemplates.ts (runTemplateSeed): created ${result.created}, updated ${result.updated}, skipped ${result.skipped}.`);
    return result;
};

export default runTemplateSeed;
