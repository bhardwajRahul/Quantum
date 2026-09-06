import User from '../models/User';
import { UserError } from '../contracts/domain/errors';
import { isUniqueViolation } from '@/shared/models/isUniqueViolation';
import PasswordService from '@/modules/auth/services/PasswordService';
import type { CreateUserInput, UpdateUserInput } from '@quantum/contracts/modules/user/http';

const normalizeUsername = (username: string): string => username.replace(/\s/g, '').toLowerCase();

export default class UserService{
    list(): Promise<User[]>{
        return User.find({ order: { id: 'ASC' } });
    }

    async get(userId: number): Promise<User>{
        const user = await User.findOneBy({ id: userId });
        if(!user) throw UserError.NotFound();
        return user;
    }

    async create(input: CreateUserInput): Promise<User>{
        try{
            return await User.create({
                username: normalizeUsername(input.username),
                fullname: input.fullname,
                email: input.email.toLowerCase(),
                role: input.role,
                passwordHash: await new PasswordService().hash(input.password)
            }).save();
        }catch(error){
            throw this.#duplicateUserError(error);
        }
    }

    async update(userId: number, input: UpdateUserInput): Promise<User>{
        const user = await this.get(userId);

        if(input.username !== undefined) user.username = normalizeUsername(input.username);
        if(input.fullname !== undefined) user.fullname = input.fullname;
        if(input.email !== undefined) user.email = input.email.toLowerCase();
        if(input.role !== undefined) user.role = input.role;

        try{
            return await user.save();
        }catch(error){
            throw this.#duplicateUserError(error);
        }
    }

    async remove(userId: number){
        const user = await this.get(userId);
        await user.remove();
    }

    #duplicateUserError(error: unknown): unknown{
        if(!isUniqueViolation(error)) return error;

        const driver = error.driverError as { message?: string; detail?: string };
        const detail = [driver.message, driver.detail, error.message].join(' ');
        return detail.includes('username') ? UserError.UsernameAlreadyTaken() : UserError.EmailAlreadyRegistered();
    }
}
