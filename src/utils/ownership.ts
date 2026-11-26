import { Product, UserProfile } from '../types';

export function normalizeIdentityKey(value?: string | null): string {
  return (value || '').trim().toLowerCase();
}

export function getUserBrandKeys(profile?: UserProfile | null): Set<string> {
  if (!profile || !profile.isRegistered) return new Set();
  return new Set(
    [
      normalizeIdentityKey(profile.brandName),
      normalizeIdentityKey(profile.sellerProfile?.brandName),
      normalizeIdentityKey(profile.name),
    ].filter(Boolean)
  );
}

export function isStoreOwnedByUser(
  storeName?: string | null,
  sellerId?: string | null,
  profile?: UserProfile | null
): boolean {
  if (!profile || !profile.isRegistered) return false;
  if (sellerId && profile.id) {
    return sellerId === profile.id;
  }
  const storeKey = normalizeIdentityKey(storeName);
  if (!storeKey) return false;
  return getUserBrandKeys(profile).has(storeKey);
}

export function isProductOwnedByUser(
  product?: Product | null,
  profile?: UserProfile | null
): boolean {
  if (!product || !profile || !profile.isRegistered) return false;
  if (product.sellerId && profile.id) {
    return product.sellerId === profile.id;
  }
  const userKeys = getUserBrandKeys(profile);
  if (userKeys.size === 0) return false;
  const sellerBrandKey = normalizeIdentityKey(product.sellerBrandName);
  const brandKey = normalizeIdentityKey(product.brand);
  return Boolean(
    (sellerBrandKey && userKeys.has(sellerBrandKey)) ||
      (brandKey && userKeys.has(brandKey))
  );
}
