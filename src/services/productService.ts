import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  runTransaction,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product } from '../types';
import { INITIAL_PRODUCTS } from '../data/mockData';
import {
  PRODUCT_ASSETS,
  resolveBundledAssetList,
  resolveBundledAssetUrl,
} from '../assets/productAssets';

const STORAGE_KEY = 'nura_products';
const DELETED_IDS_KEY = 'nura_deleted_products';
const DELETED_BASE_SKU = 'DELETED_BASE';
const MAX_FIRESTORE_DOC_BYTES = 820_000;

export function getDeletedProductIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_IDS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

function markProductDeleted(productId: string): void {
  try {
    const ids = getDeletedProductIds();
    ids.add(productId);
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(Array.from(ids).slice(-100)));
  } catch {}
}

function clearProductDeleted(productId: string): void {
  try {
    const ids = getDeletedProductIds();
    if (ids.delete(productId)) {
      localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(Array.from(ids)));
    }
  } catch {}
}

/**
 * Curated preset product images for local Indonesian fashion atelier
 */
export const FASHION_IMAGE_PRESETS = [
  {
    name: 'Batik Outer Sogan Halus',
    url: PRODUCT_ASSETS.productBatikOuter,
    category: 'Batik & Etnik',
  },
  {
    name: 'Relaxed Workshirt Earth Linen',
    url: PRODUCT_ASSETS.productOversizedLinen,
    category: 'Atasan',
  },
  {
    name: 'Sneakers Kanvas Vulkanisir Raw Cream',
    url: PRODUCT_ASSETS.productCanvasSneakers,
    category: 'Sepatu',
  },
  {
    name: 'Tenun Ikat Oversized Blazer',
    url: PRODUCT_ASSETS.heroLocalFashion,
    category: 'Outerwear',
  },
  {
    name: 'Kemeja Katun Sogan Daun',
    url: PRODUCT_ASSETS.productDenimJacket,
    category: 'Atasan',
  },
  {
    name: 'Celana Kulot Linen Ivory',
    url: PRODUCT_ASSETS.studioPleatedTrouser,
    category: 'Bawahan',
  },
  {
    name: 'Tas Selempang Kanvas Lurik',
    url: PRODUCT_ASSETS.studioHeavyweightHoodie,
    category: 'Aksesoris',
  },
];

/**
 * Get locally cached products for initial optimistic paint or offline fallback
 */
export function getLocalProducts(): Product[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_PRODUCTS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item: Product) => ({
        ...item,
        image: resolveBundledAssetUrl(item.image) || item.image,
        images: item.images ? resolveBundledAssetList(item.images) : item.images,
      }));
    }
  } catch {
    // fallback
  }
  return INITIAL_PRODUCTS;
}

/**
 * Save products to local storage cache
 */
export function saveLocalProducts(products: Product[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  } catch {
    // ignore storage quota errors on Safari/iOS private mode
  }
}

function getUtf8ByteLength(value: unknown): number {
  const json = JSON.stringify(value);
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(json).length;
  }
  return json.length * 2;
}

function formatProductFirestoreError(err: unknown): Error {
  const raw = err instanceof Error ? err.message : String(err || '');
  const lower = raw.toLowerCase();
  if (
    lower.includes('longer than') ||
    lower.includes('exceeds the maximum allowed size') ||
    lower.includes('payload') ||
    lower.includes('1048576')
  ) {
    return new Error(
      'Ukuran foto produk terlalu besar untuk disinkronkan ke server. Gunakan foto lebih kecil atau kurangi jumlah foto.'
    );
  }
  if (lower.includes('permission-denied')) {
    return new Error(
      'Data produk tidak memenuhi validasi server. Periksa judul, harga, atau ukuran foto.'
    );
  }
  if (
    lower.includes('unavailable') ||
    lower.includes('network') ||
    lower.includes('offline') ||
    lower.includes('failed to fetch')
  ) {
    return new Error(
      'Koneksi ke server terputus. Produk belum tersimpan lintas perangkat, coba lagi saat jaringan stabil.'
    );
  }
  return new Error(raw || 'Gagal menyimpan produk ke server. Silakan coba lagi.');
}

/**
 * Merge authoritative Firestore products with base catalog defaults.
 * Custom seller listings NOT present in Firestore are NOT resurrected from localStorage,
 * ensuring deletions and new listings align identically across iOS, Safari, and Chrome.
 */
