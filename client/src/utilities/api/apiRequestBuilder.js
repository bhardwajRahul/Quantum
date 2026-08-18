import axios from 'axios';

if(!axios.__qtOrgInterceptor){
    axios.interceptors.request.use((config) => {
        try{
            const orgId = localStorage.getItem('qt-org');
            if(orgId){
                config.headers = config.headers || {};
                config.headers['x-organization-id'] = orgId;
            }
        }catch{   }
        return config;
    });
    axios.__qtOrgInterceptor = true;
}

if(!axios.__qtReconfigureInterceptor){
    axios.interceptors.response.use(
        (response) => {

            try{ sessionStorage.removeItem('qt-reconfiguring'); }catch{   }
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
            }catch{   }
            return Promise.reject(error);
        }
    );
    axios.__qtReconfigureInterceptor = true;
}

class APIRequestBuilder{

    constructor(baseEndpoint){
        this.baseEndpoint = baseEndpoint;
    }

    buildUrl(path, params = {}, queryParams = {}){

        const compiledPath = path.replace(/:([a-zA-Z0-9_]+)/g, (_, key) => {
            const param = params[key];
            if(param){
                return encodeURIComponent(param);
            }
            throw new Error(`Missing path parameter: ${key}`);
        });

        const baseUrl = `${import.meta.env.VITE_SERVER}${import.meta.env.VITE_API_SUFFIX}${this.baseEndpoint}${compiledPath}`;
        const url = new URL(baseUrl);

        Object.keys(queryParams).forEach((key) => {
            if(queryParams[key] !== undefined){
                url.searchParams.append(key, queryParams[key]);
            }
        });
        return url.toString();
    }

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

                return response.data || response;
            }catch(error){
                throw error.response?.data?.message || error.message;
            }
        };
    }
}

export default APIRequestBuilder;