export interface StatusStats {
  completed: number;
  pendingOrProcessing: number;
  failed: number;
}

// Reduces a GROUP BY status result into the three buckets the dashboard
// shows. Pure/DB-agnostic on purpose — the route just passes through
// whatever { status, count } rows the query returns.
export function computeStatusStats(rows: { status: string; count: number }[]): StatusStats {
  const stats: StatusStats = { completed: 0, pendingOrProcessing: 0, failed: 0 };
  for (const { status, count } of rows) {
    if (status === "COMPLETED") stats.completed += count;
    else if (status === "PENDING" || status === "PROCESSING") stats.pendingOrProcessing += count;
    else if (status === "FAILED") stats.failed += count;
  }
  return stats;
}
