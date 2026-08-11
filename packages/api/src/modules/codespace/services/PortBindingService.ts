import { In } from 'typeorm';
import { eventBus } from '@/shared/events/EventBus';
import { isUniqueViolation } from '@/shared/models/isUniqueViolation';
import PortBinding from '../models/PortBinding';
import { PortBindingError } from '../contracts/domain/errors';
import { PortBindingProtocol } from '@quantum/contracts/modules/codespace/domain';
import type { Tenant } from '@/modules/organization/contracts/types/fastify';
import type { CreatePortBindingInput } from '@quantum/contracts/modules/codespace/http';

export default class PortBindingService{
    async listMine(tenant: Tenant, userId: number): Promise<PortBinding[]>{
        if(!tenant.isPlatformAdmin && tenant.organizationIds.length === 0) return [];
        if(tenant.isPlatformAdmin){
            return PortBinding.find({ where: { userId }, order: { id: 'ASC' } });
        }
        return PortBinding.find({
            where: { userId, organizationId: In(tenant.organizationIds) },
            order: { id: 'ASC' }
        });
    }

    async create(userId: number, tenant: Tenant, input: CreatePortBindingInput): Promise<PortBinding>{
        if(tenant.organizationId === null) throw PortBindingError.Forbidden();

        try{
            const binding = await PortBinding.create({
                containerId: input.containerId,
                userId,
                organizationId: tenant.organizationId,
                internalPort: input.internalPort,
                externalPort: input.externalPort,
                protocol: input.protocol ?? PortBindingProtocol.Tcp
            }).save();

            this.#notifyChange(binding, 'create');
            return binding;
        }catch(error){
            if(isUniqueViolation(error)) throw PortBindingError.PortUnavailable();
            throw error;
        }
    }

    async getOwned(tenant: Tenant, userId: number, bindingId: number): Promise<PortBinding>{
        const binding = await PortBinding.findOneBy({ id: bindingId });
        if(!binding) throw PortBindingError.NotFound();
        if(!this.#canAccess(tenant, userId, binding)) throw PortBindingError.Forbidden();
        return binding;
    }

    async remove(tenant: Tenant, userId: number, bindingId: number): Promise<void>{
        const binding = await this.getOwned(tenant, userId, bindingId);
        const removed = { id: binding.id, containerId: binding.containerId };
        await binding.remove();
        eventBus.emit('portBinding.changed', {
            portBindingId: removed.id,
            containerId: removed.containerId,
            action: 'delete'
        });
    }

    #canAccess(tenant: Tenant, userId: number, binding: PortBinding): boolean{
        if(tenant.isPlatformAdmin) return true;
        return binding.userId === userId && tenant.organizationIds.includes(binding.organizationId);
    }

    #notifyChange(binding: PortBinding, action: 'create' | 'delete'){
        eventBus.emit('portBinding.changed', {
            portBindingId: binding.id,
            containerId: binding.containerId,
            action
        });
    }
}
