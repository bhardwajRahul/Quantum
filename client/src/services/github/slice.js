import { createSlice } from '@reduxjs/toolkit';
import * as reduxUtils from '@utilities/common/reduxUtils';

const state = {
    error: null,
    isLoading: false
};

const githubSlice = createSlice({
    name: 'github',
    initialState: state,
    reducers: {
        setState: reduxUtils.setState
    }
});

export const {
    setState
} = githubSlice.actions;

export default githubSlice.reducer;