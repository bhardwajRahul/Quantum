import { del, get, patch, post } from '../../shared/routing';
import type { CreateUserInput, UpdateUserInput } from './http';
import type { User } from './domain';

export const userRoutes = {
    list: get<User[]>('/user'),
    create: post<CreateUserInput, User>('/user'),
    get: get<User>('/user/:id'),
    update: patch<UpdateUserInput, User>('/user/:id'),
    remove: del('/user/:id')
};
