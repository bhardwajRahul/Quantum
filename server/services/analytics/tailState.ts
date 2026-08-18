import fs from 'fs';
import path from 'path';
import { ensureDirectoryExists } from '@utilities/helpers';
import logger from '@utilities/logger';

const STATE_DIR = '/var/lib/quantum/analytics';
const STATE_FILE = path.join(STATE_DIR, 'tail-state.json');

interface TailState{
    offset: number;
    inode: number;
}

const readState = async (): Promise<TailState> => {
    try{
        const raw = await fs.promises.readFile(STATE_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
            offset: Number(parsed?.offset) || 0,
            inode: Number(parsed?.inode) || 0
        };
    }catch{

        return { offset: 0, inode: 0 };
    }
};

const writeState = async (state: TailState): Promise<void> => {
    try{
        await ensureDirectoryExists(STATE_DIR);
        await fs.promises.writeFile(STATE_FILE, JSON.stringify(state), 'utf-8');
    }catch(error){
        logger.error('@services/analytics/tailState.ts (writeState): ' + error);
    }
};

export const readNewLines = async (filePath: string): Promise<string[]> => {
    let stat: fs.Stats;
    try{
        stat = await fs.promises.stat(filePath);
    }catch(error: any){
        if(error?.code === 'ENOENT') return [];
        logger.error('@services/analytics/tailState.ts (stat): ' + error);
        return [];
    }

    const state = await readState();
    let startOffset = state.offset;
    const currentInode = Number(stat.ino) || 0;

    if(stat.size < startOffset || (state.inode && currentInode && currentInode !== state.inode)){
        startOffset = 0;
    }

    if(stat.size <= startOffset){

        await writeState({ offset: stat.size, inode: currentInode });
        return [];
    }

    let chunk = '';
    try{
        const fd = await fs.promises.open(filePath, 'r');
        try{
            const length = stat.size - startOffset;
            const buffer = Buffer.alloc(length);
            await fd.read(buffer, 0, length, startOffset);
            chunk = buffer.toString('utf-8');
        }finally{
            await fd.close();
        }
    }catch(error){
        logger.error('@services/analytics/tailState.ts (read): ' + error);
        return [];
    }

    const lastNewline = chunk.lastIndexOf('\n');
    let consumed = chunk;
    let advanceTo = stat.size;
    if(lastNewline === -1){

        await writeState({ offset: startOffset, inode: currentInode });
        return [];
    }
    if(lastNewline < chunk.length - 1){
        consumed = chunk.slice(0, lastNewline + 1);
        advanceTo = startOffset + Buffer.byteLength(consumed, 'utf-8');
    }

    await writeState({ offset: advanceTo, inode: currentInode });

    return consumed.split('\n').filter((line) => line.trim().length > 0);
};

export default { readNewLines };
