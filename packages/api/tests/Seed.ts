import User from '@/modules/user/models/User';
import PasswordService from '@/modules/auth/services/PasswordService';
import { UserRole } from '@quantum/contracts/modules/user/domain';

export const TEST_PASSWORD = 'password123';

export default class Seed{
    static #sequence = 0;

    protected sequence(): number{
        return ++Seed.#sequence;
    }

    async user(role: UserRole = UserRole.User): Promise<User>{
        const n = this.sequence();
        return User.create({
            username: `user${n}quantum`,
            fullname: `User Number ${n}`,
            email: `user${n}@quantum.test`,
            role,
            passwordHash: await new PasswordService().hash(TEST_PASSWORD)
        }).save();
    }
}

export const seed = new Seed();
