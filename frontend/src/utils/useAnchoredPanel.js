import { useEffect, useLayoutEffect, useRef } from 'react';
import { isMobileNow } from './useIsMobile';

// Keeps a floating panel (rendered with createPortal, className "fixed") next to its anchor, so it is
// not cut off by a scrolling table or dialog. Opens upwards when there is no room below; full width
// on phones. Also closes it on Esc and on a click outside.
const EDGE = 8; // px kept free to the screen edges
const GAP = 4; // px between anchor and panel

const useAnchoredPanel = (open, anchorRef, panelRef, onClose, { minWidth = 320, maxHeight = 420 } = {}) => {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });

  useLayoutEffect(() => {
    if (!open) return undefined;

    const place = () => {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (!anchor || !panel) return;
      const a = anchor.getBoundingClientRect();
      const vv = window.visualViewport; // smaller than the window while a phone keyboard is open
      const top = (vv?.offsetTop || 0) + EDGE;
      const bottom = (vv?.offsetTop || 0) + (vv?.height || window.innerHeight) - EDGE;
      const screenW = document.documentElement.clientWidth;

      const mobile = isMobileNow();
      const width = mobile ? screenW - 2 * EDGE : Math.min(Math.max(a.width, minWidth), screenW - 2 * EDGE);
      const below = bottom - a.bottom - GAP;
      const above = a.top - GAP - top;
      const up = below < 300 && above > below;
      // on phones it may cover its anchor rather than shrink to a few rows
      const room = Math.min(maxHeight, bottom - top, Math.max(up ? above : below, mobile ? maxHeight : 240));

      panel.style.width = `${width}px`;
      panel.style.left = `${Math.max(EDGE, Math.min(a.left, screenW - width - EDGE))}px`;
      panel.style.maxHeight = `${room}px`;
      // opened upwards it keeps its height, so the search box does not move while the list shrinks
      panel.style.height = up ? `${room}px` : 'auto';
      const height = panel.offsetHeight;
      const y = up ? a.top - GAP - height : a.bottom + GAP;
      panel.style.top = `${Math.max(top, Math.min(y, bottom - height))}px`;
    };

    place();
    const observer = new ResizeObserver(place);
    if (anchorRef.current) observer.observe(anchorRef.current);
    if (panelRef.current) observer.observe(panelRef.current);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    window.visualViewport?.addEventListener('resize', place);
    window.visualViewport?.addEventListener('scroll', place);

    const onPointerDown = (e) => {
      if (panelRef.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return;
      closeRef.current();
    };
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      closeRef.current();
      anchorRef.current?.querySelector('[data-panel-trigger]')?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('scroll', place);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open, anchorRef, panelRef, minWidth, maxHeight]);
};

export default useAnchoredPanel;
