import { Entity, Column, Index } from 'typeorm';
import BaseModel from '@/shared/models/BaseModel';
import { DomainKind, DomainStatus, DomainTarget } from '@quantum/contracts/modules/domain/domain';
import { DomainFields } from '../contracts/domain/domain';

@Entity()
@Index(['repositoryId'])
export default class Domain extends BaseModel implements DomainFields{
    @Column({ type: 'varchar', unique: true })
    host!: string;

    @Column({ type: 'simple-enum', enum: DomainTarget, default: DomainTarget.Repository })
    target!: DomainTarget;

    @Column({ type: 'int', nullable: true })
    repositoryId!: number | null;

    @Column({ type: 'varchar', nullable: true })
    upstreamUrl!: string | null;

    @Column('int')
    organizationId!: number;

    @Column('int')
    projectId!: number;

    @Column({ type: 'int', nullable: true })
    userId!: number | null;

    @Column({ type: 'simple-enum', enum: DomainKind, default: DomainKind.Custom })
    kind!: DomainKind;

    @Column({ type: 'boolean', default: false })
    isPrimary!: boolean;

    @Column({ type: 'boolean', default: true })
    tls!: boolean;

    @Column({ type: 'simple-enum', enum: DomainStatus, default: DomainStatus.Pending })
    status!: DomainStatus;
}
