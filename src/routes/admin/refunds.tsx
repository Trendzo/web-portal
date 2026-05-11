// §16 — kept as a redirect to the renamed Refund Reconciliation surface so
// existing bookmarks / deep-links don't 404. Drop this file entirely once
// telemetry confirms zero traffic.

import { Navigate } from 'react-router-dom';

export default function AdminRefundsRedirect() {
  return <Navigate to="/admin/refund-reconciliation" replace />;
}
