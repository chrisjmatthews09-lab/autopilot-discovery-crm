import React from 'react';
import { COLORS } from '../../config/design-tokens';

const SHIMMER = 'linear-gradient(90deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0.04) 100%)';

export function Skeleton({ width = '100%', height = 14, radius = 4, style }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: SHIMMER,
      backgroundSize: '200% 100%',
      animation: 'autopilot-shimmer 1.4s ease-in-out infinite',
      ...style,
    }} />
  );
}

export function SkeletonTable({ rows = 6, cols = 5 }) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, padding: '10px 16px', background: COLORS.cardAlt, borderBottom: `1px solid ${COLORS.border}`, gap: 12 }}>
        {Array.from({ length: cols }).map((_, i) => <Skeleton key={i} height={10} width="60%" />)}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, padding: '14px 16px', borderBottom: `1px solid ${COLORS.border}`, gap: 12, alignItems: 'center' }}>
          {Array.from({ length: cols }).map((_, c) => <Skeleton key={c} height={12} width={c === 0 ? '70%' : '45%'} />)}
        </div>
      ))}
      <style>{`@keyframes autopilot-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}

export function SkeletonKanban({ columns = 4, cardsPerCol = 3 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(220px, 1fr))`, gap: 12 }}>
      {Array.from({ length: columns }).map((_, ci) => (
        <div key={ci} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 10 }}>
          <Skeleton height={12} width="50%" style={{ marginBottom: 10 }} />
          {Array.from({ length: cardsPerCol }).map((_, i) => (
            <div key={i} style={{ padding: 10, background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 6, marginBottom: 8 }}>
              <Skeleton height={12} width="70%" style={{ marginBottom: 6 }} />
              <Skeleton height={10} width="45%" />
            </div>
          ))}
        </div>
      ))}
      <style>{`@keyframes autopilot-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 20 }}>
      <Skeleton height={18} width="40%" style={{ marginBottom: 12 }} />
      <Skeleton height={12} width="80%" style={{ marginBottom: 6 }} />
      <Skeleton height={12} width="70%" style={{ marginBottom: 6 }} />
      <Skeleton height={12} width="55%" />
      <style>{`@keyframes autopilot-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}
