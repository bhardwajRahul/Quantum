import { logger } from '@/shared/utils/Logger';

export default class AnalyticsHandler{
    async run(): Promise<void>{
        const logPath = process.env.TRAEFIK_ACCESS_LOG ?? '/logs/access.log';
        logger.info(
            `analytics sample requested (traefik log=${logPath}); access-log ingestion deferred ` +
            '(legacy analytics logParser/geo/tailState services not ported in this change)',
            { scope: 'orchestrator.handler.analytics' }
        );
    }
}
