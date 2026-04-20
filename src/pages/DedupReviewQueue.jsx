// Sprint 5 — Dedup Review Queue
// Full-page review surface for tier-3 dedup matches. Shows two tabs (CRM,
// Deal Flow) driven by `appType`; each tab renders one MatchReviewCard per
// pending item in that bucket. Hydrates the candidate existing record + the
// source interview so the card can render context without extra fetches.

import React, { useEffect, useMemo, useState } from 'react';
import { useCollection } from '../hooks/useCollection.js';
import { COLORS, DISPLAY } from '../config/design-tokens';
import EmptyState from '../components/ui/EmptyState';
import MatchReviewCard, { fetchExistingForItem } from '../components/MatchReviewCard.jsx';
import { getDoc } from '../data/firestore.js';

const TABS = [
  { id: 'crm', label: 'CRM', appType: 'crm' },
  { id: 'deal_flow', label: 'Deal Flow', appType: 'deal_flow' },
];

export default function DedupReviewQueue() {
  const [activeTab, setActiveTab] = useState('crm');

  const { data: items, loading } = useCollection('dedupReviewQueue', {
    filters: [['status', '==', 'pending']],
  });

  const counts = useMemo(() => {
    const out = { crm: 0, deal_flow: 0, unknown: 0 };
    for (const it of items || []) {
      if (it.appType === 'crm') out.crm += 1;
      else if (it.appType === 'deal_flow') out.deal_flow += 1;
      else out.unknown += 1;
    }
    return out;
  }, [items]);

  const visibleItems = useMemo(() => {
    const tab = TABS.find((t) => t.id === activeTab);
    if (!tab) return [];
    return (items || []).filter((it) => {
      if (it.appType) return it.appType === tab.appType;
      // Legacy items without appType fall into CRM by default (matches migration heuristic).
      return tab.appType === 'crm';
    });
  }, [items, activeTab]);

  return (
    <div style={{ padding: 20, maxWidth: 980, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, color: COLORS.text, fontFamily: DISPLAY, fontSize: 26 }}>
          Review queue
        </h1>
        <div style={{ color: COLORS.textMuted, fontSize: 13, marginTop: 4 }}>
          Tier-3 matches that need a human decision before they attach or create new records.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${COLORS.border}`, marginBottom: 18 }}>
        {TABS.map((t) => {
          const active = activeTab === t.id;
          const count = counts[t.appType];
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '10px 16px',
                background: 'none',
                border: 'none',
                borderBottom: `2px solid ${active ? COLORS.primary : 'transparent'}`,
                color: active ? COLORS.text : COLORS.textMuted,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: active ? 700 : 500,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>{t.label}</span>
              {count > 0 && (
                <span
                  style={{
                    background: active ? COLORS.primary : COLORS.border,
                    color: active ? '#fff' : COLORS.textMuted,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '1px 8px',
                    borderRadius: 999,
                    minWidth: 20,
                    textAlign: 'center',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ color: COLORS.textMuted, fontSize: 13, padding: 24, textAlign: 'center' }}>
          Loading…
        </div>
      ) : visibleItems.length === 0 ? (
        <EmptyState
          icon="🎉"
          title="No items to review"
          body="Everything is resolved. New tier-3 matches will show up here as interviews are ingested."
        />
      ) : (
        <div>
          {visibleItems.map((item) => (
            <ReviewItemRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

// Each row owns the async hydration of the matched existing record + source
// interview. Kept small so one row's hydration can't block another.
function ReviewItemRow({ item }) {
  const [existing, setExisting] = useState(null);
  const [interview, setInterview] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ex, iv] = await Promise.all([
          fetchExistingForItem(item),
          item.sourceInterviewId ? getDoc('interviews', item.sourceInterviewId) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setExisting(ex);
        setInterview(iv);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => { cancelled = true; };
  }, [item.id, item.matchedEntityId, item.sourceInterviewId, item.entityType]);

  if (!hydrated) {
    return (
      <div
        style={{
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 10,
          padding: 18,
          marginBottom: 14,
          color: COLORS.textMuted,
          fontSize: 13,
        }}
      >
        Loading review item…
      </div>
    );
  }

  const isContact = item.entityType === 'contact';
  return (
    <MatchReviewCard
      item={item}
      interview={interview}
      existingContact={isContact ? existing : null}
      existingCompany={isContact ? null : existing}
    />
  );
}
