import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Review } from '../types';
import { resolveBundledAssetList } from '../assets/productAssets';

const LOCAL_REVIEWS_KEY = 'nura_reviews';

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

function formatReviewFirestoreError(err: unknown): Error {
  const raw = err instanceof Error ? err.message : String(err || '');
  const lower = raw.toLowerCase();
  if (
    lower.includes('unavailable') ||
    lower.includes('network') ||
    lower.includes('offline') ||
    lower.includes('failed to fetch')
  ) {
    return new Error('Koneksi ke server terputus. Ulasan belum tersimpan, silakan coba lagi.');
  }
  if (lower.includes('permission-denied')) {
    return new Error('Data ulasan tidak memenuhi aturan validasi server. Periksa panjang teks atau foto.');
  }
  if (lower.includes('exceeds the maximum') || lower.includes('too large')) {
    return new Error('Ukuran foto ulasan terlalu besar untuk dikirim ke server.');
  }
  return new Error(raw || 'Gagal menyimpan ulasan ke server. Silakan coba lagi.');
}

function normalizeReviewImages(review: Review): Review {
  if (!Array.isArray(review.images) || review.images.length === 0) return review;
  return {
    ...review,
    images: resolveBundledAssetList(review.images),
  };
}

export function getLocalReviews(): Review[] {
  try {
    const raw = localStorage.getItem(LOCAL_REVIEWS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeReviewImages) : [];
  } catch {
    return [];
  }
}

export function saveLocalReviews(reviews: Review[]): void {
  try {
    localStorage.setItem(LOCAL_REVIEWS_KEY, JSON.stringify(reviews.slice(0, 400)));
  } catch {}
}

export async function createReviewInFirestore(review: Review): Promise<Review> {
  const safeImages = Array.isArray(review.images)
    ? (resolveBundledAssetList(review.images) || [])
        .filter((img): img is string => typeof img === 'string' && img.length > 0 && img.length <= 750000)
        .slice(0, 4)
    : undefined;

  const safeReview: Review = stripUndefined({
    id: String(review.id).slice(0, 128),
    productId: String(review.productId).slice(0, 128),
    buyerId: review.buyerId ? String(review.buyerId).slice(0, 128) : undefined,
    orderId: review.orderId ? String(review.orderId).slice(0, 128) : undefined,
    author: String(review.author || 'Pembeli').slice(0, 100),
    city: String(review.city || 'Indonesia').slice(0, 80),
    rating: Math.min(5, Math.max(1, Number(review.rating) || 5)),
    comment: String(review.comment || '').slice(0, 1500),
    sizePurchased: String(review.sizePurchased || 'Standar').slice(0, 40),
    fitFeedback: review.fitFeedback || 'Pas',
    verifiedPurchase: Boolean(review.verifiedPurchase),
    date: String(review.date || 'Hari ini').slice(0, 64),
    helpfulCount: Math.max(0, Number(review.helpfulCount) || 1),
    images: safeImages,
    userStats: review.userStats ? String(review.userStats).slice(0, 100) : undefined,
    createdAtIso: review.createdAtIso || new Date().toISOString(),
  }) as Review;

  try {
    await setDoc(doc(db, 'reviews', safeReview.id), safeReview);
  } catch (err) {
    throw formatReviewFirestoreError(err);
  }

  const current = getLocalReviews();
  saveLocalReviews([safeReview, ...current.filter((r) => r.id !== safeReview.id)]);

  return safeReview;
}

export async function deleteReviewFromFirestore(reviewId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'reviews', reviewId));
  } catch (err) {
    throw formatReviewFirestoreError(err);
  }
  saveLocalReviews(getLocalReviews().filter((r) => r.id !== reviewId));
}

export async function incrementReviewHelpfulTransaction(
  reviewId: string,
  delta: 1 | -1 = 1
): Promise<number> {
  const localItem = getLocalReviews().find((r) => r.id === reviewId);
  const optimistic = Math.max(0, (localItem?.helpfulCount ?? 1) + delta);

  try {
    const docRef = doc(db, 'reviews', reviewId);
    const nextCount = await runTransaction(db, async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists()) {
        return optimistic;
      }
      const data = snap.data() as Review;
      const current = Math.max(0, Number(data.helpfulCount) || 0);
      const computed = Math.max(0, current + delta);
      tx.update(docRef, { helpfulCount: computed });
      return computed;
    });

    const updatedLocal = getLocalReviews().map((r) =>
      r.id === reviewId ? { ...r, helpfulCount: nextCount } : r
    );
    saveLocalReviews(updatedLocal);
    return nextCount;
  } catch (err) {
    throw formatReviewFirestoreError(err);
  }
}

export function subscribeToLiveReviews(
  onUpdate: (reviews: Review[]) => void
): () => void {
  const sortReviews = (list: Review[]) =>
    [...list].sort((a, b) =>
      (b.createdAtIso || b.id).localeCompare(a.createdAtIso || a.id)
    );

  try {
    return onSnapshot(
      collection(db, 'reviews'),
      (snapshot) => {
        const list: Review[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Review;
          list.push(normalizeReviewImages({ ...data, id: docSnap.id }));
        });
        const sorted = sortReviews(list);
        saveLocalReviews(sorted);
        onUpdate(sorted);
      },
      () => {
        onUpdate(sortReviews(getLocalReviews()));
      }
    );
  } catch {
    onUpdate(sortReviews(getLocalReviews()));
    return () => {};
  }
}
