import { In, MoreThanOrEqual } from 'typeorm';
import Paginated from '@/shared/controllers/Paginated';
import ActivityEvent from '../models/ActivityEvent';
import type { FindOptionsWhere } from 'typeorm';
import type { Page } from '@/shared/contracts/params';
import type { Tenant } from '@/modules/organization/contracts/types/fastify';

const MAX_LIMIT = 500;

export default class ActivityService{
    async list(
        userId: number,
        tenant: Tenant,
        page: Page,
        correlationId: string | undefined,
        rawMinutes: string | undefined
    ): Promise<Paginated<ActivityEvent>>{
        const [items, total] = await ActivityEvent.findAndCount({
            where: this.#scope(userId, tenant, correlationId, rawMinutes),
            order: { ts: 'DESC', id: 'DESC' },
            take: Math.min(page.limit, MAX_LIMIT),
            skip: page.offset
        });
        return new Paginated(items, page, total);
    }

    #scope(
        userId: number,
        tenant: Tenant,
        correlationId: string | undefined,
        rawMinutes: string | undefined
    ): FindOptionsWhere<ActivityEvent>[] | FindOptionsWhere<ActivityEvent>{
        const extra: FindOptionsWhere<ActivityEvent> = {};
        if(correlationId !== undefined) extra.correlationId = correlationId;

        const minutes = Number(rawMinutes);
        if(rawMinutes !== undefined && Number.isFinite(minutes) && minutes > 0){
            extra.ts = MoreThanOrEqual(new Date(Date.now() - minutes * 60 * 1000));
        }

        if(tenant.isPlatformAdmin) return [extra];

        const branches: FindOptionsWhere<ActivityEvent>[] = [
            { organizationId: In(tenant.organizationIds) },
            { userId }
        ];
        return branches.map((branch) => ({ ...branch, ...extra }));
    }
}
