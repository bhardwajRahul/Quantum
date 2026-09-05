import { create } from 'zustand';
import { applyTheme, readTheme } from '@/shared/utils/theme';
import type { Theme } from '@/shared/utils/theme';

export interface ThemeState{
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggle: () => void;
}

/**
 * The store owns nothing but the current value: `applyTheme` is what writes the class,
 * the data attribute and localStorage, and it was already the single place doing that
 * before anything needed to re-render on a change.
 */
export const useThemeStore = create<ThemeState>((set, get) => ({
    theme: readTheme(),
    setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
    },
    toggle: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark')
}));
