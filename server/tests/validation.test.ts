import { describe, it, expect } from 'vitest';
import {
    SignInSchema,
    SignUpSchema,
    CreateRepositorySchema,
    RepositoryOperationSchema,
    WebhookParamsSchema
} from '@middlewares/validators';

describe('validation schemas', () => {
    describe('SignInSchema', () => {
        it('accepts a valid email + password', () => {
            expect(SignInSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
        });
        it('rejects an invalid email', () => {
            expect(SignInSchema.safeParse({ email: 'not-an-email', password: 'x' }).success).toBe(false);
        });
        it('strips unknown keys', () => {
            const r = SignInSchema.parse({ email: 'a@b.com', password: 'x', role: 'admin' } as any);
            expect((r as any).role).toBeUndefined();
        });
    });

    describe('SignUpSchema', () => {
        it('enforces username length bounds', () => {
            expect(SignUpSchema.safeParse({
                username: 'short', fullname: 'a full name', email: 'a@b.com',
                password: 'password1', passwordConfirm: 'password1'
            }).success).toBe(false);
        });
    });

    describe('CreateRepositorySchema', () => {
        it('requires name and url', () => {
            expect(CreateRepositorySchema.safeParse({ name: 'x' }).success).toBe(false);
            expect(CreateRepositorySchema.safeParse({ name: 'x', url: 'https://g/x' }).success).toBe(true);
        });
        it('coerces port to a number', () => {
            const r = CreateRepositorySchema.parse({ name: 'x', url: 'u', port: '3000' as any });
            expect(r.port).toBe(3000);
        });
    });

    describe('RepositoryOperationSchema', () => {
        it('accepts only known actions', () => {
            expect(RepositoryOperationSchema.safeParse({ action: 'restart' }).success).toBe(true);
            expect(RepositoryOperationSchema.safeParse({ action: 'rm -rf' }).success).toBe(false);
        });
    });

    describe('WebhookParamsSchema', () => {
        it('requires a valid 24-hex object id', () => {
            expect(WebhookParamsSchema.safeParse({ repositoryId: 'a'.repeat(24) }).success).toBe(true);
            expect(WebhookParamsSchema.safeParse({ repositoryId: 'nope' }).success).toBe(false);
        });
    });
});
