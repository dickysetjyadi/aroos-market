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
  const normalizedList = followingStores.map(normalizeFollowingEntryKey);
  const cleanId = (sellerId || '').trim();
  if (cleanId) {
    return normalizedList.includes(`id:${cleanId}`);
  }
  const nameKey = normalizeStoreKey(brandName);
  return Boolean(nameKey && normalizedList.includes(nameKey));
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

function getRealFollowerAccounts(params: {
  brandName: string;
  sellerId?: string | null;
  users?: UserAccount[];
  currentProfile?: UserProfile;
  followingStores?: string[];
}): Array<{
  id: string;
  name: string;
  brandName: string;
  city: string;
  avatarUrl?: string;
  verified: boolean;
  isCurrentUser: boolean;
}> {
  const {
    brandName,
    sellerId,
    users = [],
    currentProfile,
    followingStores = [],
  } = params;

  const cleanSellerId = (sellerId || '').trim();
  const normalizedTargetBrand = normalizeStoreKey(brandName);
  if (!cleanSellerId && !normalizedTargetBrand) return [];

  const uniqueUsers = new Map<
    string,
    {
      id: string;
      name: string;
      brandName: string;
      city: string;
      avatarUrl?: string;
      verified: boolean;
      followingList: string[];
      isCurrentUser: boolean;
    }
  >();

  users.forEach((u) => {
    if (!u || !u.id) return;
    const isMe = Boolean(currentProfile?.isRegistered && currentProfile.id === u.id);
    uniqueUsers.set(u.id, {
      id: u.id,
      name: u.name || 'Pengguna AROOS',
      brandName: u.sellerProfile?.brandName || u.name || 'Toko AROOS',
      city: u.sellerProfile?.brandCity || u.buyerProfile?.city || 'Indonesia',
      avatarUrl: u.avatarUrl,
      verified: Boolean(u.sellerProfile?.verifiedBrand),
      followingList: isMe
        ? followingStores
        : Array.isArray(u.buyerProfile?.followingStores)
          ? u.buyerProfile.followingStores
          : [],
      isCurrentUser: isMe,
    });
  });

  if (currentProfile?.isRegistered && currentProfile.id && !uniqueUsers.has(currentProfile.id)) {
    uniqueUsers.set(currentProfile.id, {
      id: currentProfile.id,
      name: currentProfile.name || 'Pengguna AROOS',
      brandName: currentProfile.brandName || currentProfile.name || 'Toko AROOS',
      city: currentProfile.brandCity || currentProfile.buyerProfile?.city || 'Indonesia',
      avatarUrl: currentProfile.avatarUrl,
      verified: Boolean(currentProfile.sellerProfile?.verifiedBrand),
      followingList: followingStores,
      isCurrentUser: true,
    });
  }

  const matched: Array<{
    id: string;
    name: string;
    brandName: string;
    city: string;
    avatarUrl?: string;
    verified: boolean;
    isCurrentUser: boolean;
  }> = [];

  uniqueUsers.forEach((u) => {
    const isTargetOwner = cleanSellerId
      ? u.id === cleanSellerId
      : Boolean(normalizedTargetBrand) && normalizeStoreKey(u.brandName) === normalizedTargetBrand;
    if (isTargetOwner) return;

    if (isStoreFollowed(u.followingList, brandName, cleanSellerId || undefined)) {
      matched.push({
        id: u.id,
        name: u.name,
        brandName: u.brandName,
        city: u.city,
        avatarUrl: u.avatarUrl,
        verified: u.verified,
        isCurrentUser: u.isCurrentUser,
      });
    }
  });

  matched.sort((a, b) => Number(b.isCurrentUser) - Number(a.isCurrentUser));
  return matched;
}

