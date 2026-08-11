import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface BackLinkShape{
    label: string;
    className?: string;
}

type BackLinkProps = BackLinkShape
    & ({ to: string; onPress?: never } | { onPress: () => void; to?: never });

const STYLE = 'inline-flex w-fit items-center gap-1.5 text-[0.8125rem] text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground motion-reduce:transition-none';

const BackLink = ({ to, label, className = 'mb-5', onPress }: BackLinkProps) => {
    const arrow = <ArrowLeft className='size-4' aria-hidden='true' />;

    if(onPress !== undefined){
        return (
            <button type='button' className={`${className} ${STYLE}`} onClick={onPress}>
                {arrow}
                {label}
            </button>
        );
    }

    return (
        <Link to={to ?? ''} className={`${className} ${STYLE}`}>
            {arrow}
            {label}
        </Link>
    );
};

export default BackLink;
