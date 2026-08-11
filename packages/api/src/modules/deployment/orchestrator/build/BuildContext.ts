import { eventBus } from '@/shared/events/EventBus';
import type Repository from '@/modules/repository/models/Repository';
import type Deployment from '../../models/Deployment';
import type DockerContainer from '@/modules/docker/models/DockerContainer';
import type { DeploymentArtifact } from '@quantum/contracts/modules/deployment/domain';

export interface BuildContext{
    repository: Repository;
    deployment: Deployment;
    container: DockerContainer | null;
    nodeId: string;
    storagePath: string | null;
}

export interface BuilderStrategy{
    build(ctx: BuildContext): Promise<DeploymentArtifact>;
}

export const emitBuildLog = (deployment: Deployment, line: string): void => {
    eventBus.emit('deployment.log', {
        deploymentId: deployment.id,
        repositoryId: deployment.repositoryId,
        line
    });
};
