import { Entity, Column, Index } from 'typeorm';
import BaseModel from '@/shared/models/BaseModel';
import { OrganizationRole } from '@quantum/contracts/modules/organization/domain';
import { MembershipFields } from '../contracts/domain/organization';

@Entity()
@Index(['userId', 'organizationId', 'projectId'], { unique: true })
export default class OrganizationMembership extends BaseModel implements MembershipFields{
    @Column('int')
    userId!: number;

    @Column('int')
    organizationId!: number;

    @Column({ type: 'int', nullable: true })
    projectId!: number | null;

    @Column({ type: 'simple-enum', enum: OrganizationRole })
    role!: OrganizationRole;
}
