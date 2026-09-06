import Deployment from '../models/Deployment';
import type DockerContainer from '@/modules/docker/models/DockerContainer';

const deploymentVariables = async (repositoryId: number): Promise<Record<string, string>> => {
    const deployment = await Deployment.findOne({
        where: { repositoryId },
        order: { createdAt: 'DESC', id: 'DESC' }
    });
    return deployment?.environmentVariables ?? {};
};

const containerVariables = async (container: DockerContainer): Promise<Record<string, string>> => {
    if(!container.repositoryId) return container.environmentVariables;
    return { ...container.environmentVariables, ...(await deploymentVariables(container.repositoryId)) };
};

export const containerEnvironment = async (container: DockerContainer): Promise<string[]> =>
    Object.entries(await containerVariables(container)).map(([key, value]) => `${key.trim()}=${value}`);
