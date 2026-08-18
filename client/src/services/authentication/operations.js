import * as authService from '@services/authentication/service';
import * as authSlice from '@services/authentication/slice';
import createOperation from '@utilities/api/operationHandler';

const handleAuthResponse = (data, dispatch) => {
    if(!data) return;
    dispatch(authSlice.setState({ path: 'user', value: data.user }));
    dispatch(authSlice.setState({ path: 'authStatus.isAuthenticated', value: true }));
};

const runAuth = (api, body) => async (dispatch) => {
    const operation = createOperation(authSlice, dispatch);
    operation.on('response', (data) => handleAuthResponse(data, dispatch));
    operation.use({ api, loaderState: 'loadingStatus.isLoading', body });
};

export const getMyProfile = () => async (dispatch) => {
    const operation = createOperation(authSlice, dispatch);
    operation.on('response', (data) => dispatch(authSlice.setState({ path: 'user', value: data })));
    operation.use({
        api: authService.myProfile,
        loaderState: 'loadingStatus.isLoading'
    });
};

export const signUp = (body) => runAuth(authService.signUp, body);

export const signIn = (body) => runAuth(authService.signIn, body);

export const updateMyProfile = (body, navigate) => async (dispatch) => {

    const operation = createOperation(authSlice, dispatch);
    operation.on('response', (data) => {
        dispatch(authSlice.setState({ path: 'user', value: data }));
        navigate('/dashboard/');
    });
    operation.use({
        api: authService.updateMyProfile,
        loaderState: 'loadingStatus.isOperationLoading',
        body,
        query: {
            queryParams: { populate: 'github' }
        }
    });
};

export const deleteMyProfile = () => async (dispatch) => {
    const operation = createOperation(authSlice, dispatch);
    operation.on('response', () => window.location.href = '/');
    operation.use({
        api: authService.deleteMyProfile,
        loaderState: 'authStatus.isEliminatingAccount'
    });
};

export const updateMyPassword = (body, navigate) => async (dispatch) => {
    const operation = createOperation(authSlice, dispatch);
    operation.on('response', (data) => {
        handleAuthResponse(data, dispatch);
        navigate('/auth/account/');
    });
    operation.use({
        api: authService.updateMyPassword,
        loaderState: 'loadingStatus.isOperationLoading',
        body
    });
};

export const logout = () => async (dispatch) => {
    const operation = createOperation(authSlice, dispatch);
    operation.on('response', async () => {
        await dispatch(authSlice.setState({ path: 'authStatus.isLoading', value: false }));
        await dispatch(authSlice.setState({ path: 'authStatus.isAuthenticated', value: false }));
        await dispatch(authSlice.setState({ path: 'authStatus.isLoading', value: false }));
    });
    operation.use({
        api: authService.logout,
        loaderState: 'authStatus.isCachedAuthLoading'
    });
};