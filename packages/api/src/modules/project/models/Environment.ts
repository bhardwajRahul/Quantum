import { Entity, Column, Index } from 'typeorm';
import BaseModel from '@/shared/models/BaseModel';
import { EnvironmentType } from '@quantum/contracts/modules/project/domain';
import { EnvironmentFields } from '../contracts/domain/project';

@Entity()
@Index(['projectId', 'name'], { unique: true })
export default class Environment extends BaseModel implements EnvironmentFields{
    @Column('varchar')
    name!: string;

    @Column({ type: 'simple-enum', enum: EnvironmentType, default: EnvironmentType.Production })
    type!: EnvironmentType;

    @Column('int')
    projectId!: number;

    @Column('int')
    organizationId!: number;

    @Column({ type: 'boolean', default: false })
    isDefault!: boolean;
}