function mergeWithBaseCatalog(firestoreProducts: Product[]): Product[] {
  const baseIds = new Set(INITIAL_PRODUCTS.map((bp) => bp.id));
  const mergedMap = new Map<string, Product>();

  // 1. Seed base catalog defaults (unless marked deleted in Firestore)
  INITIAL_PRODUCTS.forEach((bp) => {
    mergedMap.set(bp.id, {
      ...bp,
      isActive: bp.isActive !== false,
    });
  });

  // 2. Apply authoritative Firestore products
  firestoreProducts.forEach((fp) => {
    if (!fp || !fp.id) return;
    if (fp.sku === DELETED_BASE_SKU && baseIds.has(fp.id)) {
      mergedMap.delete(fp.id);
      return;
    }
    clearProductDeleted(fp.id);
    const resolvedImage = resolveBundledAssetUrl(fp.image) || fp.image;
    const resolvedImages = fp.images ? resolveBundledAssetList(fp.images) : fp.images;
    mergedMap.set(fp.id, {
      ...fp,
      image: resolvedImage,
      images: resolvedImages,
      isActive: fp.isActive !== false,
    });
  });

  // Keep newest custom items before base items
  const allItems = Array.from(mergedMap.values());
  const customItems = allItems.filter((p) => !baseIds.has(p.id));
  const baseItems = allItems.filter((p) => baseIds.has(p.id));
  customItems.sort((a, b) => (b.createdAt || b.id).localeCompare(a.createdAt || a.id));

  return [...customItems, ...baseItems];
}

/**
 * Subscribe in real-time to all products from Cloud Firestore.
 * Firestore snapshot is always authoritative so all devices/browsers see the exact same catalog.
 */
export function subscribeToLiveProducts(
  onUpdate: (products: Product[]) => void,
  onError?: (err: Error) => void
): () => void {
  try {
    const productsCol = collection(db, 'products');

    const unsubscribe = onSnapshot(
      productsCol,
      (snapshot) => {
        const firestoreList: Product[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Product;
          firestoreList.push({
            ...data,
            id: docSnap.id,
          });
        });

        const merged = mergeWithBaseCatalog(firestoreList);
        saveLocalProducts(merged);
        onUpdate(merged);
      },
      (err) => {
        console.warn('Firestore live products subscription fallback to local:', err);
        if (onError) onError(err);
        onUpdate(getLocalProducts());
      }
    );

    return unsubscribe;
  } catch (err: any) {
    console.warn('Could not initialize snapshot listener:', err);
    onUpdate(getLocalProducts());
    return () => {};
  }
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

const VALID_GENDERS = new Set(['Pria', 'Wanita', 'Unisex']);
const VALID_CONDITIONS = new Set(['Baru', 'Pre-loved']);
const VALID_LISTING_STATUSES = new Set(['available', 'reserved', 'sold']);

