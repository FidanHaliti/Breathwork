import { useEffect, useRef, useState } from 'react';

function readSavedTheme() {
  try {
    const value = localStorage.getItem('breathwork.theme');
    return value === 'dark' || value === 'light' ? value : null;
  } catch { return null; }
}

export function useTheme() {
  const preference = useRef(readSavedTheme());
  const [theme, setTheme] = useState(() => preference.current || document.documentElement.dataset.theme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#141d19' : '#f7f8f2');
  }, [theme]);

  useEffect(() => {
    const system = window.matchMedia('(prefers-color-scheme: dark)');
    const followSystem = (event) => {
      if (!preference.current) setTheme(event.matches ? 'dark' : 'light');
    };
    system.addEventListener('change', followSystem);
    return () => system.removeEventListener('change', followSystem);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    preference.current = next;
    try { localStorage.setItem('breathwork.theme', next); } catch { /* Still works for this visit. */ }
    setTheme(next);
  };

  return { theme, toggleTheme };
}
