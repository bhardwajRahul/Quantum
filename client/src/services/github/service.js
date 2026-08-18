import APIRequestBuilder from '@utilities/api/apiRequestBuilder';

export const GithubAPI = new APIRequestBuilder('/github');

export const createAccount = GithubAPI.register({
    path: '/',
    method: 'POST'
});