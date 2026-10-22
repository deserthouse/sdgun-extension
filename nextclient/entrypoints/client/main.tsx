import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TOKENS } from '../../lib/theme';
import { exposeTestSeam } from '../../lib/broker';
import App from './App';

exposeTestSeam();

const qc = new QueryClient();

// Query 全局契约（G1 起锁定）：变更零自动重试（缺口单第 5 项）、读取默认不重试。
qc.setDefaultOptions({
  queries: { retry: false },
  mutations: { retry: false },
});

const style = document.createElement('style');
style.textContent = TOKENS + "html,body{margin:0}#root{min-height:100vh}";
document.head.appendChild(style);
import './pages.css';
import { SessionProvider } from '../../lib/session';

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <SessionProvider>
        <App />
      </SessionProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
