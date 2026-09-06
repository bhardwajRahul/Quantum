import { DataSource } from 'typeorm';
import { config } from '@/shared/config';
import { ResourceChangeSubscriber } from '@/core/models/ResourceChangeSubscriber';

export const createDataSource = (entities: Function[]): DataSource => {
    return new DataSource({
        type: 'postgres',
        url: config.databaseUrl,
        schema: config.databaseSchema,
        synchronize: true,
        entities,
        subscribers: [ResourceChangeSubscriber]
    });
};
