import { In, IsNull } from 'typeorm';
import slugify from 'slugify';
import { eventBus } from '@/shared/events/EventBus';
import { TemplateSource } from '@quantum/contracts/modules/template/domain';
import Template from '../models/Template';
import { TemplateError } from '../contracts/domain/errors';
import type { FindOptionsWhere } from 'typeorm';
import type { Tenant } from '@/modules/organization/contracts/types/fastify';
import type { CreateTemplateInput } from '@quantum/contracts/modules/template/http';

type TemplateWhere = FindOptionsWhere<Template> | FindOptionsWhere<Template>[];

export default class TemplateService{
    async list(tenant: Tenant): Promise<Template[]>{
        return Template.find({ where: this.#visibleWhere(tenant), order: { name: 'ASC' } });
    }

    async create(tenant: Tenant, input: CreateTemplateInput): Promise<Template>{
        if(tenant.organizationId === null) throw TemplateError.Forbidden();

        const slug = input.slug ?? slugify(input.name, { lower: true, strict: true });
        const exists = await Template.findOneBy({ slug });
        if(exists) throw TemplateError.SlugAlreadyTaken();

        return Template.create({
            name: input.name,
            slug,
            description: input.description ?? null,
            icon: input.icon ?? null,
            website: input.website ?? null,
            source: TemplateSource.Custom,
            organizationId: tenant.organizationId,
            spec: input.spec,
            inputsSchema: input.inputsSchema ?? []
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
