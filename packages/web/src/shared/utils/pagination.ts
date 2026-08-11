import type { PageMeta } from '@quantum/contracts/shared/http';
import type { PageNavigation } from '@/shared/contracts/pagination';

export const pageNavigation = ({ total, limit, offset }: PageMeta): PageNavigation => ({
    page: Math.floor(offset / limit) + 1,
    pageCount: Math.ceil(total / limit),
    from: total === 0 ? 0 : offset + 1,
    to: Math.min(offset + limit, total),
    hasPrevious: offset > 0,
    hasNext: offset + limit < total
});
