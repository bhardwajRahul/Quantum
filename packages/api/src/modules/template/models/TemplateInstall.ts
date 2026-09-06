import { Entity, Column } from 'typeorm';
import BaseModel from '@/shared/models/BaseModel';
import { Hidden } from '@/shared/models/Hidden';
import { TemplateInstallStatus } from '@quantum/contracts/modules/template/domain';
import { TemplateInstallFields } from '../contracts/domain/template';
import type { TemplateInstallService } from '@quantum/contracts/modules/template/domain';

@Entity()
export default class TemplateInstall extends BaseModel implements TemplateInstallFields{
    @Column('int')
    templateId!: number;

    @Column('varchar')
    name!: string;

    @Column({ type: 'int', nullable: true })
    organizationId!: number | null;

    @Column('int')
    projectId!: number;

    @Column({ type: 'int', nullable: true })
    environmentId!: number | null;

    @Column({ type: 'int', nullable: true })
    userId!: number | null;

    @Column({ type: 'varchar', default: 'local' })
    nodeId!: string;

    @Hidden()
    @Column({ type: 'varchar', nullable: true })
    inputsEnc!: string | null;

    @Column({ type: 'simple-enum', enum: TemplateInstallStatus, default: TemplateInstallStatus.Pending })
    status!: TemplateInstallStatus;

    @Column({ type: 'int', nullable: true })
    networkId!: number | null;

    @Column({ type: 'jsonb', default: [] })
    services!: TemplateInstallService[];
}
