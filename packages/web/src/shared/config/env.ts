const apiUrl = import.meta.env.VITE_API_URL
    ?? `${import.meta.env.VITE_SERVER ?? ''}${import.meta.env.VITE_API_SUFFIX ?? '/api/v1'}`;

export const env = { apiUrl } as const;
