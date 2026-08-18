import * as repositoryService from '@services/repository/service';
import * as repositorySlice from '@services/repository/slice';
import { getMyProfile } from '@services/authentication/operations';
import createOperation from '@utilities/api/operationHandler';

export const createRepository = (body, navigate) => async (dispatch) => {
    const operation = createOperation(repositorySlice, dispatch);

    operation.on('response', (data) => {

        const jobParam = data?.jobId ? `?job=${data.jobId}` : '';
        navigate(`/repository/${data.alias}/deployments/${jobParam}`);
    });

    operation.on('finally', () => {
        dispatch(getMyProfile());
    });

    operation.use({
        api: repositoryService.createRepository,
        loaderState: 'isOperationLoading',
        responseState: 'selectedRepository',
        body
    });
};

export const getRepositories = (setLoaderState = true) => async (dispatch) => {
    const operation = createOperation(repositorySlice, dispatch);
    operation.use({
        api: repositoryService.getRepositories,
        loaderState: setLoaderState ? 'isLoading' : null,
        responseState: 'repositories',
        statsState: 'stats'
    });
};

export const getMyGithubRepositories = () => async (dispatch) => {
    const operation = createOperation(repositorySlice, dispatch);
    operation.use({
        api: repositoryService.getMyGithubRepositories,
        loaderState: 'isLoading',
        responseState: 'githubRepositories'
    });
};

export const detectFramework = (owner, repo) => async (dispatch) => {
    const operation = createOperation(repositorySlice, dispatch);
    operation.use({
        api: repositoryService.detectFramework,
        loaderState: 'isOperationLoading',
        responseState: 'detectedPreset',
        query: { params: { owner, repo } }
    });
};

export const updateRepository = (id, body, navigate) => async (dispatch) => {
    const operation = createOperation(repositorySlice, dispatch);
    operation.on('response', () => navigate('/dashboard/'));
    operation.use({
        api: repositoryService.updateRepository,
        loaderState: 'isOperationLoading',
        query: { params: { id } },
        body
    });
};

export const deleteRepository = (id, repositories, navigate) => async (dispatch) => {
    const operation = createOperation(repositorySlice, dispatch);

    operation.on('finally', () => {
        const updatedRepositories = repositories.filter((repository) => repository._id !== id);
        dispatch(repositorySlice.setState({
            path: 'repositories',
            value: updatedRepositories
        }))
        navigate('/dashboard/');
        dispatch(getMyProfile());
    });

    operation.use({
        api: repositoryService.deleteRepository,
        loaderState: 'isOperationLoading',
        query: { params: { id } }
    });
};
