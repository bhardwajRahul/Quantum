import { call } from '@/shared/api/call';
import { authRoutes } from '@quantum/contracts/modules/auth/routes';
import type { SignInInput, SignUpInput, UpdatePasswordInput } from '@quantum/contracts/modules/auth/http';
import type { UpdateMyAccountInput } from '@quantum/contracts/modules/user/http';

export const authApi = {
    signIn: (body: SignInInput) => call(authRoutes.signIn, { body }),

    signUp: (body: SignUpInput) => call(authRoutes.signUp, { body }),

    signOut: () => call(authRoutes.signOut),

    me: () => call(authRoutes.me),

    updateMe: (body: UpdateMyAccountInput) => call(authRoutes.updateMe, { body }),

    deleteMe: () => call(authRoutes.deleteMe),

    updatePassword: (body: UpdatePasswordInput) => call(authRoutes.updatePassword, { body })
};
