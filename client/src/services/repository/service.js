import APIRequestBuilder from '@utilities/api/apiRequestBuilder';

export const RepositoryAPI = new APIRequestBuilder('/repository');

export const getMyGithubRepositories = RepositoryAPI.register({
    path: '/me/github/',
    method: 'GET'
});

export const detectFramework = RepositoryAPI.register({
    path: '/me/github/:owner/:repo/detect/',
    method: 'GET'
});

export const createRepository = RepositoryAPI.register({
    path: '/',
    method: 'POST'
});

export const updateRepository = RepositoryAPI.register({
    path: '/:id/',
    method: 'PATCH'
});

export const deleteRepository = RepositoryAPI.register({
    path: '/:id/',
    method: 'DELETE'
});

export const getRepositories = RepositoryAPI.register({
    path: '/me/',
    method: 'GET'
});