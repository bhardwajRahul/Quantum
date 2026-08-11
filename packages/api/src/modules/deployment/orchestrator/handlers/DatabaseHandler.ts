import Database from '@/modules/database/models/Database';
import { DatabaseStatus } from '@quantum/contracts/modules/database/domain';
import { JobType } from '@quantum/contracts/modules/deployment/domain';
import { logger } from '@/shared/utils/Logger';
import type Job from '../../models/Job';

export default class DatabaseHandler{
    async run(job: Job): Promise<void>{
        const databaseId = job.payload.databaseId as number | undefined;
        if(databaseId === undefined) throw new Error('Database::Job::MissingDatabaseId');

        const database = await Database.findOneBy({ id: databaseId });
        if(!database) throw new Error(`Database::Job::NotFound::${databaseId}`);

        switch(job.type){
            case JobType.DbProvision:
                await this.#provision(database);
                return;
            case JobType.DbBackup:
                await this.#backup(database);
                return;
            case JobType.DbRestore: {
                const backupId = job.payload.backupId as string | undefined;
                if(!backupId) throw new Error('Database::Job::Restore::MissingBackupId');
                await this.#restore(database, backupId);
                return;
            }
            default:
                throw new Error(`Database::Job::UnknownType::${job.type}`);
        }
    }

    async #provision(database: Database): Promise<void>{
        database.status = DatabaseStatus.Provisioning;
        await database.save();
        logger.info(`database ${database.id} provisioning requested (container backend deferred in this port)`, { scope: 'orchestrator.handler.database' });
    }

    async #backup(database: Database): Promise<void>{
        database.status = DatabaseStatus.BackingUp;
        await database.save();
        logger.info(`database ${database.id} backup requested (backup backend deferred in this port)`, { scope: 'orchestrator.handler.database' });
    }

    async #restore(database: Database, backupId: string): Promise<void>{
        database.status = DatabaseStatus.Provisioning;
        await database.save();
        logger.info(`database ${database.id} restore from ${backupId} requested (restore backend deferred in this port)`, { scope: 'orchestrator.handler.database' });
    }
}
