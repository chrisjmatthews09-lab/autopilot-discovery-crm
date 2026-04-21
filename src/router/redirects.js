import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

// Old URLs like /people/:id (workspace-less) still appear in bookmarks and
// external links. Look the record up, decide which workspace it lives in,
// and bounce to the canonical /<workspace>/<kind>/:id path.
export function LegacyRecordRedirect({ rows, fallback, crmPath, dealFlowPath }) {
  const { id } = useParams();
  const row = rows.find((r) => r.id === id);
  const ws = row?.workspace || fallback;
  const base = ws === 'deal_flow' ? dealFlowPath : crmPath;
  return <Navigate to={`${base}/${id}`} replace />;
}

// For paths that changed prefix but kept the :id (e.g. /deals/:id → /crm/deals/:id).
export function LegacyPrefixRedirect({ prefix }) {
  const { id } = useParams();
  return <Navigate to={`${prefix}/${id}`} replace />;
}
