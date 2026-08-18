import { IRepository } from '@typings/models/repository';
import { IDeployment } from '@typings/models/deployment';
import { IDockerContainer } from '@typings/models/docker/container';

export interface Artifact{

    image: string;

    tag: string;

    digest: string;

    builder: string;

    sizeBytes: number;
}

export interface BuildContext{
    repository: IRepository;
    deployment: IDeployment;
    container: IDockerContainer;

    nodeId: string;

    storagePath: string;
}

export interface BuilderStrategy{
    build(ctx: BuildContext): Promise<Artifact>;
}
