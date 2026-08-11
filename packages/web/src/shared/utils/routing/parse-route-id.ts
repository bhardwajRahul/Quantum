export const parseRouteId = (raw: string | undefined): number | undefined => {
    if(raw === undefined || !/^\d+$/.test(raw)) return undefined;

    const id = Number(raw);
    return Number.isSafeInteger(id) && id > 0 ? id : undefined;
};
