import { del, get, patch, post } from '../../shared/routing';
import type { SignInInput, SignUpInput, UpdatePasswordInput } from './http';
import type { Session } from './domain';
import type { User } from '../user/domain';
import type { UpdateMyAccountInput } from '../user/http';

export const authRoutes = {
    signIn: post<SignInInput, Session>('/auth/sign-in'),
    signUp: post<SignUpInput, Session>('/auth/sign-up'),
    signOut: post<void>('/auth/sign-out'),
    me: get<User>('/auth/me'),
    updateMe: patch<UpdateMyAccountInput, User>('/auth/me'),
    deleteMe: del('/auth/me'),
    updatePassword: patch<UpdatePasswordInput, Session>('/auth/me/password')
};
