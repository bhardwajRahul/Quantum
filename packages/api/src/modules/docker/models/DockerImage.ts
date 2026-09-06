import { Entity, Column, Index } from 'typeorm';
import BaseModel from '@/shared/models/BaseModel';
import { DockerImageFields } from '../contracts/domain/docker';

@Entity()
@Index(['name', 'tag', 'userId', 'organizationId'], { unique: true })
export default class DockerImage extends BaseModel implements DockerImageFields{
    @Column('varchar')
    name!: string;

    @Column({ type: 'varchar', default: 'latest' })
    tag!: string;

    @Column({ type: 'bigint', default: 0 })
    size!: number;

    @Column('int')
    userId!: number;

    @Column('int')
    organizationId!: number;

    @Column({ type: 'boolean', default: false })
    builtLocally!: boolean;
}
