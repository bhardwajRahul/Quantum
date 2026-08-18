import * as authService from '@services/authentication/service';
import * as authSlice from '@services/authentication/slice';
import * as coreOperations from '@services/core/operations';

export const authenticateWithCachedToken = async (dispatch) => {
    try{
        await dispatch(authSlice.setState({ path: 'authStatus.isCachedAuthLoading', value: true }));
        const authenticatedUser = await authService.myProfile({});
        dispatch(authSlice.setState({ path: 'user', value: authenticatedUser.data }));
        dispatch(authSlice.setState({ path: 'authStatus.isAuthenticated', value: true }));
    }catch(error){
        if(!document.cookie.includes('jwt=')) return;
        dispatch(coreOperations.globalErrorHandler(error, authSlice));
    }finally{
        dispatch(authSlice.setState({ path: 'authStatus.isCachedAuthLoading', value: false }));
    }
};