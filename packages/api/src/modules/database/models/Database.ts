import { Entity, Column, Index } from 'typeorm';
import BaseModel from '@/shared/models/BaseModel';
import { Hidden } from '@/shared/models/Hidden';
import { DatabaseEngine, DatabaseStatus } from '@quantum/contracts/modules/database/domain';
import { DatabaseFields } from '../contracts/domain/database';
import type { DatabaseBackup } from '@quantum/contracts/modules/database/domain';

@Entity()
@Index(['projectId', 'name'], { unique: true })
export default class Database extends BaseModel implements DatabaseFields{
    @Column('varchar')
    name!: string;

    @Column({ type: 'simple-enum', enum: DatabaseEngine })
    engine!: DatabaseEngine;

    @Column({ type: 'varchar', nullable: true })
    version!: string | null;

    @Column('int')
    organizationId!: number;

    @Column('int')
    projectId!: number;

    @Column({ type: 'int', nullable: true })
    environmentId!: number | null;

    @Column({ type: 'int', nullable: true })
    userId!: number | null;

    @Column({ type: 'varchar', default: 'local' })
    nodeId!: string;

    @Column({ type: 'simple-enum', enum: DatabaseStatus, default: DatabaseStatus.Pending })
    status!: DatabaseStatus;

    @Column({ type: 'int', nullable: true })
    containerId!: number | null;

    @Hidden()
    @Column({ type: 'varchar', nullable: true })
    credentialsEnc!: string | null;

    @Hidden()
    @Column({ type: 'varchar', nullable: true })
    connectionStringEnc!: string | null;

    @Column('simple-json')
    backups!: DatabaseBackup[];
}
