import type { ReactNode } from 'react';

interface CenterStateProps{
    children: ReactNode;
    className?: string;
}

const CenterState = ({ children, className = 'flex-1' }: CenterStateProps) => (
    <div className={`flex items-center justify-center ${className}`}>{children}</div>
);

export default CenterState;
