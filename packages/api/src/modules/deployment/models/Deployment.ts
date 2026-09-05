import { Entity, Column, Index } from 'typeorm';
import BaseModel from '@/shared/models/BaseModel';
import { DeploymentStatus } from '@quantum/contracts/modules/deployment/domain';
import type { DeploymentArtifact, DeploymentCommit } from '@quantum/contracts/modules/deployment/domain';
import { DeploymentFields } from '../contracts/domain/deployment';

@Entity()
@Index(['repositoryId'])
@Index(['organizationId'])
export default class Deployment extends BaseModel implements DeploymentFields{
    @Column('int')
    repositoryId!: number;

    @Column('int')
    userId!: number;

    @Column({ type: 'int', nullable: true })
    organizationId!: number | null;

    @Column({ type: 'int', nullable: true })
    environmentId!: number | null;

    @Column({ type: 'varchar', nullable: true })
    githubDeploymentId!: string | null;

    @Column({ type: 'simple-enum', enum: DeploymentStatus, default: DeploymentStatus.Pending })
    status!: DeploymentStatus;

    @Column({ type: 'varchar', length: 500, nullable: true })
    error!: string | null;

    @Column({ type: 'simple-json', nullable: true })
    commit!: DeploymentCommit | null;

    @Column({ type: 'simple-json', nullable: true })
    artifact!: DeploymentArtifact | null;

    @Column({ type: 'varchar', nullable: true })
    url!: string | null;

    @Column({ type: 'simple-json', default: {} })
    environmentVariables!: Record<string, string>;
}
