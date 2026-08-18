import { createSlice } from '@reduxjs/toolkit';

const ORG_KEY = 'qt-org';
const PROJECT_KEY = 'qt-project';

const readKey = (key) => {
    try{ return localStorage.getItem(key) || ''; }catch{ return ''; }
};
const writeKey = (key, value) => {
    try{
        if(value) localStorage.setItem(key, value);
        else localStorage.removeItem(key);
    }catch{

    }
};

const initialState = {
    organizations: [],

    projects: [],

    organizationId: readKey(ORG_KEY),
    projectId: readKey(PROJECT_KEY),

    isLoading: true,
    error: null
};

const tenancySlice = createSlice({
    name: 'tenancy',
    initialState,
    reducers: {
        setOrganizations: (state, action) => {
            state.organizations = action.payload || [];
        },
        setProjects: (state, action) => {
            state.projects = action.payload || [];
        },
        selectOrganization: (state, action) => {
            state.organizationId = action.payload || '';
            writeKey(ORG_KEY, state.organizationId);

            state.projectId = '';
            writeKey(PROJECT_KEY, '');
            state.projects = [];
        },
        selectProject: (state, action) => {
            state.projectId = action.payload || '';
            writeKey(PROJECT_KEY, state.projectId);
        },
        setLoading: (state, action) => {
            state.isLoading = !!action.payload;
        },
        setError: (state, action) => {
            state.error = action.payload || null;
        }
    }
});

export const {
    setOrganizations, setProjects, selectOrganization, selectProject,
    setLoading, setError
} = tenancySlice.actions;

export default tenancySlice.reducer;
