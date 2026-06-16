/***
 * Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
 * Licensed under the MIT license. See LICENSE file in the project root
 * for full license information.
****/

/**
 * Runnable entrypoint for the builtin template seed. Connects to Mongo, runs the
 * idempotent runTemplateSeed, prints the result, and exits. Run inside the server
 * container (where the catalog asset + Mongo connection live):
 *   docker exec quantum-server sh -c 'cd /app && node --import tsx scripts/runSeed.ts'
 * or via npm: `npm run seed:templates`.
 */
import mongoose from 'mongoose';
import mongoConnector from '@utilities/mongoConnector';
import runTemplateSeed from './seedTemplates';
import logger from '@utilities/logger';

(async () => {
    await mongoConnector();
    const result = await runTemplateSeed();
    logger.info(`@scripts/runSeed.ts: template seed done — ${JSON.stringify(result)}`);
    await mongoose.connection.close();
    process.exit(0);
})().catch((error) => {
    logger.error('@scripts/runSeed.ts: seed failed: ' + (error as Error).stack);
    process.exit(1);
});
