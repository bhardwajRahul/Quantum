import { call } from '@/shared/api/call';
import { userRoutes } from '@quantum/contracts/modules/user/routes';
import type { CreateUserInput, UpdateUserInput } from '@quantum/contracts/modules/user/http';

export const userApi = {
    list: () => call(userRoutes.list),

    create: (body: CreateUserInput) => call(userRoutes.create, { body }),

    get: (id: number) => call(userRoutes.get, { path: { id } }),

    update: (id: number, body: UpdateUserInput) => call(userRoutes.update, { path: { id }, body }),

    remove: (id: number) => call(userRoutes.remove, { path: { id } })
};
