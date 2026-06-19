/***
 * Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
 * Licensed under the MIT license. See LICENSE file in the project root
 * for full license information.
****/

import APIRequestBuilder from '@utilities/api/apiRequestBuilder';

const DockerContainerAPI = new APIRequestBuilder('/docker-container');

export const getMyDockerContainers = DockerContainerAPI.register({
    path: '/me/',
    method: 'GET'
});