export function getStoreFollowerCount(params: {
  brandName: string;
  sellerId?: string | null;
  users?: UserAccount[];
  currentProfile?: UserProfile;
  followingStores?: string[];
}): number {
  return getRealFollowerAccounts(params).length;
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

function toHandle(name: string): string {
  const clean = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `@${clean || 'pengguna'}`;
}

export function getStoreFollowersList(params: {
  brandName: string;
  sellerId?: string | null;
  users: UserAccount[];
  currentProfile: UserProfile;
  followingStores: string[];
}): StoreFollower[] {
  const matchedAccounts = getRealFollowerAccounts(params);
  return matchedAccounts.map((acc) => ({
    id: acc.id,
    sellerId: acc.id,
    displayName: acc.name,
    handle: toHandle(acc.name),
    city: acc.city || 'Indonesia',
    avatarUrl: acc.avatarUrl,
    storeName: acc.brandName,
    isVerified: acc.verified,
    isCurrentUser: acc.isCurrentUser,
    followedAtLabel: acc.isCurrentUser ? 'Baru saja' : 'Mengikuti',
  }));
}

function findTargetUserFollowingStores(params: {
  brandName: string;
  sellerId?: string | null;
  ownFollowingStores: string[];
  users: UserAccount[];
  isOwnStore: boolean;
}): string[] {
  const { brandName, sellerId, ownFollowingStores, users, isOwnStore } = params;
  if (isOwnStore) return ownFollowingStores;
  const cleanSellerId = (sellerId || '').trim();
  const normalizedTargetBrand = normalizeStoreKey(brandName);
  const targetUser = users.find((u) => {
    if (cleanSellerId && u.id === cleanSellerId) return true;
    const uBrand = normalizeStoreKey(u.sellerProfile?.brandName || u.name || '');
    return !cleanSellerId && Boolean(normalizedTargetBrand) && uBrand === normalizedTargetBrand;
  });
  return Array.isArray(targetUser?.buyerProfile?.followingStores)
    ? targetUser.buyerProfile.followingStores
    : [];
}

export function getStoreFollowingCount(params: {
  brandName: string;
  sellerId?: string | null;
  ownFollowingStores: string[];
  users: UserAccount[];
  isOwnStore: boolean;
}): number {
  return findTargetUserFollowingStores(params).length;
}

export function getStoreFollowingList(params: {
  brandName: string;
  sellerId?: string | null;
  ownFollowingStores: string[];
  sellers: SellerDirectoryEntry[];
  users: UserAccount[];
  isOwnStore: boolean;
}): StoreFollower[] {
  const { brandName, sellerId, ownFollowingStores, sellers, users, isOwnStore } = params;
  const rawList = findTargetUserFollowingStores({
    brandName,
    sellerId,
    ownFollowingStores,
    users,
    isOwnStore,
  });
  if (rawList.length === 0) return [];

  const sellerByKey = new Map(sellers.map((s) => [s.key, s]));
  const sellerByNameKey = new Map<string, SellerDirectoryEntry>();
  sellers.forEach((s) => {
    const nKey = normalizeStoreKey(s.brandName);
    if (!sellerByNameKey.has(nKey)) sellerByNameKey.set(nKey, s);
  });

  const userById = new Map(users.map((u) => [u.id, u]));

  return rawList.map((rawKey) => {
    const key = normalizeFollowingEntryKey(rawKey);
    const idPart = key.startsWith('id:') ? key.slice(3) : undefined;
    const seller = sellerByKey.get(key) || sellerByNameKey.get(key);
    const userRec = idPart ? userById.get(idPart) : undefined;
    const displayStoreName =
      seller?.brandName ||
      userRec?.sellerProfile?.brandName ||
      userRec?.name ||
      (idPart ? 'Lapak Terdaftar' : key);
    const ownerName = seller?.ownerName || userRec?.name || displayStoreName;
    return {
      id: seller?.sellerId || userRec?.id || `following-${key}`,
      sellerId: seller?.sellerId || userRec?.id,
      displayName: ownerName,
      handle: toHandle(ownerName),
      city: seller?.city || userRec?.sellerProfile?.brandCity || userRec?.buyerProfile?.city || 'Indonesia',
      avatarUrl: seller?.avatarUrl || userRec?.avatarUrl,
      storeName: displayStoreName,
      isVerified: Boolean(seller?.verified ?? userRec?.sellerProfile?.verifiedBrand),
      followedAtLabel: 'Diikuti',
    };
  });
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
