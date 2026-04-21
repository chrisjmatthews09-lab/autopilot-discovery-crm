import React from 'react';
import { COLORS } from '../../config/design-tokens';

// Shown by Suspense while a route-split chunk loads. Mimics the typical page
// shape (title row + a few list rows) so the layout doesn't jump when content
// streams in. Animation is a single keyframe driven by an inline <style> tag
// so the skeleton has no external CSS dependency — important since this is
// the first thing users see while the main bundle is still being parsed.
const ROW_HEIGHTS = [22, 56, 56, 56, 56, 56];

export default function PageSkeleton() {
  return (
    <div style={{ padding: 24 }}>
      <style>{`
        @keyframes ap-skeleton-pulse {
          0% { opacity: 0.55; }
          50% { opacity: 0.95; }
          100% { opacity: 0.55; }
        }
      `}</style>
      <div
        style={{
          height: 32,
          width: '40%',
          background: COLORS.cardAlt || '#FDFCF9',
          borderRadius: 6,
          marginBottom: 24,
          animation: 'ap-skeleton-pulse 1.4s ease-in-out infinite',
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {ROW_HEIGHTS.map((h, i) => (
          <div
            key={i}
            style={{
              height: h,
              borderRadius: 8,
              background: COLORS.cardAlt || '#FDFCF9',
              border: `1px solid ${COLORS.border || '#E7E5E0'}`,
              animation: `ap-skeleton-pulse 1.4s ease-in-out ${i * 0.08}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
