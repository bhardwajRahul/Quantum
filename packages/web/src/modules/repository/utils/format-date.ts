const formatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });

export const formatDate = (iso: string): string => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? '—' : formatter.format(date);
};
