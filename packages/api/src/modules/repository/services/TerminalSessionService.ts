import path from 'node:path';
import Dockerode from 'dockerode';
import { config } from '@/shared/config';
import RuntimeError from '@/shared/errors/RuntimeError';
import DockerContainer from '@/modules/docker/models/DockerContainer';
import Repository from '../models/Repository';
import { RepositoryError } from '../contracts/domain/errors';
import type { Duplex } from 'node:stream';

export interface TerminalSink{
    output(data: string): void;
    exit(code: number): void;
}

export interface TerminalSession{
    write(data: string): void;
    resize(cols: number, rows: number): Promise<void>;
    destroy(): void;
}

const DEFAULT_SHELL = 'sh';

export default class TerminalSessionService{
    #docker = new Dockerode();

    async open(repository: Repository, sink: TerminalSink): Promise<TerminalSession>{
        if(repository.containerId === null) throw RepositoryError.NotFound();

        try{
            return await this.#spawn(
                repository.containerId,
                await this.#shell(repository.containerId),
                this.#workDir(repository),
                sink
            );
        }catch(error){
            if(error instanceof RuntimeError) throw error;
            throw RepositoryError.OperationFailed();
        }
    }

    async #spawn(containerId: number, shell: string, workDir: string, sink: TerminalSink): Promise<TerminalSession>{
        const container = await this.#container(containerId);
        const exec = await container.exec({
            Cmd: [shell],
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            Tty: true,
            WorkingDir: workDir
        });

        const stream = await exec.start({ hijack: true, stdin: true });
        this.#wire(exec, stream, sink);
        return this.#session(exec, stream);
    }

    async #container(containerId: number): Promise<Dockerode.Container>{
        const container = this.#docker.getContainer(`quantum-container-${config.nodeEnv}-${containerId}`);
        const { State } = await container.inspect();
        if(!State.Running) await container.start();
        return container;
    }

    async #shell(containerId: number): Promise<string>{
        const container = await DockerContainer.findOneBy({ id: containerId });
        return container?.command || DEFAULT_SHELL;
    }

    #workDir(repository: Repository): string{
        return path.posix.join('/app', repository.rootDirectory);
    }

    #wire(exec: Dockerode.Exec, stream: Duplex, sink: TerminalSink): void{
        stream.on('data', (chunk: Buffer) => sink.output(chunk.toString('utf8')));
        stream.on('error', () => stream.destroy());
        stream.on('close', () => { void this.#reportExit(exec, sink); });
    }

    async #reportExit(exec: Dockerode.Exec, sink: TerminalSink): Promise<void>{
        try{
            const info = await exec.inspect();
            sink.exit(info.ExitCode ?? 0);
        }catch{
            sink.exit(1);
        }
    }

    #session(exec: Dockerode.Exec, stream: Duplex): TerminalSession{
        return {
            write: (data: string) => {
                if(!stream.destroyed) stream.write(data);
            },
            resize: (cols: number, rows: number) => exec.resize({ h: rows, w: cols }),
            destroy: () => {
                stream.destroy();
            }
        };
    }
}
