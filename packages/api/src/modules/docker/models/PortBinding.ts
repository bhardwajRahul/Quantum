import { Entity, Column, Index } from 'typeorm';
import BaseModel from '@/shared/models/BaseModel';
import { PortBindingProtocol } from '@quantum/contracts/modules/docker/domain';
import { PortBindingFields } from '../contracts/domain/docker';

@Entity()
@Index(['containerId', 'externalPort', 'internalPort'], { unique: true })
export default class PortBinding extends BaseModel implements PortBindingFields{
    @Column('int')
    containerId!: number;

    @Column('int')
    userId!: number;

    @Column('int')
    organizationId!: number;

    @Column('int')
    internalPort!: number;

    @Column('int')
    externalPort!: number;

    @Column({ type: 'simple-enum', enum: PortBindingProtocol, default: PortBindingProtocol.Tcp })
    protocol!: PortBindingProtocol;
}
