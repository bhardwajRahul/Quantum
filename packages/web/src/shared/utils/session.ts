const KEY = 'quantum.session';

export const readToken = (): string | null => {
    try{
        return localStorage.getItem(KEY);
    }catch{
        return null;
    }
};

export const writeToken = (token: string | null) => {
    try{
        if(token === null) localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, token);
    }catch{
        return;
    }
};
