import React from 'react';
import ReactDOM from 'react-dom/client';
import Application from '@/Application.jsx';
import { MultiProvider } from 'react-pendulum';
import { BrowserRouter } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Provider } from 'react-redux';
import reduxStore from '@utilities/store';
import '@styles/general.css';

ReactDOM.createRoot(document.getElementById('QuantumCloud-ROOT')).render(
    <MultiProvider
        providers={[
            <AnimatePresence />,
            <BrowserRouter />,
            <Provider store={reduxStore} />
        ]}
    >
        <Application />
    </MultiProvider>
);