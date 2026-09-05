import { Button } from '@heroui/react';
import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '@/shared/store/theme';

const ThemeToggle = () => {
    const theme = useThemeStore((state) => state.theme);
    const toggle = useThemeStore((state) => state.toggle);
    const isDark = theme === 'dark';

    return (
        <Button
            isIconOnly
            variant='ghost'
            size='sm'
            aria-label={isDark ? 'Switch to the light theme' : 'Switch to the dark theme'}
            onPress={toggle}
            className='size-8 rounded-lg text-muted'
        >
            {isDark ? <Sun className='size-4' /> : <Moon className='size-4' />}
        </Button>
    );
};

export default ThemeToggle;
