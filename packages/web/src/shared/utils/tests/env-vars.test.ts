import { describe, expect, it } from 'vitest';
import { addEnvVarRow, envVarRowsFrom, envVarRowsToMap, removeEnvVarRow, updateEnvVarRow } from '@/shared/utils/env-vars';

describe('env var rows', () => {
    it('round-trips a map through rows and drops blank keys', () => {
        const rows = envVarRowsFrom({ PORT: '9000', DEBUG: '' });

        expect(rows).toEqual([{ key: 'PORT', value: '9000' }, { key: 'DEBUG', value: '' }]);
        expect(envVarRowsToMap([...rows, { key: ' ', value: 'ignored' }])).toEqual({ PORT: '9000', DEBUG: '' });
    });

    it('adds at most one blank row, edits in place and removes by position', () => {
        const rows = addEnvVarRow(addEnvVarRow(envVarRowsFrom({ PORT: '9000' })));

        expect(rows).toEqual([{ key: '', value: '' }, { key: 'PORT', value: '9000' }]);
        expect(updateEnvVarRow(rows, 0, 'HOST', 'api')[0]).toEqual({ key: 'HOST', value: 'api' });
        expect(removeEnvVarRow(rows, 1)).toEqual([{ key: '', value: '' }]);
    });
});
