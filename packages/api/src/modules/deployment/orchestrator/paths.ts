import path from 'node:path';
import slugify from 'slugify';
import { config } from '@/shared/config';

export interface ContainerStoragePath{
    userContainerPath: string;
    containerStoragePath: string;
    repositoryContainerPath: string;
}

export const getContainerStoragePath = (userId: number, containerId: number, name: string): ContainerStoragePath => {
    const userContainerPath = path.join('/var/lib/quantum', config.nodeEnv, 'containers', String(userId));
    const containerStoragePath = path.join(userContainerPath, 'docker-containers', `${slugify(name)}-${containerId}`);
    const repositoryContainerPath = path.join(userContainerPath, 'github-repos', `${slugify(name)}-${containerId}`);
    return { userContainerPath, containerStoragePath, repositoryContainerPath };
};

export const getStackSourcePath = (userId: number, installId: number): string =>
    path.join('/var/lib/quantum', config.nodeEnv, 'containers', String(userId), 'stacks', String(installId));

export const getSystemDockerName = (containerId: number): string => {
    const formatted = String(containerId).replace(/[^a-zA-Z0-9_.-]/g, '_');
    return `quantum-container-${config.nodeEnv}-${formatted}`;
};
