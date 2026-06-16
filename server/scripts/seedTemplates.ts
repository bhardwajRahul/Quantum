/***
 * Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
 * Licensed under the MIT license. See LICENSE file in the project root
 * for full license information.
 *
 * =+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 *
 * For related information - https://github.com/rodyherrera/Quantum/
 *
 * All your applications, just in one place.
 *
 * =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
****/

import fs from 'fs';
import path from 'path';
import slugify from 'slugify';
import Template from '@models/template';
import { parseCompose } from '@services/templates/compose';
import logger from '@utilities/logger';

/**
 * Idempotent builtin-template seed. Imports the existing one-click catalog
 * (client/src/assets/one-click-services.json — the legacy parent/husband shape),
 * normalizes each entry through compose.parseCompose into a validated TemplateSpec,
 * and upserts a builtin Template (source 'builtin', organization null, version
 * pinned). Re-running only updates the spec/metadata of an existing {slug,version}
 * — never duplicates.
 *
 * NOT wired into bootstrap by design — the maintainer calls runTemplateSeed()
 * explicitly (e.g. from a migration/boot step).
 */

const BUILTIN_VERSION = '1.0.0';

// A coarse category guess from the service image/name, so the catalog groups
// sensibly without hand-annotating each legacy entry.
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

// The catalog is vendored into the server package (server/assets) so it ships
// inside the container, which does not include client/. __dirname is server/scripts.
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
            const slug = slugify(entry.name, { lower: true, strict: true });
            const primaryImage = entry.image ? `${entry.image.name}` : '';
            const category = inferCategory(entry.name, primaryImage);

            const update = {
                name: entry.name,
                slug,
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

            // Upsert keyed by the unique {slug,version} so re-seeding is idempotent.
            const existing = await Template.findOne({ slug, version: BUILTIN_VERSION });
            if(existing){
                await Template.updateOne({ _id: existing._id }, update);
                result.updated++;
            }else{
                await Template.create(update);
                result.created++;
            }
        }catch(error){
            // A single malformed/unsafe entry must not abort the whole seed.
            logger.warn(`@scripts/seedTemplates.ts (runTemplateSeed): skipped "${entry?.name}": ${error}`);
            result.skipped++;
        }
    }

    logger.info(`@scripts/seedTemplates.ts (runTemplateSeed): created ${result.created}, updated ${result.updated}, skipped ${result.skipped}.`);
    return result;
};

export default runTemplateSeed;
