const KEY = 'qt-org';

export const readOrganizationId = (): number | null => {
    try{
        const stored = localStorage.getItem(KEY);
        if(stored === null) return null;

        const parsed = Number(stored);
        return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    }catch{
        return null;
    }
};

export const writeOrganizationId = (organizationId: number | null) => {
    try{
        if(organizationId === null) localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, String(organizationId));
    }catch{
        return;
    }
};
