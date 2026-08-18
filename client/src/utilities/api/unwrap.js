export const unwrapList = (response, fallback = []) => {
    if(Array.isArray(response?.data)) return response.data;
    if(Array.isArray(response)) return response;
    return fallback;
};
