import { beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer;

export const setupMemoryMongo = (): void => {
    beforeAll(async () => {

        process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'a'.repeat(64);
        process.env.ENCRYPTION_IV = process.env.ENCRYPTION_IV || 'b'.repeat(32);
        mongod = await MongoMemoryServer.create();
        await mongoose.connect(mongod.getUri());
    }, 120000);

    afterEach(async () => {
        const { collections } = mongoose.connection;
        for(const key of Object.keys(collections)){
            await collections[key].deleteMany({});
        }
    });

    afterAll(async () => {
        await mongoose.disconnect();
        if(mongod) await mongod.stop();
    });
};
