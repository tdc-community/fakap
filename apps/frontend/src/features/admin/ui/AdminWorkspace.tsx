import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { AdminWorkspaceSection } from '@features/admin/services/admin.service';
import { AdminDashboardPanel } from './AdminDashboardPanel';
import { AdminUsersManagementPanel } from './AdminUsersManagementPanel';
import { EditorNewsManagementPanel } from './EditorNewsManagementPanel';

type AdminWorkspaceProps = {
  canManageUsers: boolean;
  defaultSection: AdminWorkspaceSection;
};

const SECTION_QUERY_KEY = 'section';

export function AdminWorkspace({ canManageUsers, defaultSection }: AdminWorkspaceProps): ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get(SECTION_QUERY_KEY);

  const activeSection = useMemo<AdminWorkspaceSection>(() => {
    if (requested === 'overview' || requested === 'articles' || requested === 'users') {
      if (requested === 'users' && !canManageUsers) {
        return 'articles';
      }
      return requested;
    }

    if (defaultSection === 'users' && !canManageUsers) {
      return 'articles';
    }

    return defaultSection;
  }, [requested, canManageUsers, defaultSection]);

  const setSection = (section: AdminWorkspaceSection): void => {
    const next = new URLSearchParams(searchParams);
    next.set(SECTION_QUERY_KEY, section);
    setSearchParams(next, { replace: true });
  };

  return (
    <section className="admin-workspace" aria-labelledby="admin-workspace-title">
      <header className="card admin-workspace-header">
        <h2 id="admin-workspace-title" style={{ margin: 0 }}>
          Admin Workspace
        </h2>
        <p className="muted admin-screen-subtitle">Unified moderation, editorial, and platform oversight.</p>

        <nav className="admin-workspace-tabs" aria-label="Admin sections">
          <button
            type="button"
            className={`btn ${activeSection === 'overview' ? 'btn-solid' : 'btn-ghost'}`}
            onClick={() => setSection('overview')}
            aria-current={activeSection === 'overview' ? 'page' : undefined}
          >
            Overview
          </button>
          <button
            type="button"
            className={`btn ${activeSection === 'articles' ? 'btn-solid' : 'btn-ghost'}`}
            onClick={() => setSection('articles')}
            aria-current={activeSection === 'articles' ? 'page' : undefined}
          >
            Articles
          </button>
          {canManageUsers ? (
            <button
              type="button"
              className={`btn ${activeSection === 'users' ? 'btn-solid' : 'btn-ghost'}`}
              onClick={() => setSection('users')}
              aria-current={activeSection === 'users' ? 'page' : undefined}
            >
              Users
            </button>
          ) : null}
        </nav>
      </header>

      {activeSection === 'overview' ? <AdminDashboardPanel /> : null}
      {activeSection === 'articles' ? <EditorNewsManagementPanel /> : null}
      {activeSection === 'users' && canManageUsers ? <AdminUsersManagementPanel /> : null}
    </section>
  );
}

