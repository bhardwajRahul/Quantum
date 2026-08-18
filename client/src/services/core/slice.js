import { createSlice } from '@reduxjs/toolkit';
import * as reduxUtils from '@utilities/common/reduxUtils';

const state = {
    errors: [],
    error: null
};

const coreSlice = createSlice({
    name: 'core',
    initialState: state,
    reducers: {
        setState: reduxUtils.setState
    }
});

export const {
    setState
} = coreSlice.actions;

export default coreSlice.reducer;