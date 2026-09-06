import { describe, expect, it } from 'vitest';
import { useApp, flushEvents } from '@tests/harness';
import { request, expectError } from '@tests/request';
import { seed, TEST_PASSWORD } from '@tests/Seed';
import { authRoutes } from '@quantum/contracts/modules/auth/routes';
import { UserRole } from '@quantum/contracts/modules/user/domain';
import User from '@/modules/user/models/User';
import Organization from '@/modules/organization/models/Organization';
import Project from '@/modules/project/models/Project';
import JWTService from '@/modules/auth/services/JWTService';
import type { SignUpInput } from '@quantum/contracts/modules/auth/http';

const ctx = useApp();

const signUpInput = (n: number): SignUpInput => ({
    username: `brandnew${n}user`,
    fullname: `Brand New User ${n}`,
    email: `brandnew${n}@quantum.test`,
    password: TEST_PASSWORD,
    passwordConfirm: TEST_PASSWORD
});

describe('auth', () => {
    it('signs up a new user and returns a session', async () => {
        const res = await request(ctx.app, authRoutes.signUp, { body: signUpInput(1) });

        expect(res.status).toBe(201);
        const session = res.data();
        expect(session.token).toBeTruthy();
        expect(session.user.email).toBe('brandnew1@quantum.test');
        expect(session.user.role).toBe(UserRole.User);
        expect(session.user).not.toHaveProperty('passwordHash');

        await flushEvents();

        const updated = await User.findOneBy({ id: session.user.id });
        expect(updated?.defaultOrganizationId).not.toBeNull();

        const organization = await Organization.findOneBy({ id: updated!.defaultOrganizationId! });
        expect(organization?.name).toBe('Default');

        const project = await Project.findOneBy({ organizationId: organization!.id });
        expect(project).toMatchObject({ name: 'Default Project', isDefault: true });
    });

    it('rejects sign-up with mismatched passwords', async () => {
        const res = await request(ctx.app, authRoutes.signUp, {
            body: { ...signUpInput(2), passwordConfirm: 'different123' }
        });

        expectError(res, 400, 'Authentication::PasswordConfirmMismatch');
    });

    it('rejects sign-up with an already registered email', async () => {
        await request(ctx.app, authRoutes.signUp, { body: signUpInput(3) });
        const res = await request(ctx.app, authRoutes.signUp, {
            body: { ...signUpInput(3), username: 'anotherusr0003' }
        });

        expectError(res, 409, 'User::EmailAlreadyRegistered');
    });

    it('rejects sign-up with invalid body', async () => {
        const res = await request(ctx.app, authRoutes.signUp, {
            body: { username: 'short', fullname: 'x', email: 'nope', password: '1', passwordConfirm: '2' }
        });

        expectError(res, 400, 'Request::ValidationFailed');
        expect(res.json().errors).toBeTruthy();
    });

    it('signs in with correct credentials', async () => {
        const user = await seed.user();

        const res = await request(ctx.app, authRoutes.signIn, {
            body: { email: user.email, password: TEST_PASSWORD }
        });

        expect(res.status).toBe(200);
        expect(res.data().user.id).toBe(user.id);

        await flushEvents();
    });

    it('rejects sign-in with a wrong password', async () => {
        const user = await seed.user();

        const res = await request(ctx.app, authRoutes.signIn, {
            body: { email: user.email, password: 'wrongpassword1' }
        });

        expectError(res, 401, 'Authentication::EmailOrPasswordIncorrect');
    });

    it('returns the own account on /auth/me', async () => {
        const user = await seed.user();

        const res = await request(ctx.app, authRoutes.me, { as: user.id });

        expect(res.status).toBe(200);
        expect(res.data().email).toBe(user.email);
    });

    it('rejects /auth/me without a token', async () => {
        const res = await request(ctx.app, authRoutes.me);

        expectError(res, 401, 'Authentication::Unauthorized');
    });

    it('rejects a token signed for a deleted user', async () => {
        const user = await seed.user();
        await (await User.findOneBy({ id: user.id }))?.remove();

        const res = await request(ctx.app, authRoutes.me, { as: user.id });

        expectError(res, 401, 'Authentication::InvalidToken');
        await flushEvents();
    });

    it('updates the password and invalidates previous tokens', async () => {
        const user = await seed.user();
        const previousToken = new JWTService().sign(user.id);

        const res = await request(ctx.app, authRoutes.updatePassword, {
            as: user.id,
            body: { passwordCurrent: TEST_PASSWORD, password: 'newpassword12', passwordConfirm: 'newpassword12' }
        });

        expect(res.status).toBe(200);
        const session = res.data();
        expect(session.token).toBeTruthy();

        const stale = await ctx.app.inject({
            method: 'GET',
            url: '/auth/me',
            headers: { authorization: `Bearer ${previousToken}` }
        });
        expect(stale.statusCode).toBe(401);
        expect(stale.json()).toMatchObject({ error: 'Authentication::InvalidToken' });

        await flushEvents();
    });

    it('rejects a password update with a wrong current password', async () => {
        const user = await seed.user();

        const res = await request(ctx.app, authRoutes.updatePassword, {
            as: user.id,
            body: { passwordCurrent: 'wrongpassword1', password: 'newpassword12', passwordConfirm: 'newpassword12' }
        });

        expectError(res, 400, 'Authentication::PasswordCurrentIncorrect');
    });

    it('rejects a password update that reuses the current password', async () => {
        const user = await seed.user();

        const res = await request(ctx.app, authRoutes.updatePassword, {
            as: user.id,
            body: { passwordCurrent: TEST_PASSWORD, password: TEST_PASSWORD, passwordConfirm: TEST_PASSWORD }
        });

        expectError(res, 400, 'Authentication::PasswordsAreSame');
    });
});

describe('email availability', () => {
    it('reports exists:true for a registered email', async () => {
        const user = await seed.user();

        const res = await request(ctx.app, authRoutes.checkEmail, { query: { email: user.email } });

        expect(res.status).toBe(200);
        expect(res.data()).toMatchObject({ exists: true });
    });

    it('reports exists:false for an unregistered email', async () => {
        const res = await request(ctx.app, authRoutes.checkEmail, { query: { email: 'ghost@quantum.test' } });

        expect(res.status).toBe(200);
        expect(res.data()).toMatchObject({ exists: false });
    });

    it('rejects a missing email', async () => {
        const res = await request(ctx.app, authRoutes.checkEmail);

        expectError(res, 400, 'Request::ValidationFailed');
    });
});
