import { defineConfig } from 'vitest/config';
import path from 'path';

const alias = (name: string) => path.resolve(__dirname, name);

export default defineConfig({
    test: {
        environment: 'node',
        include: ['tests/**/*.test.ts'],
        globals: true,
        setupFiles: ['./tests/setup.ts']
    },
    resolve: {
        alias: {
            '@typings': alias('typings'),
            '@tests': alias('tests'),
            '@models': alias('models'),
            '@utilities': alias('utilities'),
            '@routes': alias('routes'),
            '@config': alias('config'),
            '@controllers': alias('controllers'),
            '@cli': alias('cli'),
            '@middlewares': alias('middlewares'),
            '@services': alias('services')
        }
    }
});
