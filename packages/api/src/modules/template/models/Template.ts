import { Entity, Column, Index } from 'typeorm';
import BaseModel from '@/shared/models/BaseModel';
import { TemplateSource } from '@quantum/contracts/modules/template/domain';
import { TemplateFields } from '../contracts/domain/template';
import type { TemplateSpec } from '@quantum/contracts/modules/template/domain';

@Entity()
@Index(['slug', 'version'], { unique: true })
export default class Template extends BaseModel implements TemplateFields{
    @Column('varchar')
    name!: string;

    @Column('varchar')
    slug!: string;

    @Column({ type: 'varchar', default: '1.0.0' })
    version!: string;

    @Column({ type: 'varchar', default: 'other' })
    category!: string;

    @Column({ type: 'varchar', nullable: true })
    description!: string | null;

    @Column({ type: 'varchar', nullable: true })
    icon!: string | null;

    @Column({ type: 'varchar', nullable: true })
    website!: string | null;

    @Column({ type: 'simple-enum', enum: TemplateSource, default: TemplateSource.Custom })
    source!: TemplateSource;

    @Column({ type: 'int', nullable: true })
    organizationId!: number | null;

    @Column('simple-json')
    spec!: TemplateSpec;
}
