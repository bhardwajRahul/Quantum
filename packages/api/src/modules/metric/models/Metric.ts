import { Entity, Column, Index } from 'typeorm';
import BaseModel from '@/shared/models/BaseModel';
import { MetricFields } from '../contracts/domain/metric';

@Entity()
@Index(['containerId', 'ts'])
@Index(['repositoryId', 'ts'])
@Index(['projectId', 'ts'])
@Index(['organizationId', 'ts'])
export default class Metric extends BaseModel implements MetricFields{
    @Column({ type: 'int', nullable: true })
    organizationId!: number | null;

    @Column({ type: 'int', nullable: true })
    containerId!: number | null;

    @Column({ type: 'int', nullable: true })
    repositoryId!: number | null;

    @Column({ type: 'int', nullable: true })
    projectId!: number | null;

    @Column({ type: 'int', nullable: true })
    userId!: number | null;

    @Column({ type: 'varchar', default: 'local' })
    nodeId!: string;

    @Column({ type: 'float8', default: 0 })
    cpuPercent!: number;

    @Column({ type: 'float8', default: 0 })
    memUsage!: number;

    @Column({ type: 'float8', default: 0 })
    memLimit!: number;

    @Column({ type: 'float8', default: 0 })
    memPercent!: number;

    @Column({ type: 'float8', default: 0 })
    netRx!: number;

    @Column({ type: 'float8', default: 0 })
    netTx!: number;

    @Column({ type: 'float8', default: 0 })
    blkRead!: number;

    @Column({ type: 'float8', default: 0 })
    blkWrite!: number;

    @Column({ type: 'int', default: 0 })
    pids!: number;

    @Column({ type: 'timestamp', default: () => 'now()' })
    ts!: Date;
}
