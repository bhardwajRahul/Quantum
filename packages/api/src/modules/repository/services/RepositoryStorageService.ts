import path from 'node:path';
import Dockerode from 'dockerode';
import { config } from '@/shared/config';
import Repository from '../models/Repository';
import { RepositoryError } from '../contracts/domain/errors';
import type { ContainerEntry, ContainerFile } from '@quantum/contracts/modules/repository/domain';

const docker = new Dockerode();

const LS_LINE = /^([d-])[\w-]+ +\d+ +\w+ +\w+ +\d+ +\w+ +\d+ +[\d:]+ +(.+)$/;

interface ExecResult{
    output: string;
    exitCode: number;
}

export default class RepositoryStorageService{
    async explore(repository: Repository, route: string | undefined): Promise<ContainerEntry[]>{
        const dirPath = route === undefined || route === '' ? '/' : route;
        const { output, exitCode } = await this.#exec(repository, ['ls', '-la', dirPath]);
        if(exitCode !== 0) throw RepositoryError.OperationFailed(dirPath);
        return this.#parseLs(output);
    }

    async read(repository: Repository, filePath: string): Promise<ContainerFile>{
        const { output, exitCode } = await this.#exec(repository, ['cat', filePath]);
        if(exitCode !== 0) throw RepositoryError.OperationFailed(filePath);
        return { name: path.basename(filePath), content: output };
    }

    async write(repository: Repository, filePath: string, content: string): Promise<void>{
        const encoded = Buffer.from(content, 'utf8').toString('base64');
        const { exitCode } = await this.#exec(repository, [
            'sh', '-c',
            'mkdir -p "$(dirname "$1")" && printf %s "$2" | base64 -d > "$1"',
            'quantum-write', filePath, encoded
        ]);
        if(exitCode !== 0) throw RepositoryError.OperationFailed(filePath);
    }

    #parseLs(output: string): ContainerEntry[]{
        return output
            .split('\n')
            .filter((line) => line.trim() !== '' && !line.startsWith('total'))
            .map((line) => line.match(LS_LINE))
            .filter((match): match is RegExpMatchArray => match !== null)
            .map((match) => ({ name: match[2].trim(), isDirectory: match[1] === 'd' }))
            .filter((entry) => entry.name !== '' && entry.name !== '.' && entry.name !== '..');
    }

    #container(repository: Repository): Dockerode.Container{
        if(repository.containerId === null) throw RepositoryError.NotFound();
        return docker.getContainer(`quantum-container-${config.nodeEnv}-${repository.containerId}`);
    }

    async #exec(repository: Repository, cmd: string[]): Promise<ExecResult>{
        const exec = await this.#container(repository).exec({
            Cmd: cmd,
            AttachStdout: true,
            AttachStderr: true,
            Tty: false
        });
        const stream = await exec.start({ hijack: true });

        return new Promise<ExecResult>((resolve, reject) => {
            const stdout: Buffer[] = [];

            stream.on('data', (chunk: Buffer) => {
                if(chunk[0] !== 2) stdout.push(chunk.subarray(8));
            });
            stream.on('error', reject);
            stream.on('end', async () => {
                try{
                    const info = await exec.inspect();
                    resolve({
                        output: Buffer.concat(stdout).toString('utf8').trim(),
                        exitCode: info.ExitCode ?? -1
                    });
                }catch(error){
                    reject(error);
                }
            });
        });
    }
}
