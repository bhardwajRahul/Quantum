import path from 'node:path';
import Dockerode from 'dockerode';
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
        const container = await DockerContainer.findOneBy({ repositoryId: repository.id });
        if(container === null || !container.dockerContainerName) throw RepositoryError.NotFound();

        try{
            return await this.#spawn(container, this.#workDir(repository), sink);
        }catch(error){
            if(error instanceof RuntimeError) throw error;
            throw RepositoryError.OperationFailed();
        }
    }

    async #spawn(container: DockerContainer, workDir: string, sink: TerminalSink): Promise<TerminalSession>{
        const live = await this.#live(container);
        const exec = await live.exec({
            Cmd: [container.command || DEFAULT_SHELL],
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

    /**
     * Addressed by the name the container was actually created under, not one rebuilt
     * from its id. Recomposing the name is how the network reference drifted: the rule
     * lived in two places and only one of them ever created anything.
     */
    async #live(container: DockerContainer): Promise<Dockerode.Container>{
        const live = this.#docker.getContainer(container.dockerContainerName);
        const { State } = await live.inspect();
        if(!State.Running) await live.start();
        return live;
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
