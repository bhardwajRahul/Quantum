import APIRequestBuilder from '@utilities/api/apiRequestBuilder';

const DockerContainerAPI = new APIRequestBuilder('/docker-container');

export const getMyDockerContainers = DockerContainerAPI.register({
    path: '/me/',
    method: 'GET'
});