function sanitizeProductForFirestore(product: Product): Product {
  const safeGender = product.gender && VALID_GENDERS.has(product.gender) ? product.gender : undefined;
  const safeCondition =
    product.condition && VALID_CONDITIONS.has(product.condition) ? product.condition : undefined;
  const safeStatus =
    product.listingStatus && VALID_LISTING_STATUSES.has(product.listingStatus)
      ? product.listingStatus
      : undefined;

  let safeImages = Array.isArray(product.images)
    ? (resolveBundledAssetList(product.images) || [])
        .filter((img): img is string => typeof img === 'string' && img.length > 0 && img.length <= 750000)
        .slice(0, 12)
    : undefined;

  const resolvedPrimaryCandidate = resolveBundledAssetUrl(product.image);
  let safePrimaryImage =
    typeof resolvedPrimaryCandidate === 'string' && resolvedPrimaryCandidate.length <= 750000
      ? resolvedPrimaryCandidate
      : safeImages && safeImages[0]
        ? safeImages[0]
        : '';

  let safeSellerAvatar =
    typeof product.sellerAvatar === 'string' && product.sellerAvatar.length <= 250000
      ? product.sellerAvatar
      : undefined;

  const buildPayload = (): Product =>
    stripUndefined({
      id: String(product.id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128),
      name: String(product.name || 'Produk').trim().slice(0, 200) || 'Produk',
      brand: String(product.brand || 'AROOS').trim().slice(0, 100) || 'AROOS',
      itemBrand: product.itemBrand ? String(product.itemBrand).slice(0, 100) : undefined,
      brandCity: product.brandCity ? String(product.brandCity).slice(0, 80) : undefined,
      category: String(product.category || 'Atasan').trim().slice(0, 80) || 'Atasan',
      subCategory: product.subCategory ? String(product.subCategory).slice(0, 80) : undefined,
      gender: safeGender,
      fit: product.fit ? String(product.fit).slice(0, 80) : undefined,
      measurements:
        product.measurements && typeof product.measurements === 'object'
          ? product.measurements
          : undefined,
      price: Math.max(0, Number(product.price) || 0),
      originalPrice:
        product.originalPrice !== undefined
          ? Math.max(0, Number(product.originalPrice) || 0)
          : undefined,
      stock: Math.max(0, Number(product.stock) || 0),
      sku: product.sku ? String(product.sku).slice(0, 80) : undefined,
      barcode: product.barcode ? String(product.barcode).slice(0, 80) : undefined,
      sizes: Array.isArray(product.sizes)
        ? product.sizes.map((s) => String(s)).slice(0, 30)
        : undefined,
      colors: Array.isArray(product.colors)
        ? product.colors.map((c) => String(c)).slice(0, 30)
        : undefined,
      material: product.material ? String(product.material).slice(0, 200) : undefined,
      image: safePrimaryImage,
      images: safeImages,
      condition: safeCondition,
      listingStatus: safeStatus,
      reservedByUserId:
        product.reservedByUserId !== undefined
          ? String(product.reservedByUserId).slice(0, 128)
          : undefined,
      reservedByUserName:
        product.reservedByUserName !== undefined
          ? String(product.reservedByUserName).slice(0, 100)
          : undefined,
      likesCount:
        product.likesCount !== undefined
          ? Math.max(0, Number(product.likesCount) || 0)
          : undefined,
      allowMeetup: product.allowMeetup !== undefined ? Boolean(product.allowMeetup) : undefined,
      meetupArea: product.meetupArea ? String(product.meetupArea).slice(0, 120) : undefined,
      description: product.description ? String(product.description).slice(0, 4000) : undefined,
      rating:
        product.rating !== undefined
          ? Math.min(5, Math.max(0, Number(product.rating) || 0))
          : undefined,
      reviewsCount:
        product.reviewsCount !== undefined
          ? Math.max(0, Number(product.reviewsCount) || 0)
          : undefined,
      verifiedBrand:
        product.verifiedBrand !== undefined ? Boolean(product.verifiedBrand) : undefined,
      isFeatured: product.isFeatured !== undefined ? Boolean(product.isFeatured) : undefined,
      sellerId: product.sellerId ? String(product.sellerId).slice(0, 128) : undefined,
      sellerBrandName: product.sellerBrandName
        ? String(product.sellerBrandName).slice(0, 100)
        : undefined,
      sellerAvatar: safeSellerAvatar,
      isActive: product.isActive !== false,
      createdAt: String(product.createdAt || new Date().toISOString()).slice(0, 64),
      updatedAt: new Date().toISOString(),
    }) as Product;

  let payload = buildPayload();
  if (getUtf8ByteLength(payload) <= MAX_FIRESTORE_DOC_BYTES) {
    return payload;
  }

  // Budget 1: drop sellerAvatar if document is getting close to 1MB
  if (safeSellerAvatar) {
    safeSellerAvatar = undefined;
    payload = buildPayload();
    if (getUtf8ByteLength(payload) <= MAX_FIRESTORE_DOC_BYTES) {
      return payload;
    }
  }

  // Budget 2: trim extra gallery images while keeping primary photo
  if (safeImages && safeImages.length > 1) {
    while (safeImages.length > 1 && getUtf8ByteLength(payload) > MAX_FIRESTORE_DOC_BYTES) {
      safeImages = safeImages.slice(0, -1);
      payload = buildPayload();
    }
  }

  // Budget 3: if image + images[0] duplicate still exceeds limit, omit redundant images[0]
  if (getUtf8ByteLength(payload) > MAX_FIRESTORE_DOC_BYTES && safeImages && safeImages.length === 1) {
    if (safeImages[0] === safePrimaryImage) {
      safeImages = undefined;
      payload = buildPayload();
    }
  }

  if (getUtf8ByteLength(payload) > MAX_FIRESTORE_DOC_BYTES) {
    throw new Error(
      'Ukuran total foto terlalu besar (>1MB batas server). Silakan unggah foto beresolusi lebih kecil.'
    );
  }

  return payload;
}

