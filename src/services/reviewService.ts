import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Review } from '../types';

const LOCAL_REVIEWS_KEY = 'nura_reviews';

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

export function getLocalReviews(): Review[] {
  try {
    const raw = localStorage.getItem(LOCAL_REVIEWS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
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
  const safeReview: Review = stripUndefined({
    id: String(review.id).slice(0, 128),
    productId: String(review.productId).slice(0, 128),
    author: String(review.author || 'Pembeli').slice(0, 100),
    city: String(review.city || 'Indonesia').slice(0, 80),
    rating: Math.min(5, Math.max(1, Number(review.rating) || 5)),
    comment: String(review.comment || '').slice(0, 1500),
    sizePurchased: String(review.sizePurchased || 'Standar').slice(0, 40),
    fitFeedback: review.fitFeedback || 'Pas',
    verifiedPurchase: Boolean(review.verifiedPurchase),
    date: String(review.date || 'Hari ini').slice(0, 64),
    helpfulCount: Math.max(0, Number(review.helpfulCount) || 1),
    images: Array.isArray(review.images) ? review.images.slice(0, 4) : undefined,
    userStats: review.userStats ? String(review.userStats).slice(0, 100) : undefined,
    createdAtIso: review.createdAtIso || new Date().toISOString(),
  }) as Review;

  const current = getLocalReviews();
  saveLocalReviews([safeReview, ...current.filter((r) => r.id !== safeReview.id)]);

  try {
    await setDoc(doc(db, 'reviews', safeReview.id), safeReview);
  } catch (err) {
    console.warn('Review saved locally:', err);
  }

  return safeReview;
}

export async function deleteReviewFromFirestore(reviewId: string): Promise<void> {
  saveLocalReviews(getLocalReviews().filter((r) => r.id !== reviewId));
  try {
    await deleteDoc(doc(db, 'reviews', reviewId));
  } catch (err) {
    console.warn('Review delete warning:', err);
  }
}

export function subscribeToLiveReviews(
  onUpdate: (reviews: Review[]) => void
): () => void {
  const mergeAndEmit = (firestoreReviews: Review[]) => {
    const map = new Map<string, Review>();
    getLocalReviews().forEach((r) => {
      if (r && r.id) map.set(r.id, r);
    });
    firestoreReviews.forEach((r) => {
      if (r && r.id) map.set(r.id, r);
    });
    const sorted = Array.from(map.values()).sort((a, b) =>
      (b.createdAtIso || b.id).localeCompare(a.createdAtIso || a.id)
    );
    saveLocalReviews(sorted);
    onUpdate(sorted);
  };

  try {
    return onSnapshot(
      collection(db, 'reviews'),
      (snapshot) => {
        const list: Review[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Review;
          list.push({ ...data, id: docSnap.id });
        });
        mergeAndEmit(list);
      },
      () => {
        mergeAndEmit([]);
      }
    );
  } catch {
    mergeAndEmit([]);
    return () => {};
  }
}
