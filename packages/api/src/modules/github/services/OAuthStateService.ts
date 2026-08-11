import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import { config } from '@/shared/config';
import { GithubError } from '../contracts/domain/errors';

const STATE_TTL_SECONDS = 600;

export default class OAuthStateService{
    issue(userId: number): string{
        return jwt.sign({ sub: String(userId), nonce: randomBytes(16).toString('hex') }, config.jwtSecret, {
            expiresIn: STATE_TTL_SECONDS
        });
    }

    consume(state: string): number{
        const payload = this.#decode(state);
        if(typeof payload.sub !== 'string') throw GithubError.StateMismatch();
        return Number(payload.sub);
    }

    #decode(state: string): jwt.JwtPayload{
        if(!state) throw GithubError.StateMismatch();
        try{
            const verified = jwt.verify(state, config.jwtSecret);
            if(typeof verified === 'string') throw GithubError.StateMismatch();
            return verified;
        }catch{
            throw GithubError.StateMismatch();
        }
    }
}
