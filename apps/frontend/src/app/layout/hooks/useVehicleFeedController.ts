import { useEffect, useRef, useState } from 'react';
import { getStoredTokens, type AppRole, type SessionUser } from '@features/auth/services/auth.service';
import {
  createVehiclePost,
  deleteVehiclePost,
  getVehiclePosts,
  subscribeVehicleStream,
  voteVehiclePost,
  type VehiclePost,
  type VehiclePostVote,
} from '@features/vehicles';

export function useVehicleFeedController(input: {
  current: string;
  authChecked: boolean;
  sessionUser: SessionUser | null;
  role: 'guest' | AppRole;
}) {
  const [vehicleState, setVehicleState] = useState<'idle' | 'loading' | 'ready' | 'empty' | 'error'>('idle');
  const [vehicleItems, setVehicleItems] = useState<VehiclePost[]>([]);
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [vehicleTitle, setVehicleTitle] = useState('');
  const [vehicleDescription, setVehicleDescription] = useState('');
  const [vehicleModalImages, setVehicleModalImages] = useState<string[]>([]);
  const [vehicleFormState, setVehicleFormState] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [vehicleFormMessage, setVehicleFormMessage] = useState<string | null>(null);
  const [vehicleImageError, setVehicleImageError] = useState<string | null>(null);
  const [vehicleDeleteState, setVehicleDeleteState] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [vehicleDeleteError, setVehicleDeleteError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ postId: string; index: number } | null>(null);
  const vehicleModalRef = useRef<HTMLDivElement | null>(null);
  const vehicleModalFirstInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const run = async (): Promise<void> => {
      if (input.current !== 'vehicles') {
        return;
      }

      if (!input.authChecked) {
        setVehicleState('loading');
        return;
      }

      if (!input.sessionUser) {
        setVehicleItems([]);
        setVehicleState('idle');
        return;
      }

      const { accessToken } = getStoredTokens();
      if (!accessToken) {
        setVehicleItems([]);
        setVehicleState('error');
        return;
      }

      setVehicleState('loading');
      try {
        const items = await getVehiclePosts(accessToken);
        setVehicleItems(sortVehiclePosts(items));
        setVehicleState(items.length ? 'ready' : 'empty');
      } catch {
        setVehicleState('error');
      }
    };

    void run();
  }, [input.authChecked, input.current, input.sessionUser]);

  useEffect(() => {
    if (input.current !== 'vehicles' || !input.authChecked || !input.sessionUser) return;

    const unsubscribe = subscribeVehicleStream({
      onEvent: (event) => {
        setVehicleItems((prev: VehiclePost[]) => sortVehiclePosts([event.post, ...prev]));
      },
    });

    return () => unsubscribe();
  }, [input.authChecked, input.current, input.sessionUser]);

  useEffect(() => {
    if (!vehicleModalOpen) {
      return;
    }

    vehicleModalFirstInputRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setVehicleModalOpen(false);
        return;
      }

      if (event.key !== 'Tab') return;
      const root = vehicleModalRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusables.length) return;

      const first = focusables[0] as HTMLElement;
      const last = focusables[focusables.length - 1] as HTMLElement;
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [vehicleModalOpen]);

  useEffect(() => {
    if (!lightbox) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setLightbox(null);
        return;
      }

      const post = vehicleItems.find((item: VehiclePost) => item.id === lightbox.postId);
      if (!post || post.imageUrls.length <= 1) return;

      if (event.key === 'ArrowRight') {
        setLightbox((prev: { postId: string; index: number } | null) => {
          if (!prev || prev.postId !== lightbox.postId) return prev;
          return { ...prev, index: (prev.index + 1) % post.imageUrls.length };
        });
      }

      if (event.key === 'ArrowLeft') {
        setLightbox((prev: { postId: string; index: number } | null) => {
          if (!prev || prev.postId !== lightbox.postId) return prev;
          return { ...prev, index: (prev.index - 1 + post.imageUrls.length) % post.imageUrls.length };
        });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [lightbox, vehicleItems]);

  const handleCreateVehiclePost = async (): Promise<void> => {
    if (!input.sessionUser) {
      setVehicleFormState('error');
      setVehicleFormMessage('Login required to submit a car.');
      return;
    }

    if (!vehicleTitle.trim() || !vehicleDescription.trim() || vehicleModalImages.length === 0) {
      setVehicleFormState('error');
      setVehicleFormMessage('Title, description and at least one image are required.');
      return;
    }

    setVehicleFormState('submitting');
    setVehicleFormMessage(null);
    try {
      const { accessToken } = getStoredTokens();
      const created = await createVehiclePost(
        {
          title: vehicleTitle.trim(),
          description: vehicleDescription.trim(),
          imageUrls: vehicleModalImages,
          authorName: input.sessionUser.username,
        },
        accessToken ?? undefined,
      );
      setVehicleItems((prev: VehiclePost[]) => sortVehiclePosts([created, ...prev]));
      setVehicleState('ready');
      setVehicleTitle('');
      setVehicleDescription('');
      setVehicleModalImages([]);
      setVehicleImageError(null);
      setVehicleModalOpen(false);
      setVehicleFormState('idle');
    } catch {
      setVehicleFormState('error');
      setVehicleFormMessage('Could not submit vehicle post.');
    }
  };

  const handleVehicleImagesSelected = async (files: FileList | null): Promise<void> => {
    if (!files || files.length === 0) return;

    const chosen = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (!chosen.length) {
      setVehicleImageError('Only image files are supported.');
      return;
    }

    const availableSlots = Math.max(0, 5 - vehicleModalImages.length);
    if (availableSlots === 0) {
      setVehicleImageError('Maximum 5 images per post.');
      return;
    }

    const selected = chosen.slice(0, availableSlots);
    if (chosen.length > availableSlots) {
      setVehicleImageError('Only first 5 images were kept.');
    } else {
      setVehicleImageError(null);
    }

    try {
      const encoded = await Promise.all(selected.map((file) => readFileAsDataUrl(file)));
      setVehicleModalImages((prev: string[]) => [...prev, ...encoded]);
    } catch {
      setVehicleImageError('Could not read one or more selected images.');
    }
  };

  const removeVehicleImage = (index: number): void => {
    setVehicleModalImages((prev: string[]) => prev.filter((_, idx) => idx !== index));
    setVehicleImageError(null);
  };

  const openLightbox = (post: VehiclePost, startIndex: number): void => {
    setLightbox({ postId: post.id, index: startIndex });
  };

  const handleVoteVehiclePost = async (post: VehiclePost, vote: VehiclePostVote): Promise<void> => {
    const nextVote: VehiclePostVote = post.viewerVote === vote ? 0 : vote;
    const previous = [...vehicleItems];

    const optimistic = applyVoteLocally(post, nextVote);
    setVehicleItems((prev: VehiclePost[]) => sortVehiclePosts(prev.map((item: VehiclePost) => (item.id === post.id ? optimistic : item))));

    try {
      const { accessToken } = getStoredTokens();
      const updated = await voteVehiclePost(post.id, nextVote, accessToken ?? undefined);
      setVehicleItems((prev: VehiclePost[]) => sortVehiclePosts(prev.map((item: VehiclePost) => (item.id === post.id ? updated : item))));
    } catch {
      setVehicleItems(previous);
    }
  };

  const handleDeleteVehiclePost = async (post: VehiclePost): Promise<void> => {
    const { accessToken } = getStoredTokens();
    if (!accessToken) {
      setVehicleDeleteState('error');
      setVehicleDeleteError('Missing access token');
      return;
    }

    setVehicleDeleteState('submitting');
    setVehicleDeleteError(null);
    try {
      await deleteVehiclePost(post.id, accessToken);
      setVehicleItems((prev: VehiclePost[]) => prev.filter((item: VehiclePost) => item.id !== post.id));
      setVehicleDeleteState('idle');
    } catch {
      setVehicleDeleteState('error');
      setVehicleDeleteError('Failed to remove vehicle post');
    }
  };

  const activeLightboxPost = lightbox ? vehicleItems.find((item: VehiclePost) => item.id === lightbox.postId) ?? null : null;
  const activeLightboxImages = activeLightboxPost?.imageUrls ?? [];
  const activeLightboxIndex = lightbox?.index ?? 0;

  return {
    vehicleState,
    vehicleItems,
    vehicleModalOpen,
    setVehicleModalOpen,
    vehicleTitle,
    setVehicleTitle,
    vehicleDescription,
    setVehicleDescription,
    vehicleModalImages,
    vehicleFormState,
    setVehicleFormState,
    vehicleFormMessage,
    setVehicleFormMessage,
    vehicleImageError,
    setVehicleImageError,
    vehicleDeleteState,
    vehicleDeleteError,
    lightbox,
    setLightbox,
    vehicleModalRef,
    vehicleModalFirstInputRef,
    handleCreateVehiclePost,
    handleVehicleImagesSelected,
    removeVehicleImage,
    openLightbox,
    handleVoteVehiclePost,
    handleDeleteVehiclePost,
    activeLightboxPost,
    activeLightboxImages,
    activeLightboxIndex,
    canModerateVehicles: input.role === 'moderator' || input.role === 'admin',
  };
}

function applyVoteLocally(post: VehiclePost, nextVote: VehiclePostVote): VehiclePost {
  let upvotes = post.upvotes;
  let downvotes = post.downvotes;

  if (post.viewerVote === 1) upvotes -= 1;
  if (post.viewerVote === -1) downvotes -= 1;

  if (nextVote === 1) upvotes += 1;
  if (nextVote === -1) downvotes += 1;

  return {
    ...post,
    upvotes,
    downvotes,
    viewerVote: nextVote,
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('File conversion failed'));
      }
    };
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

function sortVehiclePosts(items: VehiclePost[]): VehiclePost[] {
  const deduped: VehiclePost[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    deduped.push(item);
  }

  return deduped.sort((a, b) => {
    const scoreDiff = b.upvotes - b.downvotes - (a.upvotes - a.downvotes);
    if (scoreDiff !== 0) return scoreDiff;
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}
