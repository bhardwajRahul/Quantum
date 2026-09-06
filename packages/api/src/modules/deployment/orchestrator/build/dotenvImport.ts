import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'dotenv';
import type Deployment from '../../models/Deployment';

export const dotenvPath = (storagePath: string, rootDirectory: string): string =>
    path.join(storagePath, rootDirectory === '/' ? '' : rootDirectory, '.env');

const readDotenv = async (file: string): Promise<Record<string, string> | null> => {
    try{
        return parse(await readFile(file));
    }catch(error){
        if((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
    }
};

export const importDotenv = async (deployment: Deployment, storagePath: string, rootDirectory: string): Promise<string[]> => {
    const fromFile = await readDotenv(dotenvPath(storagePath, rootDirectory));
    if(fromFile === null) return [];

    const added = Object.keys(fromFile).filter((key) => deployment.environmentVariables[key] === undefined);
    if(added.length === 0) return [];

    deployment.environmentVariables = { ...fromFile, ...deployment.environmentVariables };
    await deployment.save();
    return added;
};
