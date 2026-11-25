import { useSyncExternalStore } from 'react';

// The one mobile breakpoint of the app: below 768px, the same width as Tailwind `md:`.
// Prefer Tailwind responsive classes; use this hook only where the markup itself must differ.
export const MOBILE_QUERY = '(max-width: 767.98px)';

const subscribe = (onChange) => {
  const mq = window.matchMedia(MOBILE_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
};

// One-off check for code that runs outside a component
export const isMobileNow = () => window.matchMedia(MOBILE_QUERY).matches;

const useIsMobile = () => useSyncExternalStore(subscribe, isMobileNow, () => false);

export default useIsMobile;
