import { Entity, Column, Index } from 'typeorm';
import BaseModel from '@/shared/models/BaseModel';
import { TemplateSource } from '@quantum/contracts/modules/template/domain';
import { TemplateFields } from '../contracts/domain/template';
import type { InputDef, TemplateSpec } from '@quantum/contracts/modules/template/domain';

@Entity()
@Index(['slug'], { unique: true })
export default class Template extends BaseModel implements TemplateFields{
    @Column('varchar')
    name!: string;

    @Column('varchar')
    slug!: string;

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

    @Column({ type: 'simple-json', default: [] })
    inputsSchema!: InputDef[];
}
