// frontend/src/utils/usePolling.js
// Run `fn` now, then every `ms` while the tab is visible. Hidden tabs make no requests;
// when the tab becomes visible again it refreshes once right away. Cleared on unmount.
import { useEffect, useRef } from 'react';

export default function usePolling(fn, ms, enabled = true) {
  const saved = useRef(fn);
  saved.current = fn;

  useEffect(() => {
    if (!enabled) return undefined;
    const run = () => saved.current();
    run();
    const id = setInterval(() => { if (!document.hidden) run(); }, ms);
    const onVisible = () => { if (!document.hidden) run(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [ms, enabled]);
}
