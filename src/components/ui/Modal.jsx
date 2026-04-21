// Shared modal primitive. Every dialog in the app should render through this
// component so focus trapping, Escape handling, and aria-modal semantics live
// in exactly one place.
//
// Behavior:
//   • `role="dialog"` + `aria-modal="true"` + labelled by `title` (or an
//     explicit `aria-label` if the modal is title-less).
//   • Focus is moved into the modal on mount and restored to the previously
//     focused element on close.
//   • Tab / Shift-Tab loops inside the modal (focus trap).
//   • Escape closes unless `closeOnEscape={false}`.
//   • Backdrop click closes unless `closeOnBackdrop={false}`.
//   • Scroll lock on <body> while open.

import React, { useEffect, useRef, useCallback } from 'react';
import { COLORS } from '../../config/design-tokens';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export default function Modal({
  open,
  onClose,
  title,
  ariaLabel,
  children,
  width = 520,
  closeOnEscape = true,
  closeOnBackdrop = true,
  footer,
}) {
  const panelRef = useRef(null);
  const lastFocusedRef = useRef(null);

  const handleKeyDown = useCallback(
    (e) => {
      if (!panelRef.current) return;
      if (e.key === 'Escape' && closeOnEscape) {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = Array.from(
        panelRef.current.querySelectorAll(FOCUSABLE_SELECTOR),
      ).filter((el) => !el.hasAttribute('aria-hidden') && el.offsetParent !== null);
      if (focusables.length === 0) {
        e.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [closeOnEscape, onClose],
  );

  useEffect(() => {
    if (!open) return undefined;
    lastFocusedRef.current = document.activeElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Move focus to the first focusable element inside the panel, or the
    // panel itself if none.
    requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const first = panel.querySelector(FOCUSABLE_SELECTOR);
      (first || panel).focus();
    });

    return () => {
      document.body.style.overflow = originalOverflow;
      const prev = lastFocusedRef.current;
      if (prev && typeof prev.focus === 'function') prev.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && closeOnBackdrop) onClose?.();
      }}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={!title && ariaLabel ? ariaLabel : undefined}
        aria-labelledby={title ? 'modal-title' : undefined}
        tabIndex={-1}
        style={{
          background: COLORS.card,
          borderRadius: 10,
          width: '100%',
          maxWidth: width,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
          outline: 'none',
        }}
      >
        {title && (
          <div
            style={{
              padding: '14px 20px',
              borderBottom: `1px solid ${COLORS.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div id="modal-title" style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>
              {title}
            </div>
            <button
              onClick={onClose}
              aria-label="Close dialog"
              style={{
                background: 'none',
                border: 'none',
                color: COLORS.textMuted,
                cursor: 'pointer',
                fontSize: 22,
                padding: 4,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        )}
        <div style={{ padding: 20, overflow: 'auto', flex: 1 }}>{children}</div>
        {footer && (
          <div
            style={{
              padding: '12px 20px',
              borderTop: `1px solid ${COLORS.border}`,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
