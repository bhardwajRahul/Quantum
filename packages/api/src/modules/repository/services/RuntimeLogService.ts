import Dockerode from 'dockerode';
import DockerContainer from '@/modules/docker/models/DockerContainer';
import { RepositoryError } from '../contracts/domain/errors';
import { logger } from '@/shared/utils/Logger';
import type Repository from '../models/Repository';

const TAIL_LINES = 300;

export interface RuntimeLogSink{
    line: (line: string) => void;
    end: () => void;
}

export interface RuntimeLogStream{
    stop: () => void;
}

export const stripFrameHeaders = (chunk: Buffer): string => {
    let text = '';
    let offset = 0;

    while(offset < chunk.length){
        const isHeader = chunk.length - offset >= 8
            && chunk[offset] <= 2
            && chunk[offset + 1] === 0
            && chunk[offset + 2] === 0
            && chunk[offset + 3] === 0;

        if(!isHeader){
            text += chunk.subarray(offset).toString('utf8');
            break;
        }

        const length = chunk.readUInt32BE(offset + 4);
        text += chunk.subarray(offset + 8, offset + 8 + length).toString('utf8');
        offset += 8 + length;
    }

    return text;
};

export default class RuntimeLogService{
    #docker = new Dockerode();

    async follow(repository: Repository, sink: RuntimeLogSink): Promise<RuntimeLogStream>{
        const container = await DockerContainer.findOneBy({ repositoryId: repository.id });
        if(container === null || !container.dockerContainerName) throw RepositoryError.NotFound();
        return this.followContainer(container, sink);
    }

    async followContainer(container: DockerContainer, sink: RuntimeLogSink): Promise<RuntimeLogStream>{
        const live = this.#docker.getContainer(container.dockerContainerName);
        const stream = await live.logs({
            follow: true,
            stdout: true,
            stderr: true,
            tail: TAIL_LINES,
            timestamps: false
        }) as unknown as NodeJS.ReadableStream;

        let buffer = '';
        stream.on('data', (chunk: Buffer) => {
            buffer += stripFrameHeaders(chunk);
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for(const line of lines) sink.line(line);
        });

        stream.on('error', (error: Error) => {
            logger.warn(`runtime log stream for ${container.dockerContainerName} ended — ${error.message}`,
                { scope: 'repository.logs' });
            sink.end();
        });

        stream.on('end', () => {
            if(buffer !== '') sink.line(buffer);
            sink.end();
        });

        return {
            stop: () => {
                stream.removeAllListeners();
                (stream as unknown as { destroy?: () => void }).destroy?.();
            }
        };
    }
}
