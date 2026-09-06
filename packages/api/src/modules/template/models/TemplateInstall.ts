import { Entity, Column } from 'typeorm';
import BaseModel from '@/shared/models/BaseModel';
import { Hidden } from '@/shared/models/Hidden';
import { TemplateInstallStatus } from '@quantum/contracts/modules/template/domain';
import { TemplateInstallFields } from '../contracts/domain/template';
import type { ServiceEnvironment, StackSource, TemplateInstallService, TemplateSpec } from '@quantum/contracts/modules/template/domain';

@Entity()
export default class TemplateInstall extends BaseModel implements TemplateInstallFields{
    @Column({ type: 'int', nullable: true })
    templateId!: number | null;

    @Column({ type: 'text', nullable: true })
    compose!: string | null;

    @Column({ type: 'simple-json', nullable: true })
    spec!: TemplateSpec | null;

    @Column('varchar')
    name!: string;

    @Column({ type: 'int', nullable: true })
    organizationId!: number | null;

    @Column('int')
    projectId!: number;

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

    @Column({ type: 'jsonb', default: {} })
    environment!: ServiceEnvironment;

    @Column({ type: 'jsonb', nullable: true })
    source!: StackSource | null;

    @Column({ type: 'varchar', nullable: true })
    webhookId!: string | null;

    @Hidden()
    @Column({ type: 'varchar', nullable: true })
    webhookSecretEnc!: string | null;
}
