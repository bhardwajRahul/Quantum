import passport from 'passport';
import { Strategy as GithubStrategy } from 'passport-github';
import * as dotenv from 'dotenv';

dotenv.config({ path: './.env' });

if(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET){
    passport.use(new GithubStrategy({
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: `${process.env.DOMAIN}/api/v1/github/callback/`,
        scope: ['user', 'repo']
    }, (accessToken: string, refreshToken: string, profile: any, cb: (err: any, user: any) => void) => {
        return cb(null, { accessToken , profile,refreshToken });
    }));
}

passport.serializeUser((user: any, cb: (err: any, identifier: any) => void) => {
    cb(null,user);
});

passport.deserializeUser((obj: any, cb:(err: any, user: any) => void) => {
    cb(null,obj);
});

export default passport;
