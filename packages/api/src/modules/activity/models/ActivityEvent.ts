import { Entity, Column, Index } from 'typeorm';
import BaseModel from '@/shared/models/BaseModel';
import { ActivityLevel } from '@quantum/contracts/modules/activity/domain';
import { ActivityEventFields } from '../contracts/domain/activity';

@Entity()
@Index(['organizationId', 'ts'])
@Index(['userId', 'ts'])
@Index(['correlationId', 'ts'])
export default class ActivityEvent extends BaseModel implements ActivityEventFields{
    @Column({ type: 'int', nullable: true })
    organizationId!: number | null;

    @Column({ type: 'int', nullable: true })
    userId!: number | null;

    @Column({ type: 'varchar', nullable: true })
    scope!: string | null;

    @Column({ type: 'simple-enum', enum: ActivityLevel, default: ActivityLevel.Info })
    level!: ActivityLevel;

    @Column('varchar')
    title!: string;

    @Column('text')
    message!: string;

    @Column({ type: 'varchar', nullable: true })
    source!: string | null;

    @Column({ type: 'varchar', nullable: true })
    correlationId!: string | null;

    @Column({ type: 'jsonb', default: {} })
    meta!: Record<string, unknown>;

    @Column({ type: 'timestamp', default: () => 'now()' })
    ts!: Date;
}
