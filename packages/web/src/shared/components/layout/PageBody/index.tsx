import type { ReactNode } from 'react';

interface PageBodyProps{
    children: ReactNode;
    width?: 'default' | 'wide';
    height?: 'auto' | 'full';
}

const MAX_WIDTH = {
    default: 'max-w-none',
    wide: 'max-w-none'
} as const;

const HEIGHT = {
    auto: 'pb-14 pt-8 lg:pt-11',
    full: 'flex min-h-0 flex-col pb-8 pt-6 lg:h-full lg:pt-9'
} as const;

const PageBody = ({ children, width = 'default', height = 'auto' }: PageBodyProps) => (
    <div className={`w-full px-5 sm:px-8 lg:px-10 ${MAX_WIDTH[width]} ${HEIGHT[height]}`}>
        {children}
    </div>
);

export default PageBody;
