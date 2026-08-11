import { Entity, Column, Index } from 'typeorm';
import BaseModel from '@/shared/models/BaseModel';
import { DomainKind, DomainStatus } from '@quantum/contracts/modules/domain/domain';
import { DomainFields } from '../contracts/domain/domain';

@Entity()
@Index(['repositoryId'])
export default class Domain extends BaseModel implements DomainFields{
    @Column({ type: 'varchar', unique: true })
    host!: string;

    @Column('int')
    repositoryId!: number;

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
