import { Entity, Column } from 'typeorm';
import BaseModel from '@/shared/models/BaseModel';
import { TemplateInstallFields } from '../contracts/domain/template';

@Entity()
export default class TemplateInstall extends BaseModel implements TemplateInstallFields{
    @Column('int')
    templateId!: number;

    @Column({ type: 'varchar', default: 'legacy' })
    templateVersion!: string;

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
}
