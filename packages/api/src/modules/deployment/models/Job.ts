import { Entity, Column, Index } from 'typeorm';
import BaseModel from '@/shared/models/BaseModel';
import { JobStatus, JobType } from '@quantum/contracts/modules/deployment/domain';
import { JobFields } from '../contracts/domain/deployment';

@Entity()
@Index(['status', 'runAt'])
@Index(['lockKey'])
export default class Job extends BaseModel implements JobFields{
    @Column('varchar')
    type!: JobType;

    @Column({ type: 'simple-enum', enum: JobStatus, default: JobStatus.Queued })
    status!: JobStatus;

    @Column({ type: 'varchar', default: 'local' })
    nodeId!: string;

    @Column({ type: 'int', nullable: true })
    repositoryId!: number | null;

    @Column({ type: 'int', nullable: true })
    userId!: number | null;

    @Column({ type: 'int', nullable: true })
    containerId!: number | null;

    @Column({ type: 'int', nullable: true })
    deploymentId!: number | null;

    @Column({ type: 'int', nullable: true })
    projectId!: number | null;

    @Column({ type: 'int', nullable: true })
    organizationId!: number | null;

    @Column({ type: 'int', nullable: true })
    templateInstallId!: number | null;

    @Column({ type: 'simple-json', default: {} })
    payload!: Record<string, unknown>;

    @Column({ type: 'int', default: 0 })
    priority!: number;

    @Column({ type: 'int', default: 0 })
    attempts!: number;

    @Column({ type: 'int', default: 3 })
    maxAttempts!: number;

    @Column({ type: 'int', default: 5000 })
    backoffMs!: number;

    @Column({ type: 'timestamp', nullable: true })
    runAt!: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    lockedUntil!: Date | null;

    @Column({ type: 'varchar', nullable: true })
    claimedBy!: string | null;

    @Column({ type: 'varchar', nullable: true, unique: true })
    idempotencyKey!: string | null;

    @Column({ type: 'varchar', nullable: true })
    lockKey!: string | null;

    @Column({ type: 'varchar', nullable: true })
    error!: string | null;

    @Column({ type: 'simple-json', nullable: true })
    result!: Record<string, unknown> | null;
}
