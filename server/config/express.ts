import express, { Request, Response } from 'express';
import cors from 'cors';
import http from 'http';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import session from 'express-session';
import { Server } from 'socket.io';

import passport from '@config/passport';
import * as bootstrap from '@utilities/bootstrap';
import { httpActivity } from '@middlewares/activity';
import globalErrorHandler from '@controllers/common/globalErrorHandler';

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: process.env.CORS_ORIGIN } });

bootstrap.ensurePublicFolderExistence();

bootstrap.configureApp({
    app,
    suffix: '/api/v1/',
    routes: [
        'docker/image',
        'docker/network',
        'docker/container',
        'github',
        'auth',
        'organization',
        'project',
        'environment',
        'membership',
        'repository',
        'domain',
        'database',
        'metric',
        'healthCheck',
        'template',
        'templateInstall',
        'webhook',
        'portBinding',
        'deployment',
        'server',
        'analytics',
        'usage',
        'codespace',
        'activity'
    ],
    middlewares: [
        helmet({

            crossOriginResourcePolicy: { policy: 'cross-origin' },
            crossOriginEmbedderPolicy: false,
            contentSecurityPolicy: false
        }),
        cookieParser(),
        session({
            secret: process.env.SESSION_SECRET!,
            resave: false,
            saveUninitialized: false,
            cookie: {
                httpOnly: true,
                sameSite: 'lax',

                secure: (process.env.DOMAIN || '').startsWith('https://')
            }
        }),
        cors({
            origin: process.env.NODE_ENV === 'production' ?
                    [process.env.CLIENT_HOST as string] : [process.env.CLIENT_DEV_HOST as string],
            credentials: true
        }),
        bodyParser.json({ verify: (req, _res, buf) => { (req as any).rawBody = buf; } }),
        bodyParser.urlencoded({ extended: true }),
        passport.initialize(),
        passport.session(),

        httpActivity,
        express.static('public')
    ]
});

app.all('*', (req: Request, res: Response) => {
    if(req.path.startsWith('/api/v1/') || !process.env.CLIENT_HOST){
        return res.status(404).json({
            status: 'error',
            data: {
                message: 'INVALID_API_REQUEST',
                url: req.originalUrl
            }
        })
    }
    res.redirect(process.env.CLIENT_HOST);
});

app.use(globalErrorHandler);

export { app,httpServer, io };
