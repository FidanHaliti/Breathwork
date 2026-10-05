import React from 'react';
import { createRoot } from 'react-dom/client';
import BreathworkTimer from './BreathworkTimer';
import './styles.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><BreathworkTimer /></React.StrictMode>);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* The timer also works without offline caching. */ });
  });
}
