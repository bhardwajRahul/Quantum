import { describe, expect, it } from 'vitest';
import { shellSplit } from '../orchestrator/shellSplit';

describe('shellSplit', () => {
    it('splits on whitespace and honours quotes and escapes the way a shell would', () => {
        expect(shellSplit('--default-authentication-plugin=mysql_native_password')).toEqual(['--default-authentication-plugin=mysql_native_password']);
        expect(shellSplit('redis-server --appendonly yes')).toEqual(['redis-server', '--appendonly', 'yes']);
        expect(shellSplit(`nginx -g 'daemon off;'`)).toEqual(['nginx', '-g', 'daemon off;']);
        expect(shellSplit(`sh -c "echo \\"hi there\\""`)).toEqual(['sh', '-c', 'echo "hi there"']);
        expect(shellSplit(`printf 'it'\\''s' ""`)).toEqual(['printf', "it's", '']);
        expect(shellSplit('  ')).toEqual([]);
    });
});
