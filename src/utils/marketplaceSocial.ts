import { Product, UserAccount, UserProfile } from '../types';

export interface SellerDirectoryEntry {
  key: string;
  sellerId?: string;
  brandName: string;
  ownerName?: string;
  city: string;
  description?: string;
  avatarUrl?: string;
  verified: boolean;
  activeListingsCount: number;
  rating: number;
  isCurrentUser: boolean;
  previewImages: string[];
}

const FOLLOWER_DELTAS_KEY = 'aroos_store_follower_deltas_v1';

export function normalizeStoreKey(nameOrHandle: string): string {
  return nameOrHandle.trim().toLowerCase();
}

export function normalizeFollowingEntryKey(rawKey: string): string {
  const trimmed = rawKey.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('id:')) return trimmed;
  return trimmed.toLowerCase();
}

export function getStoreUniqueKey(brandName: string, sellerId?: string | null): string {
  const cleanId = (sellerId || '').trim();
  if (cleanId) {
    return `id:${cleanId}`;
  }
  return normalizeStoreKey(brandName);
}

export function isStoreFollowed(
  followingStores: string[],
  brandName: string,
  sellerId?: string | null
): boolean {
  const cleanId = (sellerId || '').trim();
  if (cleanId) {
    return followingStores.includes(`id:${cleanId}`);
  }
  const nameKey = normalizeStoreKey(brandName);
  return Boolean(nameKey && followingStores.includes(nameKey));
}

export function getFollowingStorageKey(accountId?: string | null): string | null {
  return accountId ? `aroos_following_${accountId}` : null;
}

export function loadFollowingStores(accountId?: string | null): string[] {
  const key = getFollowingStorageKey(accountId);
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? Array.from(new Set(parsed.map((v) => normalizeFollowingEntryKey(String(v))).filter(Boolean)))
      : [];
  } catch {
    return [];
  }
}

export function saveFollowingStores(accountId: string, stores: string[]): void {
  const key = getFollowingStorageKey(accountId);
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(new Set(stores))));
  } catch {}
}

