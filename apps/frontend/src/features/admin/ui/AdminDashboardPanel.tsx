import type { ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { getStoredTokens } from '@features/auth';
import { getAdminDashboardMetrics } from '@features/admin/services/admin.service';

export function AdminDashboardPanel(): ReactElement {
  const { accessToken } = getStoredTokens();

  const metricsQuery = useQuery({
    queryKey: ['admin', 'dashboard-metrics', accessToken],
    queryFn: async () => getAdminDashboardMetrics(accessToken ?? ''),
    enabled: Boolean(accessToken),
  });

  const metrics = metricsQuery.data;

  return (
    <section className="admin-screen" aria-labelledby="admin-dashboard-title">
      <div className="admin-screen-head">
        <div>
          <h2 id="admin-dashboard-title" style={{ marginTop: 0 }}>
            Admin Dashboard
          </h2>
          <p className="muted admin-screen-subtitle">Overview of platform users, articles, and recent privileged actions.</p>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => void metricsQuery.refetch()}
          disabled={metricsQuery.isFetching}
        >
          <RefreshCw size={15} />
          {metricsQuery.isFetching ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {!accessToken ? <p className="save-error">Authentication token is missing.</p> : null}
      {metricsQuery.isLoading ? <p className="muted">Loading dashboard metrics...</p> : null}
      {metricsQuery.isError ? <p className="save-error">Failed to load dashboard metrics.</p> : null}

      {metrics ? (
        <>
          <div className="admin-kpi-grid">
            <article className="card admin-kpi-card">
              <span className="admin-kpi-label">Total Users</span>
              <strong className="admin-kpi-value">{metrics.users.total}</strong>
              <p className="muted admin-kpi-meta">New in 7 days: {metrics.users.newLast7Days}</p>
            </article>

            <article className="card admin-kpi-card">
              <span className="admin-kpi-label">Active Users</span>
              <strong className="admin-kpi-value">{metrics.users.active}</strong>
              <p className="muted admin-kpi-meta">Suspended: {metrics.users.suspended}</p>
            </article>

            <article className="card admin-kpi-card">
              <span className="admin-kpi-label">Total Articles</span>
              <strong className="admin-kpi-value">{metrics.articles.total}</strong>
              <p className="muted admin-kpi-meta">Published: {metrics.articles.published}</p>
            </article>

            <article className="card admin-kpi-card">
              <span className="admin-kpi-label">Draft Articles</span>
              <strong className="admin-kpi-value">{metrics.articles.drafts}</strong>
              <p className="muted admin-kpi-meta">Published in 7 days: {metrics.articles.publishedLast7Days}</p>
            </article>
          </div>

          <section className="card admin-audit-panel" aria-labelledby="admin-recent-actions-title">
            <h3 id="admin-recent-actions-title">Recent privileged actions</h3>
            {metrics.recentActions.length === 0 ? (
              <p className="muted">No recent actions recorded.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Target</th>
                      <th>Actor</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.recentActions.map((action) => (
                      <tr key={action.id}>
                        <td>{action.action}</td>
                        <td>
                          {action.targetType} · {action.targetId}
                        </td>
                        <td>{action.actorUserId}</td>
                        <td>{formatAdminDate(action.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}

function formatAdminDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
