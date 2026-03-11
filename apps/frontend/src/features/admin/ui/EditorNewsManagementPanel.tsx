import type { ChangeEvent, ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getStoredTokens } from '@features/auth';
import {
  assignAdminNewsHomeSlot,
  type AdminNewsArticle,
  clearAdminNewsHomeSlot,
  createAdminNewsArticle,
  deleteAdminNewsArticle,
  getPublicNewsHomepage,
  listAdminNewsArticles,
  setAdminNewsStatus,
  type AdminNewsSlot,
  type AdminNewsStatus,
  updateAdminNewsArticle,
} from '@features/admin/services/admin.service';

const PAGE_SIZE = 10;

export function EditorNewsManagementPanel(): ReactElement {
  const { accessToken } = getStoredTokens();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AdminNewsStatus | 'all'>('all');
  const [orderBy, setOrderBy] = useState<'updated_at' | 'published_at' | 'created_at' | 'title'>('updated_at');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [offset, setOffset] = useState(0);
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorSummary, setEditorSummary] = useState('');
  const [editorCategory, setEditorCategory] = useState('General');
  const [editorImageUrl, setEditorImageUrl] = useState('');
  const [editorContentText, setEditorContentText] = useState('');
  const [slotPrimaryArticleId, setSlotPrimaryArticleId] = useState('');
  const [slotSecondaryArticleId, setSlotSecondaryArticleId] = useState('');
  const [slotThirdArticleId, setSlotThirdArticleId] = useState('');

  const queryKey = ['admin', 'editor-news', { search, status, orderBy, order, offset, limit: PAGE_SIZE }, accessToken];

  const listQuery = useQuery({
    queryKey,
    queryFn: async () =>
      listAdminNewsArticles(accessToken ?? '', {
        search: search || undefined,
        status: status === 'all' ? undefined : status,
        orderBy,
        order,
        limit: PAGE_SIZE,
        offset,
      }),
    enabled: Boolean(accessToken),
  });

  const homepageQuery = useQuery({
    queryKey: ['admin', 'news-home-slots', accessToken],
    queryFn: async () => getPublicNewsHomepage(accessToken ?? ''),
    enabled: Boolean(accessToken),
  });

  const publishedArticlesQuery = useQuery({
    queryKey: ['admin', 'editor-news-published-options', accessToken],
    queryFn: async () =>
      listAdminNewsArticles(accessToken ?? '', {
        status: 'published',
        limit: 100,
        offset: 0,
        orderBy: 'published_at',
        order: 'desc',
      }),
    enabled: Boolean(accessToken),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (input: { articleId: string; status: AdminNewsStatus }) =>
      setAdminNewsStatus(accessToken ?? '', input.articleId, input.status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'editor-news'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (articleId: string) => deleteAdminNewsArticle(accessToken ?? '', articleId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'editor-news'] });
    },
  });

  const saveArticleMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: editorTitle.trim(),
        summary: editorSummary.trim(),
        category: editorCategory.trim(),
        imageUrl: editorImageUrl.trim(),
        content: editorContentText
          .split('\n')
          .map((line: string) => line.trim())
          .filter(Boolean),
      };

      if (editingArticleId) {
        return updateAdminNewsArticle(accessToken ?? '', editingArticleId, payload);
      }

      return createAdminNewsArticle(accessToken ?? '', payload);
    },
    onSuccess: async (article: AdminNewsArticle) => {
      setEditingArticleId(article.id);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'editor-news'] });
    },
  });

  const assignSlotMutation = useMutation({
    mutationFn: async (input: { slot: AdminNewsSlot; articleId: string }) =>
      assignAdminNewsHomeSlot(accessToken ?? '', input.slot, input.articleId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'news-home-slots'] });
    },
  });

  const clearSlotMutation = useMutation({
    mutationFn: async (slot: AdminNewsSlot) => clearAdminNewsHomeSlot(accessToken ?? '', slot),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'news-home-slots'] });
    },
  });

  const total = listQuery.data?.total ?? 0;
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;
  const publishedOptions = publishedArticlesQuery.data?.items ?? [];

  const activePrimaryId = homepageQuery.data?.primary?.id ?? '';
  const activeSecondaryId = homepageQuery.data?.secondary?.id ?? '';
  const activeThirdId = homepageQuery.data?.third?.id ?? '';

  const busyArticleId = useMemo(() => {
    if (updateStatusMutation.variables) return updateStatusMutation.variables.articleId;
    if (deleteMutation.variables) return deleteMutation.variables;
    return null;
  }, [deleteMutation.variables, updateStatusMutation.variables]);

  const editorBusy = saveArticleMutation.isPending;

  return (
    <section className="admin-screen" aria-labelledby="editor-news-title">
      <div className="admin-screen-head">
        <div>
          <h2 id="editor-news-title" style={{ marginTop: 0 }}>
            Editor · News Management
          </h2>
          <p className="muted admin-screen-subtitle">Search, filter, sort, and moderate article publication status.</p>
        </div>
      </div>

      <div className="card admin-filter-bar">
        <label className="field-label" htmlFor="editor-news-search">
          Search
        </label>
        <input
          id="editor-news-search"
          className="field-input"
          value={searchInput}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setSearchInput(event.target.value)}
          placeholder="Search by title, category, or summary"
        />
        <div className="admin-filter-actions">
          <button
            type="button"
            className="btn btn-solid"
            onClick={() => {
              setOffset(0);
              setSearch(searchInput.trim());
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
              setOffset(0);
            }}
          >
            Reset
          </button>
        </div>
        <div className="admin-inline-controls">
          <label className="field-label" htmlFor="editor-news-status" style={{ marginTop: 0 }}>
            Status
          </label>
          <select
            id="editor-news-status"
            className="field-input"
            value={status}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              setStatus(event.target.value as AdminNewsStatus | 'all');
              setOffset(0);
            }}
          >
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
        <div className="admin-inline-controls">
          <label className="field-label" htmlFor="editor-news-order-by" style={{ marginTop: 0 }}>
            Sort by
          </label>
          <select
            id="editor-news-order-by"
            className="field-input"
            value={orderBy}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              setOrderBy(event.target.value as 'updated_at' | 'published_at' | 'created_at' | 'title');
              setOffset(0);
            }}
          >
            <option value="updated_at">Updated</option>
            <option value="published_at">Published</option>
            <option value="created_at">Created</option>
            <option value="title">Title</option>
          </select>
        </div>
        <div className="admin-inline-controls">
          <label className="field-label" htmlFor="editor-news-order" style={{ marginTop: 0 }}>
            Order
          </label>
          <select
            id="editor-news-order"
            className="field-input"
            value={order}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              setOrder(event.target.value as 'asc' | 'desc');
              setOffset(0);
            }}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
      </div>

      {!accessToken ? <p className="save-error">Authentication token is missing.</p> : null}
      {listQuery.isLoading ? <p className="muted">Loading articles...</p> : null}
      {listQuery.isError ? <p className="save-error">Failed to load articles.</p> : null}

      {listQuery.data ? (
        <section className="card" aria-labelledby="editor-news-table-title">
          <h3 id="editor-news-table-title">Articles</h3>
          {listQuery.data.items.length === 0 ? (
            <p className="muted">No articles found for this filter.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {listQuery.data.items.map((article) => {
                    const isBusy = busyArticleId === article.id;
                    return (
                      <tr key={article.id}>
                        <td>
                          <strong>{article.title}</strong>
                          <div className="muted admin-table-sub">{article.summary}</div>
                        </td>
                        <td>{article.category}</td>
                        <td>
                          <span className={`admin-status-pill ${article.status}`}>{article.status}</span>
                        </td>
                        <td>{formatAdminDate(article.updatedAt)}</td>
                        <td>
                          <div className="admin-row-actions">
                            {article.status === 'draft' ? (
                              <button
                                type="button"
                                className="btn btn-solid"
                                disabled={isBusy}
                                onClick={() => void updateStatusMutation.mutateAsync({ articleId: article.id, status: 'published' })}
                              >
                                Publish
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-ghost"
                                disabled={isBusy}
                                onClick={() => void updateStatusMutation.mutateAsync({ articleId: article.id, status: 'draft' })}
                              >
                                Unpublish
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-ghost"
                              disabled={isBusy}
                              onClick={() => {
                                setEditingArticleId(article.id);
                                setEditorTitle(article.title);
                                setEditorSummary(article.summary);
                                setEditorCategory(article.category);
                                setEditorImageUrl(article.imageUrl);
                                setEditorContentText(article.content.join('\n'));
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              disabled={isBusy}
                              onClick={() => {
                                if (window.confirm(`Delete article “${article.title}”? This cannot be undone.`)) {
                                  void deleteMutation.mutateAsync(article.id);
                                }
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="admin-pagination">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={!hasPrev}
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
              disabled={!hasNext}
              onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
            >
              Next
            </button>
          </div>
        </section>
      ) : null}

      <section className="card admin-editor-panel" aria-labelledby="editor-news-editor-title">
        <h3 id="editor-news-editor-title">{editingArticleId ? 'Edit Article' : 'Create Article'}</h3>
        <p className="muted admin-screen-subtitle">Draft creation and updates for newsroom workflows.</p>

        <div className="admin-editor-grid">
          <label className="field-label" htmlFor="editor-title">
            Title
          </label>
          <input
            id="editor-title"
            className="field-input"
            value={editorTitle}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setEditorTitle(event.target.value)}
            placeholder="Article title"
            maxLength={180}
          />

          <label className="field-label" htmlFor="editor-summary">
            Summary
          </label>
          <textarea
            id="editor-summary"
            className="field-input field-textarea"
            value={editorSummary}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setEditorSummary(event.target.value)}
            placeholder="Short summary"
            maxLength={360}
          />

          <label className="field-label" htmlFor="editor-category">
            Category
          </label>
          <input
            id="editor-category"
            className="field-input"
            value={editorCategory}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setEditorCategory(event.target.value)}
            placeholder="e.g. Vehicle Spotlight"
            maxLength={80}
          />

          <label className="field-label" htmlFor="editor-image-url">
            Hero image URL
          </label>
          <input
            id="editor-image-url"
            className="field-input"
            value={editorImageUrl}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setEditorImageUrl(event.target.value)}
            placeholder="https://..."
          />

          <label className="field-label" htmlFor="editor-content-lines">
            Content paragraphs (one per line)
          </label>
          <textarea
            id="editor-content-lines"
            className="field-input field-textarea"
            value={editorContentText}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setEditorContentText(event.target.value)}
            placeholder="Paragraph 1&#10;Paragraph 2"
            rows={8}
          />
        </div>

        <div className="admin-row-actions">
          <button
            type="button"
            className="btn btn-solid"
            disabled={editorBusy || !editorTitle.trim() || !editorSummary.trim() || !editorCategory.trim() || !editorImageUrl.trim()}
            onClick={() => void saveArticleMutation.mutateAsync()}
          >
            {editorBusy ? 'Saving...' : editingArticleId ? 'Save Changes' : 'Create Draft'}
          </button>

          {editingArticleId ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setEditingArticleId(null);
                setEditorTitle('');
                setEditorSummary('');
                setEditorCategory('General');
                setEditorImageUrl('');
                setEditorContentText('');
              }}
            >
              Clear
            </button>
          ) : null}
        </div>

        {saveArticleMutation.isError ? <p className="save-error">Failed to save article.</p> : null}
        {saveArticleMutation.isSuccess ? <p className="save-ok">Article saved.</p> : null}
      </section>

      <section className="card admin-editor-panel" aria-labelledby="editor-home-slot-title">
        <h3 id="editor-home-slot-title">Homepage Slots</h3>
        <p className="muted admin-screen-subtitle">Assign published articles to primary, secondary, and third positions.</p>

        {homepageQuery.isLoading || publishedArticlesQuery.isLoading ? <p className="muted">Loading slot options...</p> : null}
        {homepageQuery.isError || publishedArticlesQuery.isError ? <p className="save-error">Failed to load slot data.</p> : null}

        {homepageQuery.data && publishedOptions.length >= 0 ? (
          <div className="admin-slot-grid">
            <HomeSlotEditor
              label="Primary"
              activeArticleId={activePrimaryId}
              selectedArticleId={slotPrimaryArticleId}
              options={publishedOptions}
              onSelect={setSlotPrimaryArticleId}
              onAssign={() => {
                if (!slotPrimaryArticleId) return;
                void assignSlotMutation.mutateAsync({ slot: 'primary', articleId: slotPrimaryArticleId });
              }}
              onClear={() => void clearSlotMutation.mutateAsync('primary')}
              busy={assignSlotMutation.isPending || clearSlotMutation.isPending}
            />

            <HomeSlotEditor
              label="Secondary"
              activeArticleId={activeSecondaryId}
              selectedArticleId={slotSecondaryArticleId}
              options={publishedOptions}
              onSelect={setSlotSecondaryArticleId}
              onAssign={() => {
                if (!slotSecondaryArticleId) return;
                void assignSlotMutation.mutateAsync({ slot: 'secondary', articleId: slotSecondaryArticleId });
              }}
              onClear={() => void clearSlotMutation.mutateAsync('secondary')}
              busy={assignSlotMutation.isPending || clearSlotMutation.isPending}
            />

            <HomeSlotEditor
              label="Third"
              activeArticleId={activeThirdId}
              selectedArticleId={slotThirdArticleId}
              options={publishedOptions}
              onSelect={setSlotThirdArticleId}
              onAssign={() => {
                if (!slotThirdArticleId) return;
                void assignSlotMutation.mutateAsync({ slot: 'third', articleId: slotThirdArticleId });
              }}
              onClear={() => void clearSlotMutation.mutateAsync('third')}
              busy={assignSlotMutation.isPending || clearSlotMutation.isPending}
            />
          </div>
        ) : null}

        {assignSlotMutation.isError || clearSlotMutation.isError ? <p className="save-error">Failed to update home slot.</p> : null}
      </section>
    </section>
  );
}

type HomeSlotEditorProps = {
  label: string;
  activeArticleId: string;
  selectedArticleId: string;
  options: Array<{ id: string; title: string }>;
  onSelect: (value: string) => void;
  onAssign: () => void;
  onClear: () => void;
  busy: boolean;
};

function HomeSlotEditor({
  label,
  activeArticleId,
  selectedArticleId,
  options,
  onSelect,
  onAssign,
  onClear,
  busy,
}: HomeSlotEditorProps): ReactElement {
  return (
    <article className="admin-slot-card">
      <h4>{label}</h4>
      <p className="muted admin-table-sub">Current: {activeArticleId || 'None'}</p>
      <select
        className="field-input"
        value={selectedArticleId}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => onSelect(event.target.value)}
      >
        <option value="">Select published article</option>
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {item.title}
          </option>
        ))}
      </select>
      <div className="admin-row-actions">
        <button type="button" className="btn btn-solid" disabled={busy || !selectedArticleId} onClick={onAssign}>
          Assign
        </button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClear}>
          Clear
        </button>
      </div>
    </article>
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
