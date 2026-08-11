import jwt from 'jsonwebtoken';
import { config } from '@/shared/config';
import type { TokenPayload } from '../contracts/domain/auth';

export default class JWTService{
    sign(userId: number): string{
        return jwt.sign({ sub: String(userId), iatMs: Date.now() }, config.jwtSecret, {
            expiresIn: `${config.jwtExpirationDays}d`
        });
    }

    verify(token: string): TokenPayload{
        return jwt.verify(token, config.jwtSecret) as TokenPayload;
    }
}
