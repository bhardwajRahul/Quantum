import axios from 'axios';

/**
 * Attach the active organization to EVERY API request. The backend's resolveTenant
 * reads `x-organization-id` to scope the request to that org. On discovery routes
 * (org list/create) the header is ignored server-side, so a stale id never blocks
 * bootstrap. The id is persisted by the org switcher under the `qt-org`
 * localStorage key (services/tenancy/slice.js). Registered once as a global axios
 * request interceptor so every call — regardless of which builder issued it —
 * carries the header.
 */
if(!axios.__qtOrgInterceptor){
    axios.interceptors.request.use((config) => {
        try{
            const orgId = localStorage.getItem('qt-org');
            if(orgId){
                config.headers = config.headers || {};
                config.headers['x-organization-id'] = orgId;
            }
        }catch{ /* localStorage unavailable — backend resolves org from session */ }
        return config;
    });
    axios.__qtOrgInterceptor = true;
}

/**
 * Recover from a stale/foreign org selection. When the backend can't resolve the
 * requested org for the caller (e.g. a `qt-org` left over from a previous deploy
 * whose DB was wiped, or an org the user was removed from), scoped routes reply
 * with the message `Tenancy::Organization::Reconfigure`. The error envelope only
 * carries the message string to callers (register() flattens it), so we
 * detect it HERE, at the response-interceptor layer, clear the stale selection,
 * and reload — bootstrap then re-discovers the user's real orgs (or routes them to
 * the setup gate if they have none). The reload guard prevents a loop if clearing
 * the keys somehow doesn't change the outcome.
 */
if(!axios.__qtReconfigureInterceptor){
    axios.interceptors.response.use(
        (response) => {
            // A successful call means the current org selection works — clear the
            // recovery guard so a future stale-org event can trigger another reload.
            try{ sessionStorage.removeItem('qt-reconfiguring'); }catch{ /* noop */ }
            return response;
        },
        (error) => {
            try{
                const message = error?.response?.data?.message;
                if(message === 'Tenancy::Organization::Reconfigure'){
                    localStorage.removeItem('qt-org');
                    localStorage.removeItem('qt-project');
                    if(!sessionStorage.getItem('qt-reconfiguring')){
                        sessionStorage.setItem('qt-reconfiguring', '1');
                        window.location.assign('/');
                    }
                }
            }catch{ /* storage/window unavailable — fall through to normal rejection */ }
            return Promise.reject(error);
        }
    );
    axios.__qtReconfigureInterceptor = true;
}

class APIRequestBuilder{
    /**
     * Constructor for the APIRequestBuilder class.
     *
     * @param {string} baseEndpoint - The base endpoint for all API requests made through this instance.
    */
    constructor(baseEndpoint){
        this.baseEndpoint = baseEndpoint;
    }

    /**
     * Builds a complete URL for an API request with support for path and query parameters.
     *
     * @param {string} path - The path of the API resource, relative to the base endpoint.
     * @param {object} params - An object containing values for path parameters (e.g., :userId).
     * @param {object} queryParams - An object containing query parameters (e.g., ?fields=name).
     * @returns {string} - The constructed URL.
    */  
    buildUrl(path, params = {}, queryParams = {}){
        // Replace path parameters with their actual values
        const compiledPath = path.replace(/:([a-zA-Z0-9_]+)/g, (_, key) => {
            const param = params[key];
            if(param){
                return encodeURIComponent(param);
            }
            throw new Error(`Missing path parameter: ${key}`);
        });
        
        // Construct the base URL
        const baseUrl = `${import.meta.env.VITE_SERVER}${import.meta.env.VITE_API_SUFFIX}${this.baseEndpoint}${compiledPath}`;
        const url = new URL(baseUrl);
        
        // Append query parameters to the URL
        Object.keys(queryParams).forEach((key) => {
            if(queryParams[key] !== undefined){
                url.searchParams.append(key, queryParams[key]);
            }
        });
        return url.toString();
    }

    /**
     * Creates a flexible request builder function, allowing customization of HTTP methods and parameters.
     *
     * @param {object} config - Configuration for the request.
     * @param {string} config.path - The path of the API resource.
     * @param {string} [config.method='GET'] - The HTTP method (GET, POST, PUT, etc.).
     * @returns {function} - A function to further customize and execute the request.
    */
    register({ path, method = 'GET' }){
        return async ({ query = {}, body = {} }) => {
            const url = this.buildUrl(path, query.params, query.queryParams);
            try{
                const response = await axios({
                    method: method.toLowerCase(),
                    url,
                    data: body,
                    withCredentials: true
                });
                // Assuming Quantum Backend API consistency
                return response.data || response;
            }catch(error){
                throw error.response?.data?.message || error.message;
            }
        };
    }
}

export default APIRequestBuilder;