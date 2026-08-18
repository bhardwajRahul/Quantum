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
