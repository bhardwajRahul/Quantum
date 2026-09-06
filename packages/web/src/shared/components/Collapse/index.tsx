import type { ReactNode } from 'react';

interface CollapseProps{
    show: boolean;
    children: ReactNode;
}

const Collapse = ({ show, children }: CollapseProps) => (
    <div
        className={`grid transition-all duration-300 ease-out motion-reduce:transition-none ${
            show ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
    >
        <div className='overflow-hidden'>{children}</div>
    </div>
);

export default Collapse;
