import { createSlice } from '@reduxjs/toolkit';

const STORAGE_KEY = 'qt-theme';

export const DARK = 'g100';
export const LIGHT = 'white';

const resolveInitialTheme = () => {
    try{
        const saved = localStorage.getItem(STORAGE_KEY);
        if(saved === DARK || saved === LIGHT) return saved;
    }catch{

    }
    try{
        if(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches){
            return LIGHT;
        }
    }catch{

    }
    return DARK;
};

const persist = (theme) => {
    try{
        localStorage.setItem(STORAGE_KEY, theme);
    }catch{

    }
};

const themeSlice = createSlice({
    name: 'theme',
    initialState: {

        theme: resolveInitialTheme()
    },
    reducers: {
        setTheme: (state, action) => {
            state.theme = action.payload === LIGHT ? LIGHT : DARK;
            persist(state.theme);
        },
        toggleTheme: (state) => {
            state.theme = state.theme === DARK ? LIGHT : DARK;
            persist(state.theme);
        }
    }
});

export const { setTheme, toggleTheme } = themeSlice.actions;
export default themeSlice.reducer;
