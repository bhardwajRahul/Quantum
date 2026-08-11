import { In, IsNull } from 'typeorm';
import slugify from 'slugify';
import { eventBus } from '@/shared/events/EventBus';
import { TemplateSource } from '@quantum/contracts/modules/template/domain';
import Template from '../models/Template';
import { TemplateError } from '../contracts/domain/errors';
import type { FindOptionsWhere } from 'typeorm';
import type { Tenant } from '@/modules/organization/contracts/types/fastify';
import type { TemplateCategory } from '@quantum/contracts/modules/template/domain';
import type { CreateTemplateInput } from '@quantum/contracts/modules/template/http';

type TemplateWhere = FindOptionsWhere<Template> | FindOptionsWhere<Template>[];

export default class TemplateService{
    async list(tenant: Tenant, category?: string): Promise<Template[]>{
        const extra: FindOptionsWhere<Template> = category === undefined ? {} : { category };
        return Template.find({ where: this.#visibleWhere(tenant, extra), order: { name: 'ASC' } });
    }

    async categories(tenant: Tenant): Promise<TemplateCategory[]>{
        const templates = await Template.find({ where: this.#visibleWhere(tenant), select: { category: true } });
        return [...new Set(templates.map((template) => template.category))].sort();
    }

    async create(tenant: Tenant, input: CreateTemplateInput): Promise<Template>{
        if(tenant.organizationId === null) throw TemplateError.Forbidden();

        const slug = input.slug ?? slugify(input.name, { lower: true, strict: true });
        const version = input.version ?? '1.0.0';
        const exists = await Template.findOneBy({ slug, version });
        if(exists) throw TemplateError.SlugAlreadyTaken();

        return Template.create({
            name: input.name,
            slug,
            version,
            category: input.category ?? 'other',
            description: input.description ?? null,
            icon: input.icon ?? null,
            website: input.website ?? null,
            source: TemplateSource.Custom,
            organizationId: tenant.organizationId,
            spec: input.spec
        }).save();
    }

    async get(tenant: Tenant, id: number): Promise<Template>{
        const template = await Template.findOne({ where: this.#visibleWhere(tenant, { id }) });
        if(!template) throw TemplateError.NotFound();
        return template;
    }

    async remove(tenant: Tenant, id: number): Promise<void>{
        const template = await Template.findOneBy({ id });
        if(!template || template.source !== TemplateSource.Custom || !this.#owned(template, tenant)){
            throw TemplateError.NotFound();
        }

        await template.remove();
        eventBus.emit('template.deleted', { templateId: id });
    }

    #owned(template: Template, tenant: Tenant): boolean{
        if(tenant.isPlatformAdmin) return true;
        return template.organizationId !== null && tenant.organizationIds.includes(template.organizationId);
    }

    #visibleWhere(tenant: Tenant, extra: FindOptionsWhere<Template> = {}): TemplateWhere{
        if(tenant.isPlatformAdmin) return extra;
        if(tenant.organizationIds.length === 0) return { ...extra, organizationId: IsNull() };
        return [
            { ...extra, organizationId: IsNull() },
            { ...extra, organizationId: In(tenant.organizationIds) }
        ];
    }
}
