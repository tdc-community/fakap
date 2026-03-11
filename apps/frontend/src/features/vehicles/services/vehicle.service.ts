import { getApiBase } from '@features/auth';

export type VehiclePostVote = -1 | 0 | 1;

export type VehiclePost = {
  id: string;
  title: string;
  description: string;
  imageUrls: string[];
  authorName: string;
  createdAt: string;
  upvotes: number;
  downvotes: number;
  viewerVote: VehiclePostVote;
};

export type CreateVehiclePostInput = {
  title: string;
  description: string;
  imageUrls: string[];
  authorName: string;
};

type VehicleEvent = {
  type: 'created' | 'voted';
  post: VehiclePost;
};

const API_BASE = getApiBase();

function sortPosts(items: VehiclePost[]): VehiclePost[] {
  return [...items].sort((a, b) => {
    const scoreDiff = b.upvotes - b.downvotes - (a.upvotes - a.downvotes);
    if (scoreDiff !== 0) return scoreDiff;
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}

export async function getVehiclePosts(accessToken?: string): Promise<VehiclePost[]> {
  if (!accessToken) {
    throw new Error('Missing access token');
  }

  const response = await fetch(`${API_BASE}/vehicles/posts`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error('Vehicle posts request failed');
  const data = (await response.json()) as { posts: VehiclePost[] };
  return sortPosts(data.posts);
}

export async function createVehiclePost(input: CreateVehiclePostInput, accessToken?: string): Promise<VehiclePost> {
  if (!accessToken) {
    throw new Error('Missing access token');
  }

  const response = await fetch(`${API_BASE}/vehicles/posts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: input.title,
      description: input.description,
      imageUrls: input.imageUrls,
    }),
  });
  if (!response.ok) throw new Error('Create vehicle post failed');
  const data = (await response.json()) as { post: VehiclePost };
  return data.post;
}

export async function voteVehiclePost(postId: string, vote: VehiclePostVote, accessToken?: string): Promise<VehiclePost> {
  if (!accessToken) {
    throw new Error('Missing access token');
  }

  const response = await fetch(`${API_BASE}/vehicles/posts/${encodeURIComponent(postId)}/vote`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ vote }),
  });
  if (!response.ok) throw new Error('Vote vehicle post failed');
  const data = (await response.json()) as { post: VehiclePost };
  return data.post;
}

export async function deleteVehiclePost(postId: string, accessToken?: string): Promise<void> {
  if (!accessToken) {
    throw new Error('Missing access token');
  }

  const response = await fetch(`${API_BASE}/vehicles/posts/${encodeURIComponent(postId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Delete vehicle post failed');
  }
}

export function subscribeVehicleStream(
  callbacks: {
    onEvent: (event: VehicleEvent) => void;
    onError?: () => void;
  },
): () => void {
  const source = new EventSource(`${API_BASE}/vehicles/stream`);

  source.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data) as VehicleEvent | { type: 'heartbeat' };
      if ('post' in payload) {
        callbacks.onEvent(payload);
      }
    } catch {
      // ignore malformed event payloads
    }
  };

  source.onerror = () => {
    callbacks.onError?.();
  };

  return () => {
    source.close();
  };
}
