import { globalErrorHandler } from '@services/core/operations';
import { errorTrackingMiddleware, timingMiddleware } from '@utilities/api/middlewares';
import EventManager from '@utilities/api/eventManager';

class OperationHandler extends EventManager{

    constructor(slice, dispatch, middlewares = []){
        super();
        this.slice = slice;
        this.dispatch = dispatch;
        this.middlewares = middlewares;
    }

    applyMiddlewares(config){
        return this.middlewares.reduce((modifiedConfig, middleware) => {
            return middleware(modifiedConfig);
        }, config);
    }

    updateState(state, value){
        if(typeof state === 'string'){
            this.dispatch(this.slice.setState({ path: state, value }));
        }else if(state?.slice && state?.path){
            this.dispatch(state.slice.setState({ path: state.path, value }));
        }
    }

    async use(config){
        const modifiedConfig = this.applyMiddlewares(config);
        const { api, loaderState, responseState, statsState, query = {}, body = {} } = modifiedConfig;
        try{
            if(loaderState) this.updateState(loaderState, true);
            const { data, page, results } = await api({ query, body });
            this.emit('response', data);
            if(responseState) this.updateState(responseState, data);
            if(statsState) this.updateState(statsState, { page, results });
        }catch(error){
            this.dispatch(globalErrorHandler(error, this.slice));
            this.emit('error', error);
        }finally{
            if(loaderState) this.updateState(loaderState, false);
            this.emit('finally');
        }
    }
}

const createOperation = (slice, dispatch, middlewares = []) => {
    if(import.meta.env.DEV){
        middlewares.push(errorTrackingMiddleware, timingMiddleware);
    }
    return new OperationHandler(slice, dispatch, middlewares);
}

export default createOperation;