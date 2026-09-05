interface AvatarProps{
    fullname: string;
    className?: string;
}

/**
 * Initials, not an image: the user record carries no avatar, so a broken image slot or a
 * generic silhouette would say less than the person's own initials.
 */
const initialsOf = (fullname: string): string => {
    const parts = fullname.trim().split(/\s+/).filter((part) => part !== '');
    if(parts.length === 0) return '?';

    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
    return `${first}${last}`.toUpperCase();
};

const Avatar = ({ fullname, className = 'size-7' }: AvatarProps) => (
    <span
        aria-hidden='true'
        className={`flex shrink-0 items-center justify-center rounded-full bg-foreground/[0.08] text-[0.6875rem] font-medium text-foreground ${className}`}
    >
        {initialsOf(fullname)}
    </span>
);

export default Avatar;
