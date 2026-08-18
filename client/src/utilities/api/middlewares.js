const getResponseStateId = (config) => {
    const id = config?.responseState?.toString() || 'Unknown';
    return id;
}

export const timingMiddleware = (config) => {
    const startTime = Date.now();
    const id = getResponseStateId(config);
    return {
        ...config,
        api: async (query) => {
            const result = await config.api(query);
            const endTime = Date.now();
            console.log(`${id} - API call took: ${endTime - startTime}ms`);
            return result;
        }
    };
};

export const errorTrackingMiddleware = (config) => {
    const id = getResponseStateId(config);
    return {
        ...config,
        api: async (query) => {
            try{
                return await config.api(query);
            }catch(error){
                console.error(`${id} - Error caught in middleware:`, error);
                throw error;
            }
        }
    };
};