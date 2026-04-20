import React from 'react';
import { COLORS, DISPLAY } from '../../config/design-tokens';

const ISSUES_URL = 'https://github.com/chrisjmatthews09/autopilot-discovery-crm/issues/new';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('App error boundary caught:', error, info);
    this.setState({ info });
  }

  reset = () => this.setState({ error: null, info: null });

  report = () => {
    const { error, info } = this.state;
    const title = `App error: ${error?.message || 'Unknown'}`;
    const body = [
      `### What happened`, '', `(describe what you were doing)`, '',
      `### Error`, '```', String(error?.stack || error), '```',
      info?.componentStack ? `\n### Component stack\n\`\`\`${info.componentStack}\n\`\`\`` : '',
      `\n### URL\n${window.location.href}`,
      `\n### User agent\n${navigator.userAgent}`,
    ].join('\n');
    const url = new URL(ISSUES_URL);
    url.searchParams.set('title', title);
    url.searchParams.set('body', body);
    url.searchParams.set('labels', 'bug');
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: COLORS.bg, padding: 20 }}>
        <div style={{ maxWidth: 540, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>💥</div>
          <h1 style={{ margin: 0, fontFamily: DISPLAY, fontSize: 24, color: COLORS.text }}>Something broke.</h1>
          <p style={{ color: COLORS.textMuted, fontSize: 14, lineHeight: 1.5, marginTop: 8 }}>
            An unexpected error prevented this page from rendering. Your data is safe in Firestore. Try reloading, or report the issue so we can fix it.
          </p>
          {error.message && (
            <pre style={{ background: COLORS.cardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: 10, fontSize: 11, color: COLORS.danger, overflow: 'auto', maxHeight: 160, marginTop: 12 }}>
              {String(error.message)}
            </pre>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button onClick={() => window.location.reload()}
              style={{ padding: '9px 16px', background: COLORS.primary, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              Reload
            </button>
            <button onClick={this.reset}
              style={{ padding: '9px 16px', background: 'none', color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
              Dismiss
            </button>
            <button onClick={this.report}
              style={{ padding: '9px 16px', background: COLORS.accentLight, color: COLORS.accent, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, marginLeft: 'auto' }}>
              Report issue
            </button>
          </div>
        </div>
      </div>
    );
  }
}
