import * as deploymentService from '@services/deployment/service';
import * as deploymentSlice from '@services/deployment/slice';
import * as repositorySlice from '@services/repository/slice';
import createOperation from '@utilities/api/operationHandler';
import { setState as repoSetState } from '@services/repository/slice';

export const getRepositoryDeployments = (repositoryName) => async (dispatch) => {
    const operation = createOperation(deploymentSlice, dispatch);
    operation.use({
        api: deploymentService.getRepositoryDeployments,
        loaderState: 'isLoading',
        responseState: 'deployments',
        query: { params: { repositoryName } }
    });
};

export const deleteRepositoryDeployment = (repositoryName, deploymentId) => async (dispatch) => {
    const operation = createOperation(deploymentSlice, dispatch);
    operation.use({
        api: deploymentService.deleteRepositoryDeployment,
        loaderState: 'isOperationLoading',
        responseState: 'deployments',
        query: { params: { repositoryName, deploymentId } }
    });
};

export const getActiveDeploymentEnvironment = (repositoryAlias) => async (dispatch) => {
    const operation = createOperation(deploymentSlice, dispatch);

    operation.on('response', (data) => {
        data.variables = Object.entries(data.variables);
        dispatch(deploymentSlice.setState({
            path: 'environment',
            value: data
        }));
    });

    operation.use({
        api: deploymentService.getActiveDeploymentEnvironment,
        loaderState: 'isEnvironmentLoading',
        query: { params: { repositoryAlias } }
    });
};

export const updateDeployment = (id, body, navigate) => async (dispatch) => {
    const operation = createOperation(deploymentSlice, dispatch);
    operation.on('response', () => navigate('/dashboard/'));
    operation.use({
        api: deploymentService.updateDeployment,
        loaderState: 'isOperationLoading',
        query: { params: { id } },
        body
    });
};

export const repositoryActions = (repositoryAlias, body) => async (dispatch) => {
    const operation = createOperation(deploymentSlice, dispatch);
    dispatch(repoSetState({ path: 'isOperationLoading', value: true }));

    operation.on('response', ({ status, repository }) => {
        dispatch(repositorySlice.updateRepositories({ repository, status }));
    });

    operation.on('finally', () => {
        dispatch(repoSetState({ path: 'isOperationLoading', value: false }))
    });

    operation.use({
        api: deploymentService.repositoryOperations,
        query: { params: { repositoryAlias } },
        loaderState: 'isOperationLoading',
        body
    });
};