/**
 * Save new or edited seller product to Cloud Firestore first; throws on failure.
 */
export async function saveProductToFirestore(product: Product): Promise<void> {
  clearProductDeleted(product.id);
  const payload = sanitizeProductForFirestore(product);

  try {
    const docRef = doc(db, 'products', payload.id);
    await setDoc(docRef, payload, { merge: true });
  } catch (err) {
    throw formatProductFirestoreError(err);
  }

  const current = getLocalProducts();
  const exists = current.some((p) => p.id === payload.id);
  const updated = exists
    ? current.map((p) => (p.id === payload.id ? payload : p))
    : [payload, ...current];
  saveLocalProducts(updated);
}

/**
 * Toggle active/inactive status for a product.
 */
export async function toggleProductActiveStatus(
  productId: string,
  newActiveState: boolean
): Promise<boolean> {
  const nowIso = new Date().toISOString();
  try {
    const docRef = doc(db, 'products', productId);
    await updateDoc(docRef, {
      isActive: newActiveState,
      updatedAt: nowIso,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    const fallbackItem =
      INITIAL_PRODUCTS.find((p) => p.id === productId) ||
      getLocalProducts().find((p) => p.id === productId);
    if (fallbackItem && (msg.includes('not-found') || msg.includes('no document to update'))) {
      await saveProductToFirestore({
        ...fallbackItem,
        isActive: newActiveState,
      });
    } else {
      throw formatProductFirestoreError(err);
    }
  }

  const current = getLocalProducts();
  const updated = current.map((p) =>
    p.id === productId ? { ...p, isActive: newActiveState, updatedAt: nowIso } : p
  );
  saveLocalProducts(updated);

  return newActiveState;
}

/**
 * Update stock count in Firestore
 */
export async function updateProductStockInFirestore(
  productId: string,
  newStock: number
): Promise<void> {
  const safeStock = Math.max(0, Number(newStock) || 0);
  const nowIso = new Date().toISOString();
  try {
    const docRef = doc(db, 'products', productId);
    await updateDoc(docRef, {
      stock: safeStock,
      updatedAt: nowIso,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    const fallbackItem =
      INITIAL_PRODUCTS.find((p) => p.id === productId) ||
      getLocalProducts().find((p) => p.id === productId);
    if (fallbackItem && (msg.includes('not-found') || msg.includes('no document to update'))) {
      await saveProductToFirestore({
        ...fallbackItem,
        stock: safeStock,
      });
    } else {
      throw formatProductFirestoreError(err);
    }
  }

  const current = getLocalProducts();
  const updated = current.map((p) => (p.id === productId ? { ...p, stock: safeStock } : p));
  saveLocalProducts(updated);
}

/**
 * Update product listing fields (price, stock, listingStatus, images, etc.)
 */
export async function updateProductListingInFirestore(
  productId: string,
  updates: Partial<Product>
): Promise<void> {
  const existing =
    getLocalProducts().find((p) => p.id === productId) ||
    INITIAL_PRODUCTS.find((p) => p.id === productId);

  if (existing) {
    const mergedProduct = sanitizeProductForFirestore({
      ...existing,
      ...updates,
      id: productId,
    });
    try {
      const docRef = doc(db, 'products', productId);
      await setDoc(docRef, mergedProduct, { merge: true });
    } catch (err) {
      throw formatProductFirestoreError(err);
    }

    const current = getLocalProducts();
    const updated = current.map((p) => (p.id === productId ? mergedProduct : p));
    saveLocalProducts(updated);
    return;
  }

  const payload = stripUndefined({
    ...updates,
    updatedAt: new Date().toISOString(),
  });

  try {
    const docRef = doc(db, 'products', productId);
    await updateDoc(docRef, payload);
  } catch (err) {
    throw formatProductFirestoreError(err);
  }

  const current = getLocalProducts();
  const updated = current.map((p) => (p.id === productId ? { ...p, ...payload } : p));
  saveLocalProducts(updated);
}

/**
 * Delete a product from Firestore (and mark base catalog items deleted in Firestore so all devices match)
 */
export async function deleteProductFromFirestore(productId: string): Promise<void> {
  const baseProd = INITIAL_PRODUCTS.find((bp) => bp.id === productId);
  try {
    const docRef = doc(db, 'products', productId);
    if (baseProd) {
      await setDoc(
        docRef,
        sanitizeProductForFirestore({
          ...baseProd,
          isActive: false,
          listingStatus: 'sold',
          stock: 0,
          sku: DELETED_BASE_SKU,
        }),
        { merge: true }
      );
    } else {
      await deleteDoc(docRef);
    }
  } catch (err) {
    throw formatProductFirestoreError(err);
  }

  markProductDeleted(productId);
  const current = getLocalProducts();
  const updated = current.filter((p) => p.id !== productId);
  saveLocalProducts(updated);
}

/**
 * Atomically increment or decrement likesCount using Firestore transaction
 */
export async function toggleProductLikesTransaction(
  productId: string,
  delta: 1 | -1,
  fallbackCount?: number
): Promise<number> {
  const localItem = getLocalProducts().find((p) => p.id === productId);
  const optimistic = Math.max(0, (fallbackCount ?? localItem?.likesCount ?? 0) + delta);

  try {
    const docRef = doc(db, 'products', productId);
    const nextLikes = await runTransaction(db, async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists()) {
        if (localItem) {
          tx.set(docRef, sanitizeProductForFirestore({ ...localItem, likesCount: optimistic }));
        }
        return optimistic;
      }
      const data = snap.data() as Product;
      const currentLikes = Math.max(0, Number(data.likesCount) || 0);
      const computed = Math.max(0, currentLikes + delta);
      tx.update(docRef, {
        likesCount: computed,
        updatedAt: new Date().toISOString(),
      });
      return computed;
    });

    const updatedLocal = getLocalProducts().map((p) =>
      p.id === productId ? { ...p, likesCount: nextLikes } : p
    );
    saveLocalProducts(updatedLocal);
    return nextLikes;
  } catch (err) {
    console.warn('Atomic likes transaction fallback:', err);
    const updatedLocal = getLocalProducts().map((p) =>
      p.id === productId ? { ...p, likesCount: optimistic } : p
    );
    saveLocalProducts(updatedLocal);
    return optimistic;
  }
}

export async function updateProductRatingStatsInFirestore(
  productId: string,
  rating: number,
  reviewsCount: number
): Promise<void> {
  if (!productId) return;
  const safeRating = Math.min(5, Math.max(0, Math.round(rating * 10) / 10));
  const safeCount = Math.max(0, Math.round(reviewsCount));
  const nowIso = new Date().toISOString();

  const updatedLocal = getLocalProducts().map((p) =>
    p.id === productId ? { ...p, rating: safeRating, reviewsCount: safeCount } : p
  );
  saveLocalProducts(updatedLocal);

  try {
    await updateDoc(doc(db, 'products', productId), {
      rating: safeRating,
      reviewsCount: safeCount,
      updatedAt: nowIso,
    });
  } catch (err) {
    console.warn('Gagal menyinkronkan rating produk ke Firestore:', err);
  }
}

export async function syncSellerProfileToProductsInFirestore(
  sellerId: string,
  updates: { brandName?: string; brandCity?: string; avatarUrl?: string }
): Promise<void> {
  if (!sellerId) return;
  const cleanBrand = updates.brandName?.trim().slice(0, 100);
  const cleanCity = updates.brandCity?.trim().slice(0, 80);
  const cleanAvatar = updates.avatarUrl?.trim();
  const nowIso = new Date().toISOString();

  const localUpdated = getLocalProducts().map((p) => {
    if (p.sellerId !== sellerId) return p;
    return {
      ...p,
      ...(cleanBrand ? { brand: cleanBrand, sellerBrandName: cleanBrand } : {}),
      ...(cleanCity ? { brandCity: cleanCity } : {}),
      ...(cleanAvatar !== undefined ? { sellerAvatarUrl: cleanAvatar || undefined } : {}),
    };
  });
  saveLocalProducts(localUpdated);

  try {
    const snap = await getDocs(
      query(collection(db, 'products'), where('sellerId', '==', sellerId))
    );
    const payload: Record<string, unknown> = { updatedAt: nowIso };
    if (cleanBrand) {
      payload.brand = cleanBrand;
      payload.sellerBrandName = cleanBrand;
    }
    if (cleanCity) {
      payload.brandCity = cleanCity;
    }
    if (cleanAvatar !== undefined) {
      payload.sellerAvatarUrl = cleanAvatar;
    }

    await Promise.all(
      snap.docs.map((d) => updateDoc(doc(db, 'products', d.id), payload))
    );
  } catch (err) {
    console.warn('Gagal menyinkronkan profil penjual ke listing produk:', err);
  }
}

