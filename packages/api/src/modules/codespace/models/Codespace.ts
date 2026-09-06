import { Entity, Column, Index } from 'typeorm';
import BaseModel from '@/shared/models/BaseModel';
import { Hidden } from '@/shared/models/Hidden';
import { CodespaceStatus } from '@quantum/contracts/modules/codespace/domain';
import { CodespaceFields } from '../contracts/domain/codespace';

@Entity()
@Index(['organizationId', 'name'], { unique: true })
export default class Codespace extends BaseModel implements CodespaceFields{
    @Column('varchar')
    name!: string;

    @Column('int')
    organizationId!: number;

    @Column('int')
    projectId!: number;

    @Column('int')
    userId!: number;

    @Column({ type: 'int', nullable: true })
    repositoryId!: number | null;

    @Column({ type: 'int', nullable: true })
    templateInstallId!: number | null;

    @Column({ type: 'int', nullable: true })
    imageId!: number | null;

    @Column({ type: 'int', nullable: true })
    networkId!: number | null;

    @Column({ type: 'int', nullable: true })
    containerId!: number | null;

    @Column({ type: 'int', nullable: true })
    portBindingId!: number | null;

    @Column({ type: 'int', default: 1 })
    cpuCores!: number;

    @Column({ type: 'int', default: 2048 })
    memoryMb!: number;

    @Column({ type: 'int', default: 10 })
    diskGb!: number;

    @Column({ type: 'simple-enum', enum: CodespaceStatus, default: CodespaceStatus.Pending })
    status!: CodespaceStatus;

    @Column({ type: 'varchar', nullable: true })
    accessUrl!: string | null;

    @Column({ type: 'varchar', nullable: true })
    @Hidden()
    passwordEnc!: string | null;

    @Column({ type: 'varchar', default: 'local' })
    nodeId!: string;
}
