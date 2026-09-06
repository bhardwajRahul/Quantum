import { Entity, Column, Index } from 'typeorm';
import BaseModel from '@/shared/models/BaseModel';
import { ProjectFields } from '../contracts/domain/project';

@Entity()
@Index(['organizationId', 'slug'], { unique: true })
export default class Project extends BaseModel implements ProjectFields{
    @Column('varchar')
    name!: string;

    @Column('varchar')
    slug!: string;

    @Column('int')
    organizationId!: number;

    @Column({ type: 'boolean', default: false })
    isDefault!: boolean;
}
