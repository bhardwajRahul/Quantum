import * as githubService from '@services/github/service';
import * as githubSlice from '@services/github/slice';
import * as authSlice from '@services/authentication/slice';
import createOperation from '@utilities/api/operationHandler';

export const authenticate = async (userId) => {
    const Endpoint = `${import.meta.env.VITE_SERVER + import.meta.env.VITE_API_SUFFIX}/github/authenticate?userId=${userId}`;
    window.location.href = Endpoint;
};

export const createAccount = (body) => async (dispatch) => {
    const operation = createOperation(githubSlice, dispatch);
    operation.use({
        api: githubService.createAccount,
        loaderState: 'isLoading',
        responseState: {
            slice: authSlice,
            path: 'user.github'
        },
        body
    });
};