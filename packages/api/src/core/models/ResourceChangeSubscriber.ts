import { EventSubscriber } from 'typeorm';
import type { EntitySubscriberInterface, InsertEvent, RemoveEvent, UpdateEvent } from 'typeorm';
import { eventBus } from '@/shared/events/EventBus';
import type { ResourceAction } from '@quantum/contracts/modules/resource/gateway';

const organizationIdOf = (row: unknown): number | null => {
    if(typeof row !== 'object' || row === null) return null;
    const value = (row as { organizationId?: unknown }).organizationId;
    return typeof value === 'number' ? value : null;
};

/**
 * One place that notices every row an organization owns changing, instead of an emit
 * in each of the fifteen services that write them. Membership is decided by the row
 * itself: anything carrying an `organizationId` is announced, anything without one
 * (User, Organization, GithubAccount) is not, because there would be no room to send
 * it to.
 *
 * Entity subscribers only see writes that go through the entity manager — `save()`,
 * `remove()`, and the ActiveRecord methods built on them. A query-builder `update()`
 * or `delete()`, and a database-level cascade, bypass them, so those paths still need
 * their own refresh.
 */
@EventSubscriber()
export class ResourceChangeSubscriber implements EntitySubscriberInterface{
    afterInsert(event: InsertEvent<unknown>): void{
        this.#announce('created', event.metadata.name, event.entity);
    }

    afterUpdate(event: UpdateEvent<unknown>): void{
        // `entity` is only the changed columns on a partial save; the loaded row is the
        // one that reliably carries the tenant.
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
