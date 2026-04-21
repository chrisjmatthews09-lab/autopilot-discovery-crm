import React from 'react';
import { useLocation } from 'react-router-dom';
import { COLORS } from '../../config/design-tokens';

// Error boundary scoped to a single route. React Router resets this boundary
// whenever the location changes (via the `key` trick in PageErrorBoundary),
// so navigating away from a crashed page recovers without a hard refresh.
class PageErrorBoundaryInner extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('Page render error:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, maxWidth: 640, margin: '40px auto' }}>
          <div style={{
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 10,
            padding: 24,
          }}>
            <h2 style={{ margin: '0 0 8px', color: COLORS.text, fontSize: 20 }}>Something broke.</h2>
            <p style={{ margin: '0 0 12px', color: COLORS.textMuted, fontSize: 14 }}>
              This page hit an unexpected error. The rest of the app is still running — use the sidebar to navigate elsewhere, or reload to try again.
            </p>
            <pre style={{
              margin: '12px 0 0',
              padding: 12,
              background: COLORS.bgMuted,
              color: COLORS.text,
              borderRadius: 6,
              fontSize: 12,
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
            }}>{String(this.state.error?.message || this.state.error)}</pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function PageErrorBoundary({ children }) {
  const location = useLocation();
  return <PageErrorBoundaryInner key={location.pathname}>{children}</PageErrorBoundaryInner>;
}
