import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product } from '../types';
import { INITIAL_PRODUCTS } from '../data/mockData';

const STORAGE_KEY = 'nura_products';
const DELETED_IDS_KEY = 'nura_deleted_products';

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
    url: '/src/assets/images/product_batik_outer_1792948052474.jpg',
    category: 'Batik & Etnik',
  },
  {
    name: 'Relaxed Workshirt Earth Linen',
    url: '/src/assets/images/product_oversized_linen_1792948053165.jpg',
    category: 'Atasan',
  },
  {
    name: 'Sneakers Kanvas Vulkanisir Raw Cream',
    url: '/src/assets/images/product_sneakers_cream_1792948053896.jpg',
    category: 'Sepatu',
  },
  {
    name: 'Tenun Ikat Oversized Blazer',
    url: '/src/assets/images/product_tenun_blazer_1792948054611.jpg',
    category: 'Outerwear',
  },
  {
    name: 'Kemeja Katun Sogan Daun',
    url: '/src/assets/images/product_batik_shirt_1792948055416.jpg',
    category: 'Atasan',
  },
  {
    name: 'Celana Kulot Linen Ivory',
    url: '/src/assets/images/product_linen_pants_1792948056157.jpg',
    category: 'Bawahan',
  },
  {
    name: 'Tas Selempang Kanvas Lurik',
    url: '/src/assets/images/product_batik_outer_1792948052474.jpg',
    category: 'Aksesoris',
  },
];

/**
 * Get locally stored products as immediate fallback
 */
export function getLocalProducts(): Product[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_PRODUCTS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
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
    // ignore
  }
}

/**
 * Merge Firestore products with base catalog items and any locally saved listings not yet synced to Firestore
 */
function mergeWithBaseCatalog(firestoreProducts: Product[]): {
  merged: Product[];
  unsyncedLocal: Product[];
} {
  const deletedIds = getDeletedProductIds();
  const baseIds = new Set(INITIAL_PRODUCTS.map(bp => bp.id));
  const firestoreIds = new Set(firestoreProducts.map(fp => fp.id));
  const mergedMap = new Map<string, Product>();

  // 1. Add base catalog products (unless deleted)
  INITIAL_PRODUCTS.forEach(bp => {
    if (!deletedIds.has(bp.id)) {
      mergedMap.set(bp.id, {
        ...bp,
        isActive: bp.isActive !== false,
      });
    }
  });

  // 2. Preserve locally saved custom seller listings that aren't in Firestore yet
  const unsyncedLocal: Product[] = [];
  getLocalProducts().forEach(lp => {
    if (deletedIds.has(lp.id)) return;
    if (!firestoreIds.has(lp.id) && !baseIds.has(lp.id)) {
      mergedMap.set(lp.id, {
        ...lp,
        isActive: lp.isActive !== false,
      });
      unsyncedLocal.push(lp);
    }
  });

  // 3. Apply Firestore products (source of truth for synced items and edits)
  firestoreProducts.forEach(fp => {
    if (!deletedIds.has(fp.id)) {
      mergedMap.set(fp.id, {
        ...fp,
        isActive: fp.isActive !== false,
      });
    }
  });

  // Keep newest custom items before base items
  const allItems = Array.from(mergedMap.values());
  const customItems = allItems.filter(p => !baseIds.has(p.id));
  const baseItems = allItems.filter(p => baseIds.has(p.id));
  customItems.sort((a, b) => (b.createdAt || b.id).localeCompare(a.createdAt || a.id));

  return {
    merged: [...customItems, ...baseItems],
    unsyncedLocal,
  };
}

/**
 * Subscribe in real-time to all products from Cloud Firestore
 * Fires whenever any seller adds, edits, or toggles active status.
 */
