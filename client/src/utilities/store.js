import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@services/authentication/slice';
import githubReducer from '@services/github/slice';
import repositoryReducer from '@services/repository/slice';
import deploymentReducer from '@services/deployment/slice';
import coreReducer from '@services/core/slice';
import toastReducer from '@services/core/toastSlice';
import themeReducer from '@services/core/themeSlice';
import tenancyReducer from '@services/tenancy/slice';
import activityReducer from '@services/activity/slice';

const store = configureStore({
    reducer: {
        core: coreReducer,
        auth: authReducer,
        github: githubReducer,
        repository: repositoryReducer,
        deployment: deploymentReducer,
        toast: toastReducer,
        theme: themeReducer,
        tenancy: tenancyReducer,
        activity: activityReducer
    }
});

export default store;