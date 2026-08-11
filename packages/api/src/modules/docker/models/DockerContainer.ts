import { Entity, Column, Index } from 'typeorm';
import BaseModel from '@/shared/models/BaseModel';
import { ContainerDesiredState, ContainerStatus } from '@quantum/contracts/modules/docker/domain';
import type { DockerContainerVolume } from '@quantum/contracts/modules/docker/domain';
import { DockerContainerFields } from '../contracts/domain/docker';

@Entity()
@Index(['organizationId', 'name'], { unique: true })
export default class DockerContainer extends BaseModel implements DockerContainerFields{
    @Column('varchar')
    name!: string;

    @Column({ type: 'varchar', default: '' })
    dockerContainerName!: string;

    @Column({ type: 'simple-enum', enum: ContainerStatus, default: ContainerStatus.Created })
    status!: ContainerStatus;

    @Column({ type: 'simple-enum', enum: ContainerDesiredState, default: ContainerDesiredState.Running })
    desiredState!: ContainerDesiredState;

    @Column({ type: 'varchar', nullable: true })
    command!: string | null;

    @Column({ type: 'varchar', default: '' })
    ipAddress!: string;

    @Column({ type: 'boolean', default: false })
    isUserContainer!: boolean;

    @Column({ type: 'boolean', default: false })
    isRepositoryContainer!: boolean;

    @Column({ type: 'varchar', nullable: true })
    storagePath!: string | null;

    @Column({ type: 'timestamp', nullable: true })
    startedAt!: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    stoppedAt!: Date | null;

    @Column({ type: 'jsonb', default: [] })
    volumes!: DockerContainerVolume[];

    @Column({ type: 'jsonb', default: {} })
    environmentVariables!: Record<string, string>;

    @Column('int')
    userId!: number;

    @Column('int')
    organizationId!: number;

    @Column('int')
    networkId!: number;

    @Column('int')
    imageId!: number;

    @Column({ type: 'int', nullable: true })
    repositoryId!: number | null;
}
