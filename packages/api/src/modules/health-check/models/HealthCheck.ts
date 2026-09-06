import { Entity, Column, Index } from 'typeorm';
import BaseModel from '@/shared/models/BaseModel';
import { HealthCheckStatus, HealthCheckType } from '@quantum/contracts/modules/health-check/domain';
import { HealthCheckFields } from '../contracts/domain/health-check';

@Entity()
@Index(['repositoryId'])
export default class HealthCheck extends BaseModel implements HealthCheckFields{
    @Column('int')
    organizationId!: number;

    @Column('int')
    repositoryId!: number;

    @Column({ type: 'int', nullable: true })
    projectId!: number | null;

    @Column({ type: 'int', nullable: true })
    userId!: number | null;

    @Column({ type: 'varchar', default: 'local' })
    nodeId!: string;

    @Column({ type: 'simple-enum', enum: HealthCheckType, default: HealthCheckType.Http })
    type!: HealthCheckType;

    @Column({ type: 'varchar', default: '/' })
    path!: string;

    @Column({ type: 'int', nullable: true })
    port!: number | null;

    @Column({ type: 'varchar', nullable: true })
    command!: string | null;

    @Column({ type: 'int', default: 30 })
    intervalSec!: number;

    @Column({ type: 'int', default: 5 })
    timeoutSec!: number;

    @Column({ type: 'int', default: 2 })
    healthyThreshold!: number;

    @Column({ type: 'int', default: 3 })
    unhealthyThreshold!: number;

    @Column({ type: 'boolean', default: true })
    enabled!: boolean;

    @Column({ type: 'boolean', default: false })
    autoRestart!: boolean;

    @Column({ type: 'boolean', default: false })
    gateDeploy!: boolean;

    @Column({ type: 'simple-enum', enum: HealthCheckStatus, default: HealthCheckStatus.Unknown })
    status!: HealthCheckStatus;

    @Column({ type: 'int', default: 0 })
    consecutiveFailures!: number;

    @Column({ type: 'int', default: 0 })
    consecutiveSuccesses!: number;

    @Column({ type: 'timestamp', nullable: true })
    lastCheckedAt!: Date | null;

    @Column({ type: 'varchar', nullable: true })
    lastError!: string | null;
}
