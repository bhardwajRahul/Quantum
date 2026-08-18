import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import Application from '@/Application.jsx';
import { BrowserRouter } from 'react-router-dom';
import { Provider, useSelector } from 'react-redux';
import reduxStore from '@utilities/store';
import { DARK } from '@services/core/themeSlice';
import { Toaster } from '@/components/ui/sonner';
import '@styles/app.css';

const ThemedApp = () => {
    const theme = useSelector((state) => state.theme.theme);

    useEffect(() => {
        const root = document.documentElement;
        if(theme === DARK) root.classList.add('dark');
        else root.classList.remove('dark');
    }, [theme]);

    return (
        <>
            <Application />
            <Toaster position='top-right' richColors closeButton />
        </>
    );
};

ReactDOM.createRoot(document.getElementById('QuantumCloud-ROOT')).render(
    <Provider store={reduxStore}>
        <BrowserRouter>
            <ThemedApp />
        </BrowserRouter>
    </Provider>
);
