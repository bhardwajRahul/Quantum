import Collapse from '@/shared/components/Collapse';
import type { ReactNode } from 'react';

interface RevealProps{
    show: boolean;
    children: ReactNode;
}

const Reveal = ({ show, children }: RevealProps) => (
    <Collapse show={show}>
        <div className='flex flex-col gap-4 pt-4'>{children}</div>
    </Collapse>
);

export default Reveal;