export function loadFollowerDeltas(): Record<string, number> {
  try {
    const raw = localStorage.getItem(FOLLOWER_DELTAS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function updateFollowerDelta(
  storeName: string,
  delta: 1 | -1,
  sellerId?: string | null
): Record<string, number> {
  const key = getStoreUniqueKey(storeName, sellerId);
  const current = loadFollowerDeltas();
  const nextVal = (Number(current[key]) || 0) + delta;
  const next = { ...current, [key]: nextVal };
  try {
    localStorage.setItem(FOLLOWER_DELTAS_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

function getBaseSeededFollowers(storeKey: string): number {
  if (!storeKey) return 0;
  let hash = 0;
  for (let i = 0; i < storeKey.length; i++) {
    hash = (hash * 31 + storeKey.charCodeAt(i)) % 97;
  }
  return 14 + hash;
}

export function getStoreFollowerCount(
  storeName: string,
  followingStores: string[],
  deltas: Record<string, number>,
  isOwnStore = false,
  sellerId?: string | null
): number {
  const key = getStoreUniqueKey(storeName, sellerId);
  if (!key) return 0;
  const base = isOwnStore ? 0 : getBaseSeededFollowers(key);
  const delta = Number(deltas[key]) || 0;
  const isCurrentlyFollowed = isStoreFollowed(followingStores, storeName, sellerId);
  return Math.max(isCurrentlyFollowed ? 1 : 0, base + delta);
}

export function getRecentlyViewedStorageKey(accountId?: string | null): string {
  return `aroos_recent_views_${accountId || 'guest'}`;
}

export function loadRecentlyViewedIds(accountId?: string | null): string[] {
  const key = getRecentlyViewedStorageKey(accountId);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function saveRecentlyViewedIds(accountId: string | null | undefined, ids: string[]): void {
  const key = getRecentlyViewedStorageKey(accountId);
  try {
    localStorage.setItem(key, JSON.stringify(ids.slice(0, 12)));
  } catch {}
}

export function pushRecentlyViewedId(currentIds: string[], productId: string, max = 12): string[] {
  const filtered = currentIds.filter((id) => id !== productId);
  return [productId, ...filtered].slice(0, max);
}

export function buildSellerDirectory(
  products: Product[],
  users: UserAccount[],
  currentProfile: UserProfile
): SellerDirectoryEntry[] {
  const map = new Map<string, SellerDirectoryEntry>();
  const currentUserBrandKey = currentProfile.isRegistered
    ? normalizeStoreKey(currentProfile.brandName || currentProfile.name || '')
    : '';

  const isSameAccount = (brandName: string, sellerId?: string | null): boolean => {
    if (!currentProfile.isRegistered) return false;
    if (sellerId && currentProfile.id) {
      return sellerId === currentProfile.id;
    }
    return Boolean(currentUserBrandKey) && normalizeStoreKey(brandName) === currentUserBrandKey;
  };

  // Count distinct registered users per normalized brand name to avoid merging legacy products without sellerId onto ambiguous accounts
  const userIdsByBrand = new Map<string, string[]>();
  users.forEach((u) => {
    const bKey = normalizeStoreKey(u.sellerProfile?.brandName || u.name || '');
    if (bKey) {
      const arr = userIdsByBrand.get(bKey) || [];
      if (!arr.includes(u.id)) arr.push(u.id);
      userIdsByBrand.set(bKey, arr);
    }
  });
  if (currentProfile.isRegistered && currentProfile.id && currentUserBrandKey) {
    const arr = userIdsByBrand.get(currentUserBrandKey) || [];
    if (!arr.includes(currentProfile.id)) arr.push(currentProfile.id);
    userIdsByBrand.set(currentUserBrandKey, arr);
  }

  // 1. Seed from active products first
  products.forEach((p) => {
    if (p.isActive === false) return;
    const displayBrand = (p.sellerBrandName || p.brand || '').trim();
    if (!displayBrand) return;

    let resolvedSellerId = p.sellerId;
    if (!resolvedSellerId) {
      const candidateIds = userIdsByBrand.get(normalizeStoreKey(displayBrand)) || [];
      if (candidateIds.length === 1) {
        resolvedSellerId = candidateIds[0];
      }
    }

    const key = getStoreUniqueKey(displayBrand, resolvedSellerId);
    if (!key) return;

    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        sellerId: resolvedSellerId,
        brandName: displayBrand,
        city: p.brandCity || 'Indonesia',
        avatarUrl: p.sellerAvatar,
        verified: Boolean(p.verifiedBrand),
        activeListingsCount: 1,
        rating: p.rating || 4.9,
        isCurrentUser: isSameAccount(displayBrand, resolvedSellerId),
        previewImages: p.image ? [p.image] : [],
      });
    } else {
      const nextCount = existing.activeListingsCount + 1;
      const nextAvg =
        (existing.rating * existing.activeListingsCount + (p.rating || 4.9)) / nextCount;
      const nextPreviews =
        p.image && existing.previewImages.length < 3 && !existing.previewImages.includes(p.image)
          ? [...existing.previewImages, p.image]
          : existing.previewImages;

      map.set(key, {
        ...existing,
        sellerId: existing.sellerId || resolvedSellerId,
        avatarUrl: existing.avatarUrl || p.sellerAvatar,
        verified: existing.verified || Boolean(p.verifiedBrand),
        activeListingsCount: nextCount,
        rating: Number(nextAvg.toFixed(1)),
        previewImages: nextPreviews,
      });
    }
  });

  // 2. Enrich and merge registered users from userDb (strictly keyed by sellerId so same names never collide)
  const mergeUserAccount = (acc: {
    id?: string;
    name: string;
    avatarUrl?: string;
    brandName?: string;
    city?: string;
    description?: string;
    verified?: boolean;
  }) => {
    const brandName = (acc.brandName || acc.name || '').trim();
    const key = getStoreUniqueKey(brandName, acc.id);
    if (!key) return;

    const existing = map.get(key);
    const isMe = isSameAccount(brandName, acc.id);

    if (existing) {
      map.set(key, {
        ...existing,
        sellerId: existing.sellerId || acc.id,
        ownerName:
          acc.name && normalizeStoreKey(acc.name) !== normalizeStoreKey(brandName)
            ? acc.name
            : existing.ownerName,
        city: existing.city !== 'Indonesia' ? existing.city : acc.city || existing.city,
        description: existing.description || acc.description,
        avatarUrl: existing.avatarUrl || acc.avatarUrl,
        verified: existing.verified || Boolean(acc.verified),
        isCurrentUser: isMe,
      });
    } else {
      map.set(key, {
        key,
        sellerId: acc.id,
        brandName,
        ownerName:
          acc.name && normalizeStoreKey(acc.name) !== normalizeStoreKey(brandName)
            ? acc.name
            : undefined,
        city: acc.city || 'Indonesia',
        description: acc.description,
        avatarUrl: acc.avatarUrl,
        verified: Boolean(acc.verified),
        activeListingsCount: 0,
        rating: 4.9,
        isCurrentUser: isMe,
        previewImages: [],
      });
    }
  };

  users.forEach((u) => {
    mergeUserAccount({
      id: u.id,
      name: u.name,
      avatarUrl: u.avatarUrl,
      brandName: u.sellerProfile?.brandName || u.name,
      city: u.sellerProfile?.brandCity || u.buyerProfile?.city || 'Indonesia',
      description: u.sellerProfile?.brandDescription,
      verified: u.sellerProfile?.verifiedBrand,
    });
  });

  if (currentProfile.isRegistered) {
    mergeUserAccount({
      id: currentProfile.id,
      name: currentProfile.name,
      avatarUrl: currentProfile.avatarUrl,
      brandName: currentProfile.brandName || currentProfile.name,
      city: currentProfile.brandCity || currentProfile.buyerProfile?.city || 'Indonesia',
      description: currentProfile.sellerProfile?.brandDescription,
      verified: currentProfile.sellerProfile?.verifiedBrand ?? true,
    });
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.activeListingsCount !== a.activeListingsCount) {
      return b.activeListingsCount - a.activeListingsCount;
    }
    return a.brandName.localeCompare(b.brandName);
  });
}

export function buildProductShareUrl(productId: string): string {
  if (typeof window === 'undefined') return `?item=${encodeURIComponent(productId)}`;
  const url = new URL(window.location.href);
  url.searchParams.delete('toko');
  url.searchParams.delete('sid');
  url.searchParams.set('item', productId);
  return url.toString();
}

export function buildStoreShareUrl(brandName: string, sellerId?: string): string {
  if (typeof window === 'undefined') {
    return sellerId
      ? `?toko=${encodeURIComponent(brandName)}&sid=${encodeURIComponent(sellerId)}`
      : `?toko=${encodeURIComponent(brandName)}`;
  }
  const url = new URL(window.location.href);
  url.searchParams.delete('item');
  url.searchParams.set('toko', brandName);
  if (sellerId) {
    url.searchParams.set('sid', sellerId);
  } else {
    url.searchParams.delete('sid');
  }
  return url.toString();
}

export interface StoreFollower {
  id: string;
  sellerId?: string;
  displayName: string;
  handle: string;
  city: string;
  avatarUrl?: string;
  storeName?: string;
  isVerified?: boolean;
  isCurrentUser?: boolean;
  followedAtLabel: string;
}

const COMMUNITY_FOLLOWER_FIRST_NAMES = [
  'Nadia', 'Raka', 'Citra', 'Dimas', 'Tari', 'Fajar', 'Klara', 'Kevin',
  'Maya', 'Rendra', 'Salsa', 'Bagas', 'Laras', 'Aldi', 'Vina', 'Ilham',
  'Putri', 'Reza', 'Gita', 'Hendra', 'Dewi', 'Naufal', 'Aulia', 'Bima',
];

const COMMUNITY_FOLLOWER_LAST_NAMES = [
  'Kusuma', 'Pratama', 'Lestari', 'Aditya', 'Wulandari', 'Nugroho', 'Wijaya', 'Halim',
  'Sari', 'Ramadhan', 'Maharani', 'Santosa', 'Puspita', 'Saputra', 'Permata', 'Maulana',
];

const COMMUNITY_CITIES = [
  'Jakarta Selatan', 'Bandung', 'Yogyakarta', 'Surabaya', 'Solo',
  'Semarang', 'Depok', 'Tangerang', 'Malang', 'Denpasar', 'Bekasi', 'Bogor',
];

const FOLLOW_TIME_LABELS = [
  '2 jam lalu', 'Kemarin', '2 hari lalu', '4 hari lalu', '1 minggu lalu',
  '2 minggu lalu', '3 minggu lalu', '1 bulan lalu', '2 bulan lalu',
];

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function toHandle(name: string): string {
  const clean = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `@${clean || 'pengguna'}`;
}

export function getStoreFollowersList(params: {
  brandName: string;
  sellerId?: string | null;
  targetCount: number;
  sellers: SellerDirectoryEntry[];
  users: UserAccount[];
  currentProfile: UserProfile;
  isFollowedByCurrentUser: boolean;
  isOwnStore: boolean;
}): StoreFollower[] {
  const {
    brandName,
    sellerId,
    targetCount,
    sellers,
    users,
    currentProfile,
    isFollowedByCurrentUser,
    isOwnStore,
  } = params;

  if (targetCount <= 0 || !brandName.trim()) return [];

  const targetKey = getStoreUniqueKey(brandName, sellerId);
  const currentUserKey = currentProfile.isRegistered
    ? getStoreUniqueKey(currentProfile.brandName || currentProfile.name || '', currentProfile.id)
    : '';
  const seed = hashString(targetKey);
  const result: StoreFollower[] = [];
  const usedIds = new Set<string>();
  const usedHandles = new Set<string>();

  // 1. Prepend the current user when viewing another store they follow
  if (!isOwnStore && currentProfile.isRegistered && isFollowedByCurrentUser) {
    const handle = toHandle(currentProfile.name || currentProfile.brandName || 'anda');
    usedHandles.add(handle);
    if (currentProfile.id) usedIds.add(currentProfile.id);
    result.push({
      id: currentProfile.id || 'follower-current-user',
      sellerId: currentProfile.id,
      displayName: currentProfile.name || currentProfile.brandName || 'Anda',
      handle,
      city: currentProfile.brandCity || currentProfile.buyerProfile?.city || 'Indonesia',
      avatarUrl: currentProfile.avatarUrl,
      storeName: currentProfile.brandName || currentProfile.name,
      isVerified: Boolean(currentProfile.sellerProfile?.verifiedBrand),
      isCurrentUser: true,
      followedAtLabel: 'Baru saja',
    });
  }

  // 2. Build pool of real registered accounts & stores in the marketplace
  const realPool: Omit<StoreFollower, 'followedAtLabel'>[] = [];

  sellers.forEach((seller) => {
    if (seller.key === targetKey || seller.isCurrentUser) return;
    const entryId = seller.sellerId || `follower-seller-${seller.key}`;
    if (usedIds.has(entryId)) return;
    usedIds.add(entryId);
    const displayName = seller.ownerName || seller.brandName;
    const handle = toHandle(seller.ownerName || seller.brandName);
    realPool.push({
      id: entryId,
      sellerId: seller.sellerId,
      displayName,
      handle,
      city: seller.city || 'Indonesia',
      avatarUrl: seller.avatarUrl,
      storeName: seller.brandName,
      isVerified: seller.verified,
    });
  });

  users.forEach((u) => {
    const uBrand = u.sellerProfile?.brandName || u.name;
    const uKey = getStoreUniqueKey(uBrand, u.id);
    if (u.id === currentProfile.id || uKey === targetKey || uKey === currentUserKey) return;
    if (usedIds.has(u.id)) return;
    usedIds.add(u.id);
    const handle = toHandle(u.name);
    realPool.push({
      id: u.id,
      sellerId: u.id,
      displayName: u.name,
      handle,
      city: u.sellerProfile?.brandCity || u.buyerProfile?.city || 'Indonesia',
      avatarUrl: u.avatarUrl,
      storeName: uBrand,
      isVerified: Boolean(u.sellerProfile?.verifiedBrand),
    });
  });

  if (realPool.length > 0 && result.length < targetCount) {
    const offset = seed % realPool.length;
    for (let i = 0; i < realPool.length && result.length < targetCount; i++) {
      const candidate = realPool[(offset + i) % realPool.length];
      result.push({
        ...candidate,
        followedAtLabel: FOLLOW_TIME_LABELS[(seed + i) % FOLLOW_TIME_LABELS.length],
      });
    }
  }

  let idx = 0;
  while (result.length < targetCount && idx < 200) {
    const firstIdx = (seed + idx * 7) % COMMUNITY_FOLLOWER_FIRST_NAMES.length;
    const lastIdx = (seed + idx * 11 + Math.floor(idx / COMMUNITY_FOLLOWER_FIRST_NAMES.length)) %
      COMMUNITY_FOLLOWER_LAST_NAMES.length;
    const displayName = `${COMMUNITY_FOLLOWER_FIRST_NAMES[firstIdx]} ${COMMUNITY_FOLLOWER_LAST_NAMES[lastIdx]}`;
    const baseHandle = toHandle(displayName);
    const handle = usedHandles.has(baseHandle) ? `${baseHandle}${idx + 1}` : baseHandle;
    usedHandles.add(handle);

    const city = COMMUNITY_CITIES[(seed + idx * 5) % COMMUNITY_CITIES.length];
    const followedAtLabel = FOLLOW_TIME_LABELS[(seed + idx * 3) % FOLLOW_TIME_LABELS.length];

    result.push({
      id: `follower-comm-${targetKey}-${idx}`,
      displayName,
      handle,
      city,
      followedAtLabel,
    });
    idx++;
  }

  return result;
}

export function getStoreFollowingCount(
  storeName: string,
  ownFollowingStores: string[],
  sellersCount: number,
  isOwnStore = false,
  sellerId?: string | null
): number {
  const key = getStoreUniqueKey(storeName, sellerId);
  if (!key) return 0;
  if (isOwnStore) return ownFollowingStores.length;
  const maxAvailable = Math.max(0, sellersCount - 1);
  if (maxAvailable === 0) return 0;
  const seed = hashString(`following::${key}`);
  return Math.min(maxAvailable, 3 + (seed % 7));
}

export function getStoreFollowingList(params: {
  brandName: string;
  sellerId?: string | null;
  ownFollowingStores: string[];
  sellers: SellerDirectoryEntry[];
  isOwnStore: boolean;
}): StoreFollower[] {
  const { brandName, sellerId, ownFollowingStores, sellers, isOwnStore } = params;
  const targetKey = getStoreUniqueKey(brandName, sellerId);
  if (!targetKey) return [];

  const sellerByKey = new Map(sellers.map((s) => [s.key, s]));
  const sellerByNameKey = new Map<string, SellerDirectoryEntry>();
  sellers.forEach((s) => {
    const nKey = normalizeStoreKey(s.brandName);
    if (!sellerByNameKey.has(nKey)) sellerByNameKey.set(nKey, s);
  });

  if (isOwnStore) {
    return ownFollowingStores.map((key) => {
      const seller = sellerByKey.get(key) || sellerByNameKey.get(key);
      const displayName = seller?.brandName || (key.startsWith('id:') ? 'Lapak Terdaftar' : key);
      return {
        id: seller?.sellerId || `following-own-${key}`,
        sellerId: seller?.sellerId,
        displayName: seller?.ownerName || displayName,
        handle: toHandle(seller?.ownerName || displayName),
        city: seller?.city || 'Indonesia',
        avatarUrl: seller?.avatarUrl,
        storeName: displayName,
        isVerified: Boolean(seller?.verified),
        followedAtLabel: 'Diikuti',
      };
    });
  }

  const candidateSellers = sellers.filter((s) => s.key !== targetKey && !s.isCurrentUser);
  if (candidateSellers.length === 0) return [];

  const count = getStoreFollowingCount(
    brandName,
    ownFollowingStores,
    candidateSellers.length + 1,
    false,
    sellerId
  );
  const seed = hashString(`following::${targetKey}`);
  const offset = seed % candidateSellers.length;
  const result: StoreFollower[] = [];

  for (let i = 0; i < count && i < candidateSellers.length; i++) {
    const seller = candidateSellers[(offset + i) % candidateSellers.length];
    result.push({
      id: seller.sellerId || `following-${targetKey}-${seller.key}`,
      sellerId: seller.sellerId,
      displayName: seller.ownerName || seller.brandName,
      handle: toHandle(seller.ownerName || seller.brandName),
      city: seller.city || 'Indonesia',
      avatarUrl: seller.avatarUrl,
      storeName: seller.brandName,
      isVerified: seller.verified,
      followedAtLabel: FOLLOW_TIME_LABELS[(seed + i * 2) % FOLLOW_TIME_LABELS.length],
    });
  }

  return result;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below when clipboard permissions are restricted inside iframe
    }
  }

  if (typeof document === 'undefined') return false;
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
