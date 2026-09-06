import { Entity, Column } from 'typeorm';
import BaseModel from '@/shared/models/BaseModel';
import { OrganizationFields } from '../contracts/domain/organization';

@Entity()
export default class Organization extends BaseModel implements OrganizationFields{
    @Column('varchar')
    name!: string;

    @Column({ type: 'varchar', unique: true })
    slug!: string;

    @Column('int')
    ownerId!: number;

    @Column({ type: 'boolean', default: false })
    isPersonal!: boolean;
}
