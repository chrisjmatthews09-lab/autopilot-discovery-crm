// Promise-based replacement for `window.confirm`. Renders a Modal with
// Confirm/Cancel buttons and resolves to `true` / `false`. Unlike native
// confirm() this preserves focus trapping, matches the app's styling, and
// never blocks the event loop.
//
// Usage:
//   const confirm = useConfirm();
//   const ok = await confirm({ title: 'Delete interview?', description: '…' });
//   if (!ok) return;
//
// The provider (`ConfirmProvider`) mounts once near the top of the tree.

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import Modal from './Modal';
import { COLORS } from '../../config/design-tokens';

const ConfirmCtx = createContext(null);

export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx.confirm;
}

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolverRef = useRef(null);

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState({
        title: options.title || 'Are you sure?',
        description: options.description || '',
        confirmLabel: options.confirmLabel || 'Confirm',
        cancelLabel: options.cancelLabel || 'Cancel',
        destructive: Boolean(options.destructive),
      });
    });
  }, []);

  const close = (value) => {
    setState(null);
    const resolve = resolverRef.current;
    resolverRef.current = null;
    if (resolve) resolve(value);
  };

  const ctxValue = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmCtx.Provider value={ctxValue}>
      {children}
      <Modal
        open={Boolean(state)}
        onClose={() => close(false)}
        title={state?.title}
        width={440}
        footer={
          <>
            <button
              onClick={() => close(false)}
              style={{
                padding: '8px 14px',
                background: 'none',
                color: COLORS.text,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              {state?.cancelLabel}
            </button>
            <button
              onClick={() => close(true)}
              style={{
                padding: '8px 14px',
                background: state?.destructive ? COLORS.error : COLORS.primary,
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {state?.confirmLabel}
            </button>
          </>
        }
      >
        {state?.description && (
          <div style={{ fontSize: 14, color: COLORS.textMuted, lineHeight: 1.5 }}>
            {state.description}
          </div>
        )}
      </Modal>
    </ConfirmCtx.Provider>
  );
}
