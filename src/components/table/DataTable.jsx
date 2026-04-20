import React, { useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { COLORS } from '../../config/design-tokens';

const VIRTUALIZE_THRESHOLD = 100;
const ROW_HEIGHT = 48;

export default function DataTable({ columns, rows, onRowClick, emptyMessage = 'No records.', rowKey = 'id' }) {
  const parentRef = useRef(null);
  const virtualize = rows.length >= VIRTUALIZE_THRESHOLD;
  const gridTemplate = useMemo(() => columns.map((c) => c.width || '1fr').join(' '), [columns]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  if (rows.length === 0) {
    return <div style={{ padding: 32, textAlign: 'center', color: COLORS.textDim, fontSize: 13, fontStyle: 'italic' }}>{emptyMessage}</div>;
  }

  const header = (
    <div style={{ display: 'grid', gridTemplateColumns: gridTemplate, padding: '10px 16px', background: COLORS.cardAlt, borderBottom: `1px solid ${COLORS.border}`, fontSize: 11, fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, position: 'sticky', top: 0, zIndex: 2 }}>
      {columns.map((c) => <div key={c.key} style={{ textAlign: c.align || 'left' }}>{c.header}</div>)}
    </div>
  );

  const renderRow = (row, idx, style) => (
    <div
      key={row[rowKey] || idx}
      onClick={() => onRowClick && onRowClick(row)}
      style={{
        display: 'grid',
        gridTemplateColumns: gridTemplate,
        padding: '12px 16px',
        fontSize: 13,
        borderBottom: `1px solid ${COLORS.border}`,
        cursor: onRowClick ? 'pointer' : 'default',
        alignItems: 'center',
        ...(style || {}),
      }}
      onMouseEnter={(e) => { if (onRowClick) e.currentTarget.style.backgroundColor = COLORS.primaryLight; }}
      onMouseLeave={(e) => { if (onRowClick) e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      {columns.map((c) => (
        <div key={c.key} style={{ textAlign: c.align || 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {c.render ? c.render(row) : (row[c.key] ?? '—')}
        </div>
      ))}
    </div>
  );

  if (!virtualize) {
    return (
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: 'hidden' }}>
        {header}
        {rows.map((r, i) => renderRow(r, i))}
      </div>
    );
  }

  const total = virtualizer.getTotalSize();
  const items = virtualizer.getVirtualItems();

  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: 'hidden' }}>
      {header}
      <div ref={parentRef} style={{ height: 600, overflowY: 'auto' }}>
        <div style={{ height: total, position: 'relative' }}>
          {items.map((vr) => renderRow(rows[vr.index], vr.index, { position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${vr.start}px)`, height: ROW_HEIGHT }))}
        </div>
      </div>
    </div>
  );
}
