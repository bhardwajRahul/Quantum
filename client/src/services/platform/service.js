import APIRequestBuilder from '@utilities/api/apiRequestBuilder';

const organizationApi = new APIRequestBuilder('/organization');
export const organizations = {
    list: organizationApi.register({ path: '/', method: 'GET' }),
    get: organizationApi.register({ path: '/:id/', method: 'GET' }),
    create: organizationApi.register({ path: '/', method: 'POST' }),
    update: organizationApi.register({ path: '/:id/', method: 'PATCH' }),
    remove: organizationApi.register({ path: '/:id/', method: 'DELETE' })
};

const projectApi = new APIRequestBuilder('/project');
export const projects = {
    listByOrg: projectApi.register({ path: '/organization/:orgId/', method: 'GET' }),
    createInOrg: projectApi.register({ path: '/organization/:orgId/', method: 'POST' }),
    get: projectApi.register({ path: '/:id/', method: 'GET' }),
    update: projectApi.register({ path: '/:id/', method: 'PATCH' }),
    remove: projectApi.register({ path: '/:id/', method: 'DELETE' })
};

const environmentApi = new APIRequestBuilder('/environment');
export const environments = {
    listByProject: environmentApi.register({ path: '/project/:projectId/', method: 'GET' }),
    createInProject: environmentApi.register({ path: '/project/:projectId/', method: 'POST' }),
    get: environmentApi.register({ path: '/:id/', method: 'GET' }),
    update: environmentApi.register({ path: '/:id/', method: 'PATCH' }),
    remove: environmentApi.register({ path: '/:id/', method: 'DELETE' })
};

const membershipApi = new APIRequestBuilder('/membership');
export const memberships = {
    listByOrg: membershipApi.register({ path: '/organization/:orgId/members/', method: 'GET' }),
    invite: membershipApi.register({ path: '/organization/:orgId/members/', method: 'POST' }),
    updateRole: membershipApi.register({ path: '/organization/:orgId/members/:id/', method: 'PATCH' }),
    remove: membershipApi.register({ path: '/organization/:orgId/members/:id/', method: 'DELETE' })
};

const databaseApi = new APIRequestBuilder('/database');
export const databases = {
    listByProject: databaseApi.register({ path: '/project/:projectId/', method: 'GET' }),
    createInProject: databaseApi.register({ path: '/project/:projectId/', method: 'POST' }),
    get: databaseApi.register({ path: '/:id/', method: 'GET' }),
    remove: databaseApi.register({ path: '/:id/', method: 'DELETE' }),
    backup: databaseApi.register({ path: '/:id/backup/', method: 'POST' }),
    restore: databaseApi.register({ path: '/:id/restore/', method: 'POST' }),
    connectionString: databaseApi.register({ path: '/:id/connection-string/', method: 'GET' })
};

const domainApi = new APIRequestBuilder('/domain');
export const domains = {
    listByRepository: domainApi.register({ path: '/repository/:repositoryId/', method: 'GET' }),
    createForRepository: domainApi.register({ path: '/repository/:repositoryId/', method: 'POST' }),
    get: domainApi.register({ path: '/:id/', method: 'GET' }),
    update: domainApi.register({ path: '/:id/', method: 'PATCH' }),
    remove: domainApi.register({ path: '/:id/', method: 'DELETE' })
};

const metricApi = new APIRequestBuilder('/metric');
export const metrics = {
    byContainer: metricApi.register({ path: '/container/:containerId/', method: 'GET' }),
    byRepository: metricApi.register({ path: '/repository/:repositoryId/', method: 'GET' })
};

const templateApi = new APIRequestBuilder('/template');
export const templates = {
    list: templateApi.register({ path: '/', method: 'GET' }),
    categories: templateApi.register({ path: '/categories/', method: 'GET' }),
    get: templateApi.register({ path: '/:id/', method: 'GET' }),
    installInProject: templateApi.register({ path: '/project/:projectId/install/', method: 'POST' })
};

const templateInstallApi = new APIRequestBuilder('/template-install');
export const templateInstalls = {
    listByProject: templateInstallApi.register({ path: '/project/:projectId/', method: 'GET' }),
    get: templateInstallApi.register({ path: '/:id/', method: 'GET' }),
    remove: templateInstallApi.register({ path: '/:id/', method: 'DELETE' })
};

const serverApi = new APIRequestBuilder('/server');
export const server = {
    health: serverApi.register({ path: '/health/', method: 'GET' }),
    ip: serverApi.register({ path: '/ip/', method: 'GET' })
};

export const repositoryRollback = new APIRequestBuilder('/repository')
    .register({ path: '/:id/rollback/:deploymentId/', method: 'POST' });

const analyticsApi = new APIRequestBuilder('/analytics');
export const analytics = {
    summary: analyticsApi.register({ path: '/summary/', method: 'GET' }),
    top: analyticsApi.register({ path: '/top/', method: 'GET' }),
    domains: analyticsApi.register({ path: '/domains/', method: 'GET' })
};

const usageApi = new APIRequestBuilder('/usage');
export const usage = {
    network: usageApi.register({ path: '/network', method: 'GET' }),
    resources: usageApi.register({ path: '/resources', method: 'GET' })
};

const codespaceApi = new APIRequestBuilder('/codespace');
export const codespaces = {
    listByProject: codespaceApi.register({ path: '/project/:projectId/', method: 'GET' }),
    createInProject: codespaceApi.register({ path: '/project/:projectId/', method: 'POST' }),
    get: codespaceApi.register({ path: '/:id/', method: 'GET' }),
    access: codespaceApi.register({ path: '/:id/access/', method: 'GET' }),
    remove: codespaceApi.register({ path: '/:id/', method: 'DELETE' })
};

const activityApi = new APIRequestBuilder('/activity');
export const activity = {
    list: activityApi.register({ path: '/', method: 'GET' })
};
