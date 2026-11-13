import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './platform/theme.css';
import App from './App';
import { ToastProvider } from './platform/ui';

createRoot(document.getElementById('root')!).render(<StrictMode><ToastProvider><App /></ToastProvider></StrictMode>);
