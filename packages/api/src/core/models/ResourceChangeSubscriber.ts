import { EventSubscriber } from 'typeorm';
import type { EntitySubscriberInterface, InsertEvent, RemoveEvent, UpdateEvent } from 'typeorm';
import { eventBus } from '@/shared/events/EventBus';
import type { ResourceAction } from '@quantum/contracts/modules/resource/gateway';

const organizationIdOf = (row: unknown): number | null => {
    if(typeof row !== 'object' || row === null) return null;
    const value = (row as { organizationId?: unknown }).organizationId;
    return typeof value === 'number' ? value : null;
};

@EventSubscriber()
export class ResourceChangeSubscriber implements EntitySubscriberInterface{
    afterInsert(event: InsertEvent<unknown>): void{
        this.#announce('created', event.metadata.name, event.entity);
    }

    afterUpdate(event: UpdateEvent<unknown>): void{
        this.#announce('updated', event.metadata.name, event.databaseEntity ?? event.entity);
    }

    afterRemove(event: RemoveEvent<unknown>): void{
        this.#announce('removed', event.metadata.name, event.databaseEntity ?? event.entity);
    }

    #announce(action: ResourceAction, entity: string, row: unknown): void{
        const organizationId = organizationIdOf(row);
        if(organizationId === null) return;

        eventBus.emit('resource.changed', { entity, action, organizationId });
    }
}
