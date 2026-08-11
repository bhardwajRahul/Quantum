import { Entity, Column, Index } from 'typeorm';
import BaseModel from '@/shared/models/BaseModel';
import { AnalyticsDevice } from '@quantum/contracts/modules/analytics/domain';
import { AnalyticsEventFields } from '../contracts/domain/analytics';

@Entity()
@Index(['organizationId', 'ts'])
@Index(['domainId', 'ts'])
@Index(['host', 'ts'])
export default class AnalyticsEvent extends BaseModel implements AnalyticsEventFields{
    @Column('int')
    organizationId!: number;

    @Column({ type: 'int', nullable: true })
    domainId!: number | null;

    @Column({ type: 'varchar', nullable: true })
    host!: string | null;

    @Column({ type: 'varchar', nullable: true })
    path!: string | null;

    @Column({ type: 'int', nullable: true })
    status!: number | null;

    @Column({ type: 'varchar', nullable: true })
    method!: string | null;

    @Column({ type: 'varchar', nullable: true })
    referrer!: string | null;

    @Column({ type: 'simple-enum', enum: AnalyticsDevice, nullable: true })
    device!: AnalyticsDevice | null;

    @Column({ type: 'varchar', nullable: true })
    browser!: string | null;

    @Column({ type: 'varchar', nullable: true })
    os!: string | null;

    @Column({ type: 'varchar', length: 2, nullable: true })
    country!: string | null;

    @Column({ type: 'varchar', nullable: true })
    utmSource!: string | null;

    @Column({ type: 'varchar', nullable: true })
    utmMedium!: string | null;

    @Column({ type: 'varchar', nullable: true })
    utmCampaign!: string | null;

    @Column({ type: 'int', nullable: true })
    durationMs!: number | null;

    @Column({ type: 'timestamp', default: () => 'now()' })
    ts!: Date;
}
