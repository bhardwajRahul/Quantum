import type { ReactNode } from 'react';

interface PageBodyProps{
    children: ReactNode;
    width?: 'default' | 'wide';
    height?: 'auto' | 'full';
}

const MAX_WIDTH = {
    default: 'max-w-3xl',
    wide: 'max-w-6xl'
} as const;

const HEIGHT = {
    auto: 'pb-8 pt-3 lg:py-8',
    full: 'flex min-h-0 flex-col pb-6 pt-2 lg:h-full lg:pt-6'
} as const;

const PageBody = ({ children, width = 'default', height = 'auto' }: PageBodyProps) => (
    <div className={`mx-auto w-full px-2 sm:px-4 ${MAX_WIDTH[width]} ${HEIGHT[height]}`}>
        {children}
    </div>
);

export default PageBody;
