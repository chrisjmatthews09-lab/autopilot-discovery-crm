import React from 'react';
import { LIFECYCLE_STAGE_COLORS } from '../../config/enums';
import { COLORS } from '../../config/design-tokens';

export default function LifecycleStagePill({ stage, size = 'sm' }) {
  const s = stage || 'Research-Contact';
  const c = LIFECYCLE_STAGE_COLORS[s] || { bg: COLORS.cardAlt, fg: COLORS.textMuted };
  const pad = size === 'lg' ? '4px 12px' : '3px 10px';
  const fs = size === 'lg' ? 12 : 11;
  return (
    <span style={{ display: 'inline-block', padding: pad, borderRadius: 12, fontSize: fs, fontWeight: 600, backgroundColor: c.bg, color: c.fg, whiteSpace: 'nowrap' }}>
      {s}
    </span>
  );
}
