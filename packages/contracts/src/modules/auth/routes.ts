import { get, patch, post } from '../../shared/routing';
import type { SignInInput, SignUpInput, UpdatePasswordInput } from './http';
import type { EmailAvailability, Session } from './domain';
import type { User } from '../user/domain';

export const authRoutes = {
    checkEmail: get<EmailAvailability>('/auth/email-availability'),
    signIn: post<SignInInput, Session>('/auth/sign-in'),
    signUp: post<SignUpInput, Session>('/auth/sign-up'),
    me: get<User>('/auth/me'),
    updatePassword: patch<UpdatePasswordInput, Session>('/auth/me/password')
};
