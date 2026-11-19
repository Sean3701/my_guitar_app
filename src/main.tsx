import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { ensureSafeAreaTop } from './lib/safe-area';
import './styles.css';

ensureSafeAreaTop();

const baseUrl = import.meta.env.BASE_URL;
const basename = baseUrl.replace(/\/$/, '') || '/';

// 桌面端（WebView2）直接打开 /score/xxx 这类深链时磁盘上没有对应文件，
// 外壳会先落到 index.html?path=/score/xxx，这里把地址还原成真实路由再挂载。
const deepLink = new URLSearchParams(window.location.search).get('path');
if (deepLink && deepLink.startsWith('/')) {
  window.history.replaceState(null, '', `${baseUrl.replace(/\/$/, '')}${deepLink}`);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter basename={basename}>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register(`${baseUrl}sw.js`));
}
