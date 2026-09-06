interface AvatarProps{
    fullname: string;
    className?: string;
}

const initialsOf = (fullname: string): string => {
    const parts = fullname.trim().split(/\s+/).filter((part) => part !== '');
    if(parts.length === 0) return '?';

    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
    return `${first}${last}`.toUpperCase();
};

const Avatar = ({ fullname, className = 'size-9' }: AvatarProps) => (
    <span
        aria-hidden='true'
        className={`label-caps flex shrink-0 items-center justify-center rounded-md border border-border text-[0.625rem] text-foreground ${className}`}
    >
        {initialsOf(fullname)}
    </span>
);

export default Avatar;
