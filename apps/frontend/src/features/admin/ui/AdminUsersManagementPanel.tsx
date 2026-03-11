import type { KeyboardEvent as ReactKeyboardEvent, ReactElement } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { MoreVertical } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { getStoredTokens } from '@features/auth';
import {
  type AdminUser,
  changeAdminUserRole,
  getAdminUserById,
  listAdminUsers,
  restoreAdminUser,
  suspendAdminUser,
  type AdminUserRole,
} from '@features/admin/services/admin.service';

const PAGE_SIZE = 10;

export function AdminUsersManagementPanel(): ReactElement {
  const { accessToken } = getStoredTokens();
  const queryClient = useQueryClient();
  const location = useLocation();
  const menuBaseId = useId();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<AdminUserRole | 'all'>('all');
  const [suspended, setSuspended] = useState<'all' | 'yes' | 'no'>('all');
  const [orderBy, setOrderBy] = useState<'created_at' | 'updated_at' | 'username'>('updated_at');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [offset, setOffset] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [openMenuUserId, setOpenMenuUserId] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', { search, role, suspended, orderBy, order, offset, limit: PAGE_SIZE }, accessToken],
    queryFn: async () =>
      listAdminUsers(accessToken ?? '', {
        search: search || undefined,
        role: role === 'all' ? undefined : role,
        suspended: suspended === 'all' ? undefined : suspended === 'yes',
        orderBy,
        order,
        limit: PAGE_SIZE,
        offset,
      }),
    enabled: Boolean(accessToken),
  });

  const selectedUserQuery = useQuery({
    queryKey: ['admin', 'users', 'detail', selectedUserId, accessToken],
    queryFn: async () => getAdminUserById(accessToken ?? '', selectedUserId ?? ''),
    enabled: Boolean(accessToken) && Boolean(selectedUserId),
  });

  const changeRoleMutation = useMutation({
    mutationFn: async (input: { userId: string; role: AdminUserRole }) => changeAdminUserRole(accessToken ?? '', input.userId, input.role),
    onSuccess: async (updatedUser: AdminUser) => {
      setSelectedUserId(updatedUser.id);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async (input: { userId: string; reason?: string }) => suspendAdminUser(accessToken ?? '', input.userId, input.reason),
    onSuccess: async (updatedUser: AdminUser) => {
      setSelectedUserId(updatedUser.id);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (userId: string) => restoreAdminUser(accessToken ?? '', userId),
    onSuccess: async (updatedUser: AdminUser) => {
      setSelectedUserId(updatedUser.id);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const total = usersQuery.data?.total ?? 0;
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const closeMenu = (focusTrigger = false): void => {
    const activeId = openMenuUserId;
    setOpenMenuUserId(null);
    if (focusTrigger && activeId) {
      triggerRefs.current[activeId]?.focus();
    }
  };

  useEffect(() => {
    closeMenu(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!openMenuUserId) {
      return;
    }

    const onMouseDown = (event: MouseEvent): void => {
      const target = event.target as Node;
      const trigger = triggerRefs.current[openMenuUserId];
      if (menuRef.current?.contains(target) || trigger?.contains(target)) {
        return;
      }
      closeMenu(false);
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu(true);
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [openMenuUserId]);

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>, userId: string): void => {
    if (!menuRef.current || openMenuUserId !== userId) {
      return;
    }

    const menuItems = Array.from(menuRef.current.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    if (menuItems.length === 0) {
      return;
    }

    const currentIndex = menuItems.findIndex((item) => item === document.activeElement);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = menuItems[(currentIndex + 1 + menuItems.length) % menuItems.length] as HTMLButtonElement;
      next.focus();
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prev = menuItems[(currentIndex - 1 + menuItems.length) % menuItems.length] as HTMLButtonElement;
      prev.focus();
    }

    if (event.key === 'Home') {
      event.preventDefault();
      (menuItems[0] as HTMLButtonElement).focus();
    }

    if (event.key === 'End') {
      event.preventDefault();
      (menuItems[menuItems.length - 1] as HTMLButtonElement).focus();
    }

    if (event.key === 'Tab') {
      closeMenu(false);
    }
  };

  const runAction = async (action: () => Promise<void>): Promise<void> => {
    closeMenu(true);
    await action();
  };

  return (
    <section className="card admin-users-panel" aria-labelledby="admin-users-title">
      <div className="admin-screen-head">
        <div>
          <h3 id="admin-users-title">User Management</h3>
          <p className="muted admin-screen-subtitle">Search, inspect, and moderate users (role, suspend, restore).</p>
        </div>
      </div>

      <div className="admin-filter-bar">
        <label className="field-label" htmlFor="admin-users-search">
          Search
        </label>
        <input
          id="admin-users-search"
          className="field-input"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="username or discord id"
        />

        <div className="admin-filter-actions">
          <button
            type="button"
            className="btn btn-solid"
            onClick={() => {
              setSearch(searchInput.trim());
              setOffset(0);
            }}
          >
            Apply
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setSearchInput('');
              setSearch('');
              setRole('all');
              setSuspended('all');
              setOrderBy('updated_at');
              setOrder('desc');
              setOffset(0);
            }}
          >
            Reset
          </button>
        </div>

        <div className="admin-inline-controls">
          <label className="field-label" htmlFor="admin-users-role" style={{ marginTop: 0 }}>
            Role
          </label>
          <select
            id="admin-users-role"
            className="field-input"
            value={role}
            onChange={(event) => {
              setRole(event.target.value as AdminUserRole | 'all');
              setOffset(0);
            }}
          >
            <option value="all">All</option>
            <option value="user">User</option>
            <option value="moderator">Moderator</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div className="admin-inline-controls">
          <label className="field-label" htmlFor="admin-users-suspended" style={{ marginTop: 0 }}>
            Suspended
          </label>
          <select
            id="admin-users-suspended"
            className="field-input"
            value={suspended}
            onChange={(event) => {
              setSuspended(event.target.value as 'all' | 'yes' | 'no');
              setOffset(0);
            }}
          >
            <option value="all">All</option>
            <option value="yes">Suspended</option>
            <option value="no">Active</option>
          </select>
        </div>
      </div>

      {!accessToken ? <p className="save-error">Authentication token is missing.</p> : null}
      {usersQuery.isLoading ? <p className="muted">Loading users...</p> : null}
      {usersQuery.isError ? <p className="save-error">Failed to load users.</p> : null}

      {usersQuery.data ? (
        <div className="admin-users-layout">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th className="admin-actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersQuery.data.items.map((user) => {
                  const menuOpen = openMenuUserId === user.id;
                  const menuId = `${menuBaseId}-${user.id}-menu`;
                  const triggerId = `${menuBaseId}-${user.id}-trigger`;
                  return (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.username}</strong>
                        <div className="muted admin-table-sub">{user.discordId}</div>
                      </td>
                      <td>
                        <span className="admin-status-pill">{user.role}</span>
                      </td>
                      <td>{user.suspendedAt ? 'Suspended' : 'Active'}</td>
                      <td>{formatAdminDate(user.updatedAt)}</td>
                      <td className="admin-actions-cell">
                        <div className="admin-row-menu-wrap">
                          <button
                            id={triggerId}
                            ref={(node) => {
                              triggerRefs.current[user.id] = node;
                            }}
                            type="button"
                            className="icon-btn admin-row-menu-trigger"
                            aria-label={`Open actions for ${user.username}`}
                            aria-haspopup="menu"
                            aria-expanded={menuOpen}
                            aria-controls={menuOpen ? menuId : undefined}
                            onClick={() => {
                              setSelectedUserId(user.id);
                              setOpenMenuUserId((prev) => (prev === user.id ? null : user.id));
                            }}
                          >
                            <MoreVertical size={15} />
                          </button>

                          {menuOpen ? (
                            <div
                              id={menuId}
                              ref={menuRef}
                              role="menu"
                              aria-labelledby={triggerId}
                              className="admin-row-menu"
                              onKeyDown={(event) => handleMenuKeyDown(event, user.id)}
                              onBlur={(event) => {
                                const next = event.relatedTarget as Node | null;
                                if (next && event.currentTarget.contains(next)) {
                                  return;
                                }
                                closeMenu(false);
                              }}
                            >
                              <button type="button" role="menuitem" className="admin-row-menu-item" onClick={() => setSelectedUserId(user.id)}>
                                Open
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                className="admin-row-menu-item"
                                disabled={changeRoleMutation.isPending}
                                onClick={() => void runAction(async () => changeRoleMutation.mutateAsync({ userId: user.id, role: 'user' }).then(() => undefined))}
                              >
                                Set User
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                className="admin-row-menu-item"
                                disabled={changeRoleMutation.isPending}
                                onClick={() => void runAction(async () => changeRoleMutation.mutateAsync({ userId: user.id, role: 'moderator' }).then(() => undefined))}
                              >
                                Set Moderator
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                className="admin-row-menu-item"
                                disabled={changeRoleMutation.isPending}
                                onClick={() => void runAction(async () => changeRoleMutation.mutateAsync({ userId: user.id, role: 'admin' }).then(() => undefined))}
                              >
                                Set Admin
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                className="admin-row-menu-item"
                                disabled={suspendMutation.isPending || Boolean(user.suspendedAt)}
                                onClick={() => {
                                  const reason = window.prompt('Suspension reason (optional):') ?? undefined;
                                  void runAction(async () => suspendMutation.mutateAsync({ userId: user.id, reason }).then(() => undefined));
                                }}
                              >
                                Suspend
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                className="admin-row-menu-item"
                                disabled={restoreMutation.isPending || !user.suspendedAt}
                                onClick={() => void runAction(async () => restoreMutation.mutateAsync(user.id).then(() => undefined))}
                              >
                                Restore
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <aside className="admin-user-detail card" aria-live="polite">
            <h4 style={{ marginTop: 0 }}>Selected User</h4>
            {!selectedUserId ? <p className="muted">Select a user to review details.</p> : null}
            {selectedUserId && selectedUserQuery.isLoading ? <p className="muted">Loading user details...</p> : null}
            {selectedUserId && selectedUserQuery.isError ? <p className="save-error">Failed to load user details.</p> : null}

            {selectedUserQuery.data ? (
              <div className="admin-user-meta">
                <p>
                  <strong>{selectedUserQuery.data.username}</strong>
                </p>
                <p className="muted">ID: {selectedUserQuery.data.id}</p>
                <p className="muted">Role: {selectedUserQuery.data.role}</p>
                <p className="muted">Suspended: {selectedUserQuery.data.suspendedAt ? 'Yes' : 'No'}</p>
              </div>
            ) : null}

            {changeRoleMutation.isError ? <p className="save-error">Failed to update role.</p> : null}
            {suspendMutation.isError ? <p className="save-error">Failed to suspend user.</p> : null}
            {restoreMutation.isError ? <p className="save-error">Failed to restore user.</p> : null}
          </aside>
        </div>
      ) : null}

      <div className="admin-pagination">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={offset === 0}
          onClick={() => setOffset((prev) => Math.max(0, prev - PAGE_SIZE))}
        >
          Previous
        </button>
        <span className="muted">
          Page {page} / {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={offset + PAGE_SIZE >= total}
          onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
        >
          Next
        </button>
      </div>
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
