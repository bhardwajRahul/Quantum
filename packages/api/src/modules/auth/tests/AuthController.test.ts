import { describe, expect, it } from 'vitest';
import { useApp, flushEvents } from '@tests/harness';
import { request, expectError } from '@tests/request';
import { seed, TEST_PASSWORD } from '@tests/Seed';
import { authRoutes } from '@quantum/contracts/modules/auth/routes';
import { userRoutes } from '@quantum/contracts/modules/user/routes';
import { UserRole } from '@quantum/contracts/modules/user/domain';
import User from '@/modules/user/models/User';
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
        await request(ctx.app, authRoutes.deleteMe, { as: user.id });

        const res = await request(ctx.app, authRoutes.me, { as: user.id });

        expectError(res, 401, 'Authentication::InvalidToken');
        await flushEvents();
    });

    it('updates the own account', async () => {
        const user = await seed.user();

        const res = await request(ctx.app, authRoutes.updateMe, {
            as: user.id,
            body: { fullname: 'Renamed Fully Name' }
        });

        expect(res.status).toBe(200);
        expect(res.data().fullname).toBe('Renamed Fully Name');
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

    it('signs out an authenticated user', async () => {
        const user = await seed.user();

        const res = await request(ctx.app, authRoutes.signOut, { as: user.id });

        expect(res.status).toBe(204);
    });
});

describe('users admin', () => {
    it('lists users for a platform admin', async () => {
        const admin = await seed.user(UserRole.Admin);
        await seed.user();

        const res = await request(ctx.app, userRoutes.list, { as: admin.id });

        expect(res.status).toBe(200);
        expect(res.data().length).toBeGreaterThanOrEqual(2);
    });

    it('forbids the user list for a regular user', async () => {
        const user = await seed.user();

        const res = await request(ctx.app, userRoutes.list, { as: user.id });

        expectError(res, 403, 'Authentication::Forbidden');
    });

    it('creates and deletes a user as a platform admin', async () => {
        const admin = await seed.user(UserRole.Admin);

        const created = await request(ctx.app, userRoutes.create, {
            as: admin.id,
            body: {
                username: 'createduser01',
                fullname: 'Created User One',
                email: 'created@quantum.test',
                password: TEST_PASSWORD,
                role: UserRole.User
            }
        });

        expect(created.status).toBe(201);
        const userId = created.data().id;
        expect(await User.findOneBy({ id: userId })).toBeTruthy();

        const removed = await request(ctx.app, userRoutes.remove, { as: admin.id, params: { id: userId } });
        expect(removed.status).toBe(204);
        expect(await User.findOneBy({ id: userId })).toBeNull();
    });
});
