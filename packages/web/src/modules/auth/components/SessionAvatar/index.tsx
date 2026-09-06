import { Link } from 'react-router-dom';
import { useSession } from '@/modules/auth/hooks/use-session';

interface SessionAvatarProps{
    collapsed?: boolean;
}

const SessionAvatar = ({ collapsed = false }: SessionAvatarProps) => {
    const { user } = useSession();

    if(collapsed) return null;
    if(!user) return <span className='hidden h-3 w-20 animate-pulse rounded-md bg-default lg:inline-block' />;

    return (
        <Link
            to='/account'
            aria-label={`Account settings for ${user.fullname}`}
            className='hidden min-w-0 truncate rounded-md px-2 text-sm text-muted transition-colors hover:text-foreground focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-foreground motion-reduce:transition-none lg:inline'
        >
            {user.username}
        </Link>
    );
};

export default SessionAvatar;
