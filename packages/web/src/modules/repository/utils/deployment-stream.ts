import { DeploymentStatus } from '@quantum/contracts/modules/deployment/domain';
import type { Deployment, DeploymentLogFrame, DeploymentStatusFrame } from '@quantum/contracts/modules/deployment/domain';

const STATUSES: string[] = Object.values(DeploymentStatus);

const isDeploymentStatus = (value: unknown): value is DeploymentStatus =>
    typeof value === 'string' && STATUSES.includes(value);

export const isStatusFrame = (data: unknown): data is DeploymentStatusFrame => {
    if(typeof data !== 'object' || data === null) return false;
    const frame = data as Partial<DeploymentStatusFrame>;
    return typeof frame.deploymentId === 'number' && isDeploymentStatus(frame.status);
};

export const isLogFrame = (data: unknown): data is DeploymentLogFrame => {
    if(typeof data !== 'object' || data === null) return false;
    const frame = data as Partial<DeploymentLogFrame>;
    return typeof frame.deploymentId === 'number' && typeof frame.line === 'string';
};

export const applyStatusFrame = (deployments: Deployment[], frame: DeploymentStatusFrame): Deployment[] =>
    deployments.map((deployment) =>
        deployment.id === frame.deploymentId
            ? { ...deployment, status: frame.status }
            : deployment
    );
