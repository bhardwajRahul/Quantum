import * as authSlice from '@services/authentication/slice';
import * as deploymentSlice from '@services/deployment/slice';
import * as githubSlice from '@services/github/slice';
import * as repositorySlice from '@services/repository/slice';
import * as coreSlice from '@services/core/slice';
import errorCodeHandler from '@services/core/errorCodeHandler';

const slices = [
    authSlice,
    deploymentSlice,
    githubSlice,
    repositorySlice,
    coreSlice
];

export const globalErrorHandler = (message, slice = null) => (dispatch) => {
    if(slice === null) return;

    const readableError = errorCodeHandler(message);

    dispatch(slice.setState({ path: 'error', value: readableError }));
};

export const resetErrorForAllSlices = () => (dispatch) => {
    for(const slice of slices){
        dispatch(slice.setState({ path: 'error', value: null }));
    }
};