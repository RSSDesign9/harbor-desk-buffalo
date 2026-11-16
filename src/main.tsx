// Global CSS first, so component stylesheets imported by App always come later in the cascade.
import './ui/fonts.css';
import './ui/tokens.css';
import './ui/base.css';
import './app/shell.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.tsx';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
