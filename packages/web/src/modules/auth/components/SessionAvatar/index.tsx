import { Link } from 'react-router-dom';
import Avatar from '@/shared/components/Avatar';
import { useSession } from '@/modules/auth/hooks/use-session';

const SessionAvatar = () => {
    const { user } = useSession();

    if(!user) return <span className='size-7 shrink-0 animate-pulse rounded-full bg-foreground/10' />;

    return (
        <Link
            to='/account'
            aria-label={`Account settings for ${user.fullname}`}
            className='rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground'
        >
            <Avatar fullname={user.fullname} />
        </Link>
    );
};

export default SessionAvatar;
