import { create } from 'zustand';
import { applyTheme, readTheme } from '@/shared/utils/theme';
import type { Theme } from '@/shared/utils/theme';

export interface ThemeState{
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggle: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
    theme: readTheme(),
    setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
    },
    toggle: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark')
}));
