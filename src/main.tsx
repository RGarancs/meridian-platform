import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './platform/theme.css';
import App from './App';
import { ContextMenuProvider, ToastProvider } from './platform/ui';

createRoot(document.getElementById('root')!).render(<StrictMode><ToastProvider><ContextMenuProvider><App /></ContextMenuProvider></ToastProvider></StrictMode>);
