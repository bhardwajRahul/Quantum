import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import '@/assets/styles/index.css';
import { initTheme } from '@/shared/utils/theme';
import ErrorBoundary from '@/shared/components/ErrorBoundary';
import { router } from '@/app/router';

initTheme();

const rootElement = document.getElementById('root');
if(rootElement === null) throw new Error('Root element not found');

createRoot(rootElement).render(
    <StrictMode>
        <ErrorBoundary>
            <RouterProvider router={router} />
        </ErrorBoundary>
    </StrictMode>
);
