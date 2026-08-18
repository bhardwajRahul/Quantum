import fs from 'fs';
import path from 'path';
import util from 'util';
import logger from '@utilities/logger';
import { ensureDirectoryExists } from '@utilities/helpers';
import { Socket } from 'socket.io';
import { Duplex } from 'stream';
import { Exec } from 'dockerode';

const stat = util.promisify(fs.stat);
const truncate = util.promisify(fs.truncate);

export const logs: Map<string, fs.WriteStream> = new Map();

export const sockets: Map<string, Socket> = new Map();

export const shells: Map<string, Duplex> = new Map();

const getLogDir = (id: string): string => {
    return path.join('/var/lib/quantum', process.env.NODE_ENV as string, 'containers', id, 'logs');
};

const getLogFile = async (logName: string, logDir: string): Promise<string> => {
    await ensureDirectoryExists(logDir);
    const logFile = path.join(logDir, `${logName}.log`);
    return logFile;
}

export const createLogStream = async (userId: string, logId: string): Promise<fs.WriteStream | null> => {
    try{
        removeLogStream(logId);
        const logDir = getLogDir(userId);
        const logFile = await getLogFile(logId, logDir);
        const stream = fs.createWriteStream(logFile, { flags: 'a' });
        logs.set(logId, stream);
        return stream;
    }catch(error: any){
        criticalErrorHandler('createLogStream', error);
        return null;
    }
}

export const removeLogStream = (logId: string): void => {
    const stream = logs.get(logId);
    if(stream){
        stream.end();
        logs.delete(logId);
    }
};

export const setupSocketEvents = async (socket: Socket, userId: string, logId: string, exec: Exec): Promise<void> => {
    try{
        const logHistory = await getLog(userId, logId);
        let shell = shells.get(logId);
        if(!shell){
            shell = await exec.start({ Tty: true, stdin: true, hijack: true });
            shells.set(logId, shell);
        }
        const handleShellData = (chunk: Buffer) => {
            const data = chunk.toString('utf8');
            appendLog(userId, logId, data);
            socket.emit('response', data);
        };
        sockets.set(logId, socket);
        socket.on('disconnect', () => handleDisconnect(logId, socket, shell, handleShellData));
        socket.emit('history', logHistory);
        socket.on('command', (command: string) => {
            shell?.write(`${command}\n`);
        });
        shell.on('data', handleShellData);
    }catch(error){
        criticalErrorHandler('setupSocketEvents', error);
    }
}

const handleDisconnect = (id: string, socket: Socket, shell: Duplex | undefined, dataHandler: (chunk: Buffer) => void): void => {
    socket.disconnect(true);
    shell?.off('data', dataHandler);
    sockets.delete(id);
    removeLogStream(id);
}

export const streamReadable = async (
    socket: Socket,
    userId: string,
    logId: string,
    source: NodeJS.ReadableStream,
    options: { persist?: boolean; demux?: boolean } = {}
): Promise<void> => {
    const { persist = false, demux = false } = options;
    try{
        const history = await getLog(userId, logId);
        socket.emit('history', history);
        const onData = (chunk: Buffer) => {

            const data = (demux ? chunk.slice(8) : chunk).toString('utf8');
            if(persist) appendLog(userId, logId, data);
            socket.emit('response', data);
        };
        const cleanup = () => {
            source.removeListener('data', onData);
            try{ (source as any).destroy?.(); }catch{   }
            sockets.delete(logId);
        };
        sockets.set(logId, socket);
        socket.on('disconnect', () => { socket.disconnect(true); cleanup(); });
        source.on('data', onData);
        source.on('end', cleanup);
        source.on('error', cleanup);
    }catch(error){
        criticalErrorHandler('streamReadable', error);
    }
};

export const appendLog = async (userId: string, id: string, data: string): Promise<void> => {
    await checkLogFileStatus(userId, id);
    const stream = logs.get(id);
    if(!stream) return;
    stream.write(data);
}

const checkLogFileStatus = async (userId: string, logId: string): Promise<void> => {
    try{
        const logDir = getLogDir(userId);
        const logFile = await getLogFile(logId, logDir);
        const stats = await stat(logFile);
        const maxSize = Number(process.env.LOG_PATH_MAX_SIZE) * 1024;
        if(stats.size > maxSize){
            await truncate(logFile, 0);
        }
    }catch(error: any){
        criticalErrorHandler('checkLogFileStatus', error);
    }
}

const getLog = async (userId: string, logId: string): Promise<string> => {
    try{
        const logDir = getLogDir(userId);
        const logFile = await getLogFile(logId, logDir);
        if(!fs.existsSync(logFile)) return '';
        const content = await fs.promises.readFile(logFile, 'utf-8');
        return content;
    }catch(error){
        logger.error('@services/logManager.ts (getLog): ' + error);
        return '';
    }
}

const criticalErrorHandler = (operation: string, error: any): void => {
    logger.error(`@services/logManager.ts (${operation}): ` + error);
    throw error;
}