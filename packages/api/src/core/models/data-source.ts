import { DataSource } from 'typeorm';
import { config } from '@/shared/config';

export const createDataSource = (entities: Function[]): DataSource => {
    return new DataSource({
        type: 'postgres',
        url: config.databaseUrl,
        schema: config.databaseSchema,
        synchronize: true,
        entities
    });
};
