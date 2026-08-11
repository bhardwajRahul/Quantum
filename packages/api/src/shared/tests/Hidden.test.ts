import { describe, expect, it } from 'vitest';
import BaseModel from '@/shared/models/BaseModel';
import { Hidden } from '@/shared/models/Hidden';

class Credential extends BaseModel{
    name!: string;

    @Hidden()
    secret!: string;
}

class ApiCredential extends Credential{
    @Hidden()
    apiKey!: string;
}

const build = <T extends BaseModel>(Model: new () => T, fields: Record<string, unknown>): T => {
    return Object.assign(new Model(), fields);
};

describe('@Hidden serialization', () => {
    it('drops hidden fields from toJSON', () => {
        const credential = build(Credential, { name: 'github', secret: 'hunter2' });

        expect(credential.toJSON()).toEqual({ name: 'github' });
    });

    it('inherits hidden fields from parent classes', () => {
        const credential = build(ApiCredential, { name: 'github', secret: 'hunter2', apiKey: 'sk-123' });

        expect(credential.toJSON()).toEqual({ name: 'github' });
    });

    it('never leaks through JSON.stringify', () => {
        const credential = build(Credential, { name: 'github', secret: 'hunter2' });

        expect(JSON.stringify(credential)).not.toContain('hunter2');
    });
});
