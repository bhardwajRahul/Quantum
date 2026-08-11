import { lazy, Suspense } from 'react';
import type { ReactElement } from 'react';
import type { PageLoader } from '@/shared/contracts/routing/route';
import PageFallback from '@/shared/components/routing/PageFallback';

export const lazyElement = (load: PageLoader): ReactElement => {
    const Page = lazy(load);
    return (
        <Suspense fallback={<PageFallback />}>
            <Page />
        </Suspense>
    );
};
