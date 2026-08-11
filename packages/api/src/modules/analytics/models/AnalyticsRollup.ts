import { Entity, Column, Index } from 'typeorm';
import BaseModel from '@/shared/models/BaseModel';
import { AnalyticsRollupFields } from '../contracts/domain/analytics';

@Entity()
@Index(['domainId', 'bucket'], { unique: true })
@Index(['organizationId', 'bucket'])
export default class AnalyticsRollup extends BaseModel implements AnalyticsRollupFields{
    @Column('int')
    organizationId!: number;

    @Column({ type: 'int', nullable: true })
    domainId!: number | null;

    @Column({ type: 'varchar', nullable: true })
    host!: string | null;

    @Column('timestamp')
    bucket!: Date;

    @Column({ type: 'int', default: 0 })
    pageviews!: number;

    @Column({ type: 'int', default: 0 })
    visitors!: number;

    @Column({ type: 'int', default: 0 })
    bounces!: number;

    @Column({ type: 'jsonb', default: {} })
    topPaths!: Record<string, number>;

    @Column({ type: 'jsonb', default: {} })
    topReferrers!: Record<string, number>;

    @Column({ type: 'jsonb', default: {} })
    countries!: Record<string, number>;

    @Column({ type: 'jsonb', default: {} })
    devices!: Record<string, number>;

    @Column({ type: 'jsonb', default: {} })
    browsers!: Record<string, number>;

    @Column({ type: 'jsonb', default: {} })
    os!: Record<string, number>;
}