export function subscribeToLiveProducts(
  onUpdate: (products: Product[]) => void,
  onError?: (err: Error) => void
): () => void {
  try {
    const productsCol = collection(db, 'products');
    const syncedRetryIds = new Set<string>();

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

        const { merged, unsyncedLocal } = mergeWithBaseCatalog(firestoreList);
        saveLocalProducts(merged);
        onUpdate(merged);

        // Retry pushing any locally-created custom products that failed earlier
        unsyncedLocal.forEach((localProd) => {
          if (!syncedRetryIds.has(localProd.id)) {
            syncedRetryIds.add(localProd.id);
            saveProductToFirestore(localProd).catch(() => {});
          }
        });
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

function sanitizeProductForFirestore(product: Product): Product {
  const safeImages = Array.isArray(product.images)
    ? product.images.filter((img) => typeof img === 'string' && img.length <= 760000).slice(0, 12)
    : undefined;
  return stripUndefined({
    ...product,
    id: String(product.id).slice(0, 128),
    name: String(product.name || 'Produk').slice(0, 200),
    brand: String(product.brand || 'AROOS').slice(0, 100),
    itemBrand: product.itemBrand ? String(product.itemBrand).slice(0, 100) : undefined,
    brandCity: product.brandCity ? String(product.brandCity).slice(0, 80) : undefined,
    category: String(product.category || 'Atasan').slice(0, 80),
    subCategory: product.subCategory ? String(product.subCategory).slice(0, 80) : undefined,
    fit: product.fit ? String(product.fit).slice(0, 80) : undefined,
    price: Math.max(0, Number(product.price) || 0),
    originalPrice:
      product.originalPrice !== undefined ? Math.max(0, Number(product.originalPrice) || 0) : undefined,
    stock: Math.max(0, Number(product.stock) || 0),
    sku: product.sku ? String(product.sku).slice(0, 80) : undefined,
    barcode: product.barcode ? String(product.barcode).slice(0, 80) : undefined,
    sizes: Array.isArray(product.sizes) ? product.sizes.slice(0, 30) : undefined,
    colors: Array.isArray(product.colors) ? product.colors.slice(0, 30) : undefined,
    material: product.material ? String(product.material).slice(0, 200) : undefined,
    image:
      typeof product.image === 'string' && product.image.length <= 760000
        ? product.image
        : '',
    images: safeImages,
    likesCount:
      product.likesCount !== undefined ? Math.max(0, Number(product.likesCount) || 0) : undefined,
    reservedByUserId:
      product.reservedByUserId !== undefined ? String(product.reservedByUserId).slice(0, 128) : undefined,
    reservedByUserName:
      product.reservedByUserName !== undefined ? String(product.reservedByUserName).slice(0, 100) : undefined,
    meetupArea: product.meetupArea ? String(product.meetupArea).slice(0, 120) : undefined,
    description: product.description ? String(product.description).slice(0, 4000) : undefined,
    rating: product.rating !== undefined ? Math.min(5, Math.max(0, Number(product.rating) || 0)) : undefined,
    reviewsCount:
      product.reviewsCount !== undefined ? Math.max(0, Number(product.reviewsCount) || 0) : undefined,
    sellerId: product.sellerId ? String(product.sellerId).slice(0, 128) : undefined,
    sellerBrandName: product.sellerBrandName ? String(product.sellerBrandName).slice(0, 100) : undefined,
    sellerAvatar:
      typeof product.sellerAvatar === 'string' && product.sellerAvatar.length <= 300000
        ? product.sellerAvatar
        : undefined,
    isActive: product.isActive !== false,
    createdAt: product.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }) as Product;
}

/**
 * Save new or edited seller product to Cloud Firestore
 */
export async function saveProductToFirestore(product: Product): Promise<void> {
  clearProductDeleted(product.id);
  const payload = sanitizeProductForFirestore(product);

  // Always update local cache immediately first so nothing is ever lost
  const current = getLocalProducts();
  const exists = current.some(p => p.id === payload.id);
  const updated = exists
    ? current.map(p => p.id === payload.id ? payload : p)
    : [payload, ...current];
  saveLocalProducts(updated);

  try {
    const docRef = doc(db, 'products', payload.id);
    await setDoc(docRef, payload, { merge: true });
  } catch (err) {
    console.warn('Failed to save product in Firestore, kept safely in local cache:', err);
  }
}

/**
 * Toggle active/inactive status for a product.
 * When isActive is true: Product is publicly visible in buyer marketplace.
 * When isActive is false: Product is hidden from guest/buyer marketplace.
 */
export async function toggleProductActiveStatus(
  productId: string,
  newActiveState: boolean
): Promise<boolean> {
  try {
    const docRef = doc(db, 'products', productId);
    await updateDoc(docRef, {
      isActive: newActiveState,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Firestore toggle active status warning:', err);
    // If doc didn't exist in Firestore yet (e.g. initial product), create it
    const local = getLocalProducts().find(p => p.id === productId);
    if (local) {
      await saveProductToFirestore({
        ...local,
        isActive: newActiveState,
      });
    }
  }

  // Update local cache immediately
  const current = getLocalProducts();
  const updated = current.map(p => {
    if (p.id === productId) {
      return { ...p, isActive: newActiveState, updatedAt: new Date().toISOString() };
    }
    return p;
  });
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
  try {
    const docRef = doc(db, 'products', productId);
    await updateDoc(docRef, {
      stock: newStock,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Firestore update stock warning:', err);
    const local = getLocalProducts().find(p => p.id === productId);
    if (local) {
      await saveProductToFirestore({
        ...local,
        stock: newStock,
      });
    }
  }

  const current = getLocalProducts();
  const updated = current.map(p => p.id === productId ? { ...p, stock: newStock } : p);
  saveLocalProducts(updated);
}

/**
 * Update product listing fields (price, stock, listingStatus, condition, etc.)
 */
export async function updateProductListingInFirestore(
  productId: string,
  updates: Partial<Product>
): Promise<void> {
  const payload = stripUndefined({
    ...updates,
    updatedAt: new Date().toISOString(),
  });

  try {
    const docRef = doc(db, 'products', productId);
    await updateDoc(docRef, payload);
  } catch (err) {
    console.warn('Firestore update listing warning:', err);
    const local = getLocalProducts().find(p => p.id === productId);
    if (local) {
      await saveProductToFirestore({
        ...local,
        ...payload,
      });
    }
  }

  const current = getLocalProducts();
  const updated = current.map(p => p.id === productId ? { ...p, ...payload } : p);
  saveLocalProducts(updated);
}

/**
 * Delete a product from Firestore and local cache
 */
export async function deleteProductFromFirestore(productId: string): Promise<void> {
  markProductDeleted(productId);
  try {
    const docRef = doc(db, 'products', productId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Firestore delete product warning:', err);
  }

  const current = getLocalProducts();
  const updated = current.filter(p => p.id !== productId);
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
