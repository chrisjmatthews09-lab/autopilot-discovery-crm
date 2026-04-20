// Sprint 4: Ingestion processor hook.
//
// Mounts once at app root. While the user is signed in, subscribes to two
// Firestore collections:
//   - interviews with dedupStatus === 'pending' → processes each serially
//   - dedupReviewQueue with status === 'pending' → surfaces count for the nav badge
//
// Returns { isProcessing, pendingCount, reviewCount } for UI indicators.

import { useEffect, useRef, useState } from 'react';
import { useCollection } from './useCollection.js';
import { useToast } from '../components/ui/Toast.jsx';
import { processInterview } from '../services/ingestionService.js';

export function useIngestionProcessor({ enabled = true } = {}) {
  const toast = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: pendingInterviews } = useCollection('interviews', {
    filters: [['dedupStatus', '==', 'pending']],
    enabled,
  });

  const { data: reviewItems } = useCollection('dedupReviewQueue', {
    filters: [['status', '==', 'pending']],
    enabled,
  });

  // Track which interview IDs we've already kicked off processing for so that
  // a re-render from the subscription doesn't cause double-processing before
  // Firestore has committed the dedupStatus flip.
  const inFlight = useRef(new Set());

  useEffect(() => {
    if (!enabled) return;
    if (!pendingInterviews || pendingInterviews.length === 0) return;

    const next = pendingInterviews.find((i) => !inFlight.current.has(i.id));
    if (!next) return;

    inFlight.current.add(next.id);
    setIsProcessing(true);

    (async () => {
      try {
        const outcome = await processInterview(next);

        if (outcome.skipped) {
          // Already claimed by another tab / earlier tick. No toast — silent.
        } else if (outcome.error) {
          toast.error(`Interview processing failed: ${outcome.error.slice(0, 100)}`);
        } else {
          switch (outcome.decision) {
            case 'attach_existing_person':
              toast.success('Interview attached to existing contact');
              break;
            case 'review_person':
            case 'create_person_review_company':
              toast.info('Interview queued for review');
              break;
            case 'create_person_attach_company':
              toast.success('New contact created at existing company');
              break;
            case 'create_both':
              toast.success('New contact + company created');
              break;
            default:
              toast.info(`Interview processed (${outcome.decision})`);
          }
        }
      } finally {
        inFlight.current.delete(next.id);
        // If more interviews are still pending, the effect will re-run with the
        // updated list and pick the next one.
        setIsProcessing(false);
      }
    })();
  }, [enabled, pendingInterviews, toast]);

  return {
    isProcessing,
    pendingCount: pendingInterviews?.length || 0,
    reviewCount: reviewItems?.length || 0,
  };
}
