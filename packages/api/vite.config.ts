import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import typia from '@typia/unplugin/vite';

/**
 * Makes `@Body() body: CreateRoadmapInput` validate automatically: the DTO name is read
 * from the parameter annotation and a `typia.misc.createValidatePrune<T>()` call is
 * injected at build time, which the typia plugin (running next) compiles into a real
 * validator. Controllers never write the typia call themselves.
 */
const autoValidateBody = (): Plugin => ({
    name: 'quantum:auto-validate-body',
    enforce: 'pre',
    transform(code, id){
        if(!/src\/modules\/[^/?]+\/controllers\/[^/?]+\.ts(\?.*)?$/.test(id)) return null;
        if(!code.includes('@Body()')) return null;

        let out = code.replace(
            /@Body\(\)(\s+)(\w+):(\s*)(\w+)/g,
            '@Body(typia.misc.createValidatePrune<$4>())$1$2:$3$4'
        );
        // Imports hoist, so appending keeps the file's line numbers intact for stack traces.
        if(!/from 'typia'/.test(out)) out += "\nimport typia from 'typia';\n";
        return { code: out, map: null };
    }
});

export default defineConfig({
    plugins: [
        autoValidateBody(),
        typia({ tsconfig: './tsconfig.json', cache: true })
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
            '@tests': fileURLToPath(new URL('./tests', import.meta.url))
        }
    },
    test: {
        include: ['src/**/*.test.ts'],
        setupFiles: ['./tests/setup.ts'],
        hookTimeout: 60000
    }
});
