import { createSlice } from '@reduxjs/toolkit';
import * as reduxUtils from '@utilities/common/reduxUtils';

const state = {
    error: null,
    isLoading: true,
    isOperationLoading: false,
    stats: {},
    repositories: [],
    githubRepositories: [],
    selectedRepository: null,
    detectedPreset: null
};

const repositorySlice = createSlice({
    name: 'repository',
    initialState: state,
    reducers: {
        updateRepositories(state, action){
            const { repository, status } = action.payload;
            const repositories = state.repositories.map((stateRepo) => {
                if(stateRepo._id === repository._id){

                    if(!stateRepo.activeDeployment) stateRepo.activeDeployment = {};
                    stateRepo.activeDeployment.status = status;
                }
                return stateRepo;
            });
            state.repositories = repositories;
        },
        setState: reduxUtils.setState
    }
});

export const {
    setState,
    updateRepositories
} = repositorySlice.actions;

export default repositorySlice.reducer;