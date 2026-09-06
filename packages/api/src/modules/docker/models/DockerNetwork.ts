import { Entity, Column, Index } from 'typeorm';
import BaseModel from '@/shared/models/BaseModel';
import { NetworkDriver } from '@quantum/contracts/modules/docker/domain';
import { DockerNetworkFields } from '../contracts/domain/docker';

@Entity()
@Index(['organizationId', 'name'], { unique: true })
export default class DockerNetwork extends BaseModel implements DockerNetworkFields{
    @Column('varchar')
    name!: string;

    @Column({ type: 'varchar', default: '' })
    dockerNetworkName!: string;

    @Column({ type: 'varchar', default: '' })
    subnet!: string;

    @Column({ type: 'simple-enum', enum: NetworkDriver, default: NetworkDriver.Bridge })
    driver!: NetworkDriver;

    @Column('int')
    userId!: number;

    @Column('int')
    organizationId!: number;
}
