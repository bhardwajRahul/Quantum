import User from '@/modules/user/models/User';
import { AuthError } from '../contracts/domain/errors';
import { UserError } from '@/modules/user/contracts/domain/errors';
import { eventBus } from '@/shared/events/EventBus';
import { config } from '@/shared/config';
import { isUniqueViolation } from '@/shared/models/isUniqueViolation';
import JWTService from './JWTService';
import PasswordService from './PasswordService';
import ValidationError from '@/shared/errors/ValidationError';
import type { EmailAvailability, Session } from '@quantum/contracts/modules/auth/domain';
import type { SignInInput, SignUpInput, UpdatePasswordInput } from '@quantum/contracts/modules/auth/http';

export default class AuthService{
    #jwt = new JWTService();
    #password = new PasswordService();

    async checkEmail(email: string | undefined): Promise<EmailAvailability>{
        if(!email) throw new ValidationError({ email: 'Required' });

        const user = await User.findOneBy({ email: email.toLowerCase() });
        return { exists: user !== null };
    }

    async signIn(input: SignInInput, clientIp: string): Promise<Session>{
        const user = await User.findOneBy({ email: input.email.toLowerCase() });
        if(!user || !(await this.#password.verify(input.password, user.passwordHash))){
            throw AuthError.EmailOrPasswordIncorrect();
        }

        eventBus.emit('notification.send', {
            to: user.email,
            subject: 'Someone is logged into your account.',
            html: `<p>A sign-in from "${clientIp}" was detected. If this was not you, change your password.</p>`
        });

        return this.#session(user);
    }

    async signUp(input: SignUpInput): Promise<Session>{
        if(config.registrationDisabled) throw AuthError.Disabled();
        if(input.password !== input.passwordConfirm) throw AuthError.PasswordConfirmMismatch();
        if(await User.findOneBy({ email: input.email.toLowerCase() })) throw UserError.EmailAlreadyRegistered();
        if(await User.findOneBy({ username: this.#normalizeUsername(input.username) })){
            throw UserError.UsernameAlreadyTaken();
        }

        const user = await this.#insertUser(input);

        eventBus.emit('user.created', {
            userId: user.id,
            username: user.username,
            email: user.email
        });

        eventBus.emit('notification.send', {
            to: user.email,
            subject: `Hello @${user.username}!`,
            html: '<p>Your account has been created successfully.</p>'
        });

        return this.#session(user);
    }

    async getMe(userId: number): Promise<User>{
        const user = await User.findOneBy({ id: userId });
        if(!user) throw AuthError.UserNotFound();
        return user;
    }

    async updatePassword(userId: number, input: UpdatePasswordInput): Promise<Session>{
        const user = await this.getMe(userId);

        if(!(await this.#password.verify(input.passwordCurrent, user.passwordHash))){
            throw AuthError.PasswordCurrentIncorrect();
        }
        if(input.password !== input.passwordConfirm) throw AuthError.PasswordConfirmMismatch();
        if(await this.#password.verify(input.password, user.passwordHash)){
            throw AuthError.PasswordsAreSame();
        }

        user.passwordHash = await this.#password.hash(input.password);
        user.passwordChangedAt = new Date();
        await user.save();

        eventBus.emit('notification.send', {
            to: user.email,
            subject: 'Password updated successfully.',
            html: '<p>Your password has been changed. You may need to sign in again on other devices.</p>'
        });

        return this.#session(user);
    }

    #session(user: User): Session{
        return {
            token: this.#jwt.sign(user.id),
            user
        };
    }

    #normalizeUsername(username: string): string{
        return username.replace(/\s/g, '').toLowerCase();
    }

    async #insertUser(input: SignUpInput): Promise<User>{
        try{
            return await User.create({
                username: this.#normalizeUsername(input.username),
                fullname: input.fullname,
                email: input.email.toLowerCase(),
                passwordHash: await this.#password.hash(input.password)
            }).save();
        }catch(error){
            throw this.#duplicateUserError(error);
        }
    }

    #duplicateUserError(error: unknown): unknown{
        if(!isUniqueViolation(error)) return error;

        const driver = error.driverError as { message?: string; detail?: string };
        const detail = [driver.message, driver.detail, error.message].join(' ');
        return detail.includes('username') ? UserError.UsernameAlreadyTaken() : UserError.EmailAlreadyRegistered();
    }
}
