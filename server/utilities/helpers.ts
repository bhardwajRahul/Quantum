import { Response } from 'express';
import DockerContainer from '@models/docker/container';
import DockerContainerService from '@services/docker/container';
import logger from '@utilities/logger';
import fs from 'fs';
import net from 'net';
import _ from 'lodash';

const getRandomPort = (): number => {
    const MAX_PORT = 65535;
    const MIN_PORT = 10240;
    return Math.floor(Math.random() * (MAX_PORT - MIN_PORT + 1)) + MIN_PORT;
}

export const jwtCookieOptions = (): { httpOnly: true; sameSite: 'none' | 'lax'; secure: boolean } => {
    const isHttps = (process.env.DOMAIN || '').startsWith('https://');
    return {
        httpOnly: true,
        sameSite: isHttps ? 'none' : 'lax',
        secure: isHttps
    };
};

export const deleteJWTCookie = (res: Response) => {

    res.clearCookie('jwt', jwtCookieOptions());
};

export const findRandomAvailablePort = async (): Promise<number> => {
    for(let attempt = 0; attempt < 10; attempt++){
        const port = getRandomPort();
        const server = net.createServer();

        const isAvailable = await new Promise<boolean>((resolve, reject) => {
            server.once('error', (err: NodeJS.ErrnoException) => {
                if(err.code === 'EADDRINUSE'){
                    resolve(false);
                }else{
                    reject(err);
                }
            });
            server.listen(port, () => {
                server.close(() => resolve(true));
            });
        });
        if(isAvailable) return port;
    }
    return -1;
}

export const ensureDirectoryExists = async (directoryPath: string): Promise<void> => {
    try{
        await fs.promises.access(directoryPath);
    }catch(error: any){

        if(error.code === 'ENOENT'){
            await fs.promises.mkdir(directoryPath, { recursive:true });
        }else{
            logger.error('@utilities/helper.ts (ensureDirectoryExists): ' + error);
            throw error;
        }
    }
};

export const cleanHostEnvironment = async (): Promise<void> => {
    try{
        logger.info('@utilities/helper.ts (cleanHostEnvironment): Cleaning up the host environment, shutting down user containers...');
        const containers = await DockerContainer.find({});
        const promises = containers.map((container) => {
            const containerService = new DockerContainerService(container);
            return containerService.stop();
        });
        await Promise.all(promises);
        logger.info('@utilities/helper.ts (cleanHostEnvironment): Containers shut down successfully, safely shutting down the server...');
    }catch(error){
        logger.error('@utilities/helper.ts (cleanHostEnvironment): ' + error);
    }
};

export const filterObject = (object: object, ...fields: string[]): object => {
    return _.pick(object, fields);
};

export const checkIfSlugOrId = (id: string): { _id?: string, slug?: string } => {
    return /^[a-fA-F0-9]{24}$/.test(id)? { _id: id } : { slug: id };
};

export const catchAsync = (
    asyncFunction: (req: any, res: any, next: any) => Promise<void>
): (req: any, res: any, next: any) => void => {

    return async (req, res, next) => {
        try{
            await asyncFunction(req, res, next);
        }catch(error){
            next(error);
        }
    };
};
