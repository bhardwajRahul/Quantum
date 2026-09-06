import { namedVolume } from '@/modules/docker/services/containerVolume';
import type DockerContainer from '@/modules/docker/models/DockerContainer';
import type { DockerContainerVolume } from '@quantum/contracts/modules/docker/domain';

export const WORKSPACE_ROOT = '/home/coder/project';

export interface WorkspaceService{
    name: string;
    container: DockerContainer;
}

export const repositoryWorkspace = (storagePath: string): DockerContainerVolume[] =>
    [{ containerPath: WORKSPACE_ROOT, mode: 'rw', source: storagePath }];

export const installWorkspace = (services: WorkspaceService[]): DockerContainerVolume[] =>
    services.flatMap(({ name, container }) => container.volumes.map((volume) => ({
        containerPath: `${WORKSPACE_ROOT}/${name}${volume.containerPath}`,
        mode: 'rw' as const,
        source: namedVolume(container.dockerContainerName, volume.containerPath)
    })));
