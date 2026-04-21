import { useEffect, useState } from 'react';

// Returns true on devices with a fine pointer that supports hover (laptops,
// desktops). Returns false on touch-primary devices (phones, tablets in
// touch mode). Use to swap hover-revealed UI for always-visible / larger-tap-
// target equivalents — e.g. the sidebar unpin button.
//
// Listens for media-query changes so a Surface-style device that switches
// modes mid-session updates without a reload.
export function useHasHover() {
  const [hasHover, setHasHover] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return true;
    return window.matchMedia('(hover: hover)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(hover: hover)');
    const handler = (e) => setHasHover(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  return hasHover;
}
