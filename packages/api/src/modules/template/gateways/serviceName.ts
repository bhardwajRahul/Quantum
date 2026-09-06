export const serviceNameOf = (payload: unknown): string | undefined => {
    if(typeof payload !== 'object' || payload === null) return undefined;
    const { service } = payload as { service?: unknown };
    return typeof service === 'string' && service.trim() !== '' ? service : undefined;
};
