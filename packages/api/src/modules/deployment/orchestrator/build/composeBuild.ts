import path from 'node:path';
import type Dockerode from 'dockerode';
import { TemplateInstallError } from '@/modules/template/contracts/domain/errors';
import type { TemplateServiceBuild } from '@quantum/contracts/modules/template/domain';

interface BuildFrame{
    error?: string;
    errorDetail?: { message?: string };
}

export const insideSource = (sourcePath: string, relative: string): string => {
    const resolved = path.resolve(sourcePath, relative);
    if(resolved !== sourcePath && !resolved.startsWith(sourcePath + path.sep)) throw TemplateInstallError.ComposeFileNotFound(relative);
    return resolved;
};

export const buildComposeImage = async (
    docker: Dockerode,
    sourcePath: string,
    composeDir: string,
    build: TemplateServiceBuild,
    tag: string
): Promise<void> => {
    const context = insideSource(sourcePath, path.join(composeDir, build.context));
    const dockerfile = build.dockerfile === undefined
        ? undefined
        : path.relative(context, insideSource(sourcePath, path.join(composeDir, build.context, build.dockerfile)));

    const stream = await docker.buildImage({ context, src: ['.'] }, {
        t: tag,
        dockerfile,
        target: build.target,
        buildargs: build.args
    });

    await new Promise<void>((resolve, reject) => {
        docker.modem.followProgress(stream, (error: Error | null, output: BuildFrame[]) => {
            if(error) return reject(error);
            const failure = (output ?? []).find((frame) => frame.error || frame.errorDetail);
            if(failure) return reject(new Error(failure.error || failure.errorDetail?.message || 'docker build failed'));
            resolve();
        });
    });
};
