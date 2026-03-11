import { getApiBase } from '@features/auth';

export type AdminUserRole = 'user' | 'moderator' | 'admin';

export type AdminUser = {
  id: string;
  username: string;
  discordId: string;
  role: AdminUserRole;
  avatarUrl: string | null;
  suspendedAt: string | null;
  suspendedReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminDashboardMetrics = {
  users: {
    total: number;
    active: number;
    suspended: number;
    newLast7Days: number;
  };
  articles: {
    total: number;
    drafts: number;
    published: number;
    publishedLast7Days: number;
  };
  recentActions: Array<{
    id: string;
    actorUserId: string;
    action: string;
    targetType: string;
    targetId: string;
    createdAt: string;
  }>;
};

export type AdminWorkspaceSection = 'overview' | 'articles' | 'users';

export type AdminNewsStatus = 'draft' | 'published';
export type AdminNewsSlot = 'primary' | 'secondary' | 'third';

export type AdminNewsArticle = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string[];
  imageUrl: string;
  category: string;
  status: AdminNewsStatus;
  publishedAt: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

async function apiRequest<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    accessToken: string;
    body?: JsonValue;
  },
): Promise<T> {
  const response = await fetch(`${getApiBase()}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Request failed');
    throw new Error(errorText || 'Request failed');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function getAdminDashboardMetrics(accessToken: string): Promise<AdminDashboardMetrics> {
  return apiRequest<AdminDashboardMetrics>('/admin/dashboard/metrics', {
    accessToken,
  });
}

export async function listAdminUsers(
  accessToken: string,
  params?: {
    search?: string;
    role?: AdminUserRole;
    suspended?: boolean;
    limit?: number;
    offset?: number;
    orderBy?: 'created_at' | 'updated_at' | 'username';
    order?: 'asc' | 'desc';
  },
): Promise<{ items: AdminUser[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.role) query.set('role', params.role);
  if (params?.suspended !== undefined) query.set('suspended', String(params.suspended));
  if (params?.limit !== undefined) query.set('limit', String(params.limit));
  if (params?.offset !== undefined) query.set('offset', String(params.offset));
  if (params?.orderBy) query.set('orderBy', params.orderBy);
  if (params?.order) query.set('order', params.order);

  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  return apiRequest<{ items: AdminUser[]; total: number }>(`/admin/users${suffix}`, {
    accessToken,
  });
}

export async function getAdminUserById(accessToken: string, userId: string): Promise<AdminUser> {
  const data = await apiRequest<{ user: AdminUser }>(`/admin/users/${encodeURIComponent(userId)}`, {
    accessToken,
  });
  return data.user;
}

export async function changeAdminUserRole(
  accessToken: string,
  userId: string,
  role: AdminUserRole,
): Promise<AdminUser> {
  const data = await apiRequest<{ user: AdminUser }>(`/admin/users/${encodeURIComponent(userId)}/role`, {
    accessToken,
    method: 'PATCH',
    body: { role },
  });
  return data.user;
}

export async function suspendAdminUser(
  accessToken: string,
  userId: string,
  reason?: string,
): Promise<AdminUser> {
  const body = reason ? ({ reason } as JsonValue) : ({} as JsonValue);
  const data = await apiRequest<{ user: AdminUser }>(`/admin/users/${encodeURIComponent(userId)}/suspend`, {
    accessToken,
    method: 'POST',
    body,
  });
  return data.user;
}

export async function restoreAdminUser(accessToken: string, userId: string): Promise<AdminUser> {
  const data = await apiRequest<{ user: AdminUser }>(`/admin/users/${encodeURIComponent(userId)}/restore`, {
    accessToken,
    method: 'POST',
    body: {},
  });
  return data.user;
}

export async function listAdminNewsArticles(
  accessToken: string,
  params?: {
    status?: AdminNewsStatus;
    search?: string;
    limit?: number;
    offset?: number;
    orderBy?: 'created_at' | 'updated_at' | 'published_at' | 'title';
    order?: 'asc' | 'desc';
  },
): Promise<{ items: AdminNewsArticle[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.search) query.set('search', params.search);
  if (params?.limit !== undefined) query.set('limit', String(params.limit));
  if (params?.offset !== undefined) query.set('offset', String(params.offset));
  if (params?.orderBy) query.set('orderBy', params.orderBy);
  if (params?.order) query.set('order', params.order);

  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  return apiRequest<{ items: AdminNewsArticle[]; total: number }>(`/news/admin/articles${suffix}`, {
    accessToken,
  });
}

export async function createAdminNewsArticle(
  accessToken: string,
  payload: {
    title: string;
    summary: string;
    content: string[];
    imageUrl: string;
    category: string;
  },
): Promise<AdminNewsArticle> {
  const data = await apiRequest<{ article: AdminNewsArticle }>('/news/admin/articles', {
    accessToken,
    method: 'POST',
    body: payload,
  });
  return data.article;
}

export async function updateAdminNewsArticle(
  accessToken: string,
  articleId: string,
  payload: Partial<{
    title: string;
    summary: string;
    content: string[];
    imageUrl: string;
    category: string;
  }>,
): Promise<AdminNewsArticle> {
  const data = await apiRequest<{ article: AdminNewsArticle }>(`/news/admin/articles/${encodeURIComponent(articleId)}`, {
    accessToken,
    method: 'PATCH',
    body: payload as JsonValue,
  });
  return data.article;
}

export async function setAdminNewsStatus(
  accessToken: string,
  articleId: string,
  status: AdminNewsStatus,
): Promise<AdminNewsArticle> {
  const data = await apiRequest<{ article: AdminNewsArticle }>(
    `/news/admin/articles/${encodeURIComponent(articleId)}/status`,
    {
      accessToken,
      method: 'PATCH',
      body: { status },
    },
  );
  return data.article;
}

export async function deleteAdminNewsArticle(accessToken: string, articleId: string): Promise<void> {
  await apiRequest<{ ok: true }>(`/news/admin/articles/${encodeURIComponent(articleId)}`, {
    accessToken,
    method: 'DELETE',
  });
}

export async function assignAdminNewsHomeSlot(
  accessToken: string,
  slot: AdminNewsSlot,
  articleId: string,
): Promise<{ slot: AdminNewsSlot; articleId: string }> {
  const data = await apiRequest<{ assignment: { slot: AdminNewsSlot; articleId: string } }>(
    `/news/admin/home-slots/${slot}/${encodeURIComponent(articleId)}`,
    {
      accessToken,
      method: 'POST',
      body: {},
    },
  );
  return data.assignment;
}

export async function clearAdminNewsHomeSlot(accessToken: string, slot: AdminNewsSlot): Promise<void> {
  await apiRequest<{ ok: true }>(`/news/admin/home-slots/${slot}`, {
    accessToken,
    method: 'DELETE',
  });
}

export async function getPublicNewsHomepage(accessToken: string): Promise<{
  primary: AdminNewsArticle | null;
  secondary: AdminNewsArticle | null;
  third: AdminNewsArticle | null;
}> {
  return apiRequest<{
    primary: AdminNewsArticle | null;
    secondary: AdminNewsArticle | null;
    third: AdminNewsArticle | null;
  }>('/news/public/home', {
    accessToken,
  });
}
