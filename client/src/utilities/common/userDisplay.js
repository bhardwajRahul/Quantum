export const userName = (user) =>
    (user && typeof user === 'object' && (user.fullname || user.username || user.email)) || '—';

export const userEmail = (user) =>
    (user && typeof user === 'object' && user.email) || '—';
