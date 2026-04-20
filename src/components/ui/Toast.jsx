import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { COLORS } from '../../config/design-tokens';

const ToastContext = createContext({ push: () => {}, remove: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let _id = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const remove = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const push = useCallback((message, { kind = 'info', duration = 3500 } = {}) => {
    const id = ++_id;
    setToasts((list) => [...list, { id, message, kind }]);
    timers.current[id] = setTimeout(() => remove(id), duration);
    return id;
  }, [remove]);

  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout); }, []);

  const ctx = { push, remove, success: (m, o) => push(m, { ...(o || {}), kind: 'success' }), error: (m, o) => push(m, { ...(o || {}), kind: 'error' }), info: (m, o) => push(m, { ...(o || {}), kind: 'info' }) };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div style={{ position: 'fixed', bottom: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 9999, pointerEvents: 'none' }}>
        {toasts.map((t) => <ToastItem key={t.id} toast={t} onDismiss={() => remove(t.id)} />)}
      </div>
    </ToastContext.Provider>
  );
}

const KIND_STYLE = {
  success: { bg: '#16A34A', fg: '#fff', icon: '✓' },
  error:   { bg: '#DC2626', fg: '#fff', icon: '✕' },
  info:    { bg: COLORS.text, fg: '#fff', icon: 'i' },
};

function ToastItem({ toast, onDismiss }) {
  const s = KIND_STYLE[toast.kind] || KIND_STYLE.info;
  return (
    <div style={{ pointerEvents: 'auto', background: s.bg, color: s.fg, padding: '10px 14px', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.15)', fontSize: 13, fontWeight: 500, minWidth: 240, maxWidth: 360, display: 'flex', alignItems: 'center', gap: 10, animation: 'toast-in 0.2s ease-out' }}>
      <span style={{ fontSize: 14, fontWeight: 700, opacity: 0.9 }}>{s.icon}</span>
      <span style={{ flex: 1 }}>{toast.message}</span>
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: s.fg, cursor: 'pointer', fontSize: 14, opacity: 0.7, padding: 0, lineHeight: 1 }}>✕</button>
      <style>{`@keyframes toast-in { from { transform: translateY(8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </div>
  );
}
