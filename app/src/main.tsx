import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './styles/global.css';
import { initDefaults, requestPersistentStorage } from './db/db';
import { seedDemoLesson } from './lib/demoLesson';
import { initTts } from './lib/tts';

requestPersistentStorage();
initTts();
initDefaults().then(seedDemoLesson);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
