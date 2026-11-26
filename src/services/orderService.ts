import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  getDocs,
  query,
  where,
  runTransaction,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { NotificationItem, Order, Product, UserAccount, UserProfile } from '../types';
import { getAllUsersFromDb, saveUserToDb } from '../utils/userDb';

const SHARED_ORDERS_KEY = 'aroos_shared_orders_v1';
const SHARED_NOTIFICATIONS_KEY = 'aroos_shared_notifications_v1';

function normalizeKey(value?: string | null): string {
  return (value || '').trim().toLowerCase();
}

function normalizePhoneDigits(phone?: string | null): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return '62' + digits.slice(1);
  if (digits.startsWith('62')) return digits;
  return digits;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

function sanitizeOrderForFirestore(order: Order): Record<string, unknown> {
  return stripUndefined({
    ...order,
    items: (order.items || []).map((item) => stripUndefined({ ...item })),
    createdAtIso: order.createdAtIso || new Date().toISOString(),
  });
}

function sanitizeNotificationForFirestore(notification: NotificationItem): Record<string, unknown> {
  return stripUndefined({
    ...notification,
    createdAtIso: notification.createdAtIso || new Date().toISOString(),
  });
}

export function getLocalSharedOrders(): Order[] {
  try {
    const raw = localStorage.getItem(SHARED_ORDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalSharedOrders(orders: Order[]): void {
  try {
    localStorage.setItem(SHARED_ORDERS_KEY, JSON.stringify(orders.slice(0, 200)));
  } catch {}
}

export function getLocalSharedNotifications(): NotificationItem[] {
  try {
    const raw = localStorage.getItem(SHARED_NOTIFICATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalSharedNotifications(notifications: NotificationItem[]): void {
  try {
    localStorage.setItem(SHARED_NOTIFICATIONS_KEY, JSON.stringify(notifications.slice(0, 200)));
  } catch {}
}

function mergeOrders(firestoreOrders: Order[], localOrders: Order[]): Order[] {
  const map = new Map<string, Order>();
  localOrders.forEach((o) => {
    if (o && o.id) map.set(o.id, o);
  });
  firestoreOrders.forEach((o) => {
    if (o && o.id) map.set(o.id, o);
  });

  return Array.from(map.values()).sort((a, b) => {
    const ta = a.createdAtIso || a.id;
    const tb = b.createdAtIso || b.id;
    return tb.localeCompare(ta);
  });
}

function mergeNotifications(
  firestoreNotifs: NotificationItem[],
  localNotifs: NotificationItem[]
): NotificationItem[] {
  const map = new Map<string, NotificationItem>();
  localNotifs.forEach((n) => {
    if (n && n.id) map.set(n.id, n);
  });
  firestoreNotifs.forEach((n) => {
    if (n && n.id) map.set(n.id, n);
  });

  return Array.from(map.values()).sort((a, b) => {
    const ta = a.createdAtIso || a.id;
    const tb = b.createdAtIso || b.id;
    return tb.localeCompare(ta);
  });
}

/**
 * Resolve sellerId for a product from product.sellerId, local user DB, or Firestore users
 */
export async function resolveSellerIdentity(
  product: Product
): Promise<{ sellerId?: string; sellerBrandName: string }> {
  const brandName = (product.sellerBrandName || product.brand || 'Penjual AROOS').trim();
  if (product.sellerId) {
    return { sellerId: product.sellerId, sellerBrandName: brandName };
  }

  const normalizedBrand = normalizeKey(brandName);
  const localUsers = getAllUsersFromDb();
  const matchedLocals = localUsers.filter((u) => {
    const uBrand = normalizeKey(u.sellerProfile?.brandName);
    const uName = normalizeKey(u.name);
    return (uBrand && uBrand === normalizedBrand) || (uName && uName === normalizedBrand);
  });
  if (matchedLocals.length === 1) {
    return { sellerId: matchedLocals[0].id, sellerBrandName: brandName };
  }

  // Fallback: check Firestore users by name/brand if user registered on another device (only if unambiguous)
  try {
    const q = query(collection(db, 'users'), where('name', '==', brandName));
    const snap = await getDocs(q);
    if (snap.size === 1) {
      const userData = snap.docs[0].data() as UserAccount;
      if (userData?.id) {
        saveUserToDb(userData);
        return { sellerId: userData.id, sellerBrandName: brandName };
      }
    }
  } catch {
    // ignore fallback lookup failure
  }

  return { sellerBrandName: brandName };
}

/**
 * Resolve buyerId & buyerEmail when seller initiates/records a deal from chat
 */
export async function resolveBuyerIdentity(params: {
  buyerId?: string;
  buyerName?: string;
  buyerPhone?: string;
  convId?: string;
}): Promise<{ buyerId?: string; buyerEmail?: string }> {
  let resolvedId = params.buyerId?.trim() || undefined;
  let resolvedEmail: string | undefined;

  // 1. Recover buyerId from Firestore conversation doc if missing
  if (!resolvedId && params.convId) {
    try {
      const convSnap = await getDoc(doc(db, 'chat_conversations', params.convId));
      if (convSnap.exists()) {
        const convData = convSnap.data() as { buyerId?: string };
        if (convData?.buyerId) {
          resolvedId = convData.buyerId;
        }
      }
    } catch {
      // ignore lookup failure
    }
  }

  // 2. Check local DB by id, normalized phone, or normalized name
  const localUsers = getAllUsersFromDb();
  const cleanPhone = normalizePhoneDigits(params.buyerPhone);
  const cleanName = normalizeKey(params.buyerName);

  const matchedPhone = cleanPhone
    ? localUsers.filter((u) => normalizePhoneDigits(u.phone) === cleanPhone)
    : [];
  const matchedName = cleanName
    ? localUsers.filter((u) => normalizeKey(u.name) === cleanName)
    : [];

  const matchedLocal =
    (resolvedId ? localUsers.find((u) => u.id === resolvedId) : undefined) ||
    (matchedPhone.length === 1 ? matchedPhone[0] : undefined) ||
    (matchedName.length === 1 ? matchedName[0] : undefined);

  if (matchedLocal) {
    resolvedId = resolvedId || matchedLocal.id;
    resolvedEmail = matchedLocal.email || undefined;
  }

  // 3. Look up user document directly in Firestore if we have resolvedId but no email yet
  if (resolvedId && !resolvedEmail) {
    try {
      const userSnap = await getDoc(doc(db, 'users', resolvedId));
      if (userSnap.exists()) {
        const userData = userSnap.data() as UserAccount;
        if (userData?.email) {
          resolvedEmail = userData.email;
        }
      }
    } catch {
      // ignore lookup failure
    }
  }

  return { buyerId: resolvedId, buyerEmail: resolvedEmail };
}

export function isOrderForBuyer(order: Order, profile: UserProfile): boolean {
  if (!profile.isRegistered) return false;
  if (order.buyerId && profile.id && order.buyerId === profile.id) {
    return true;
  }
  if (order.buyerEmail && profile.email && normalizeKey(order.buyerEmail) === normalizeKey(profile.email)) {
    return true;
  }
  // Fallback for deals recorded by seller without buyerId/buyerEmail attached
  if (!order.buyerId && !order.buyerEmail && !isOrderForSeller(order, profile)) {
    const orderPhone = normalizePhoneDigits(order.customerPhone);
    const profilePhone = normalizePhoneDigits(profile.phone);
    if (orderPhone && profilePhone && orderPhone === profilePhone) {
      return true;
    }
    const orderBuyerName = normalizeKey(order.buyerName || order.customerName);
    const profileName = normalizeKey(profile.name);
    if (orderBuyerName && profileName && orderBuyerName === profileName) {
      return true;
    }
  }
  return false;
}

export function isOrderForSeller(order: Order, profile: UserProfile): boolean {
  if (!profile.isRegistered) return false;
  if (order.sellerId && profile.id) {
    return order.sellerId === profile.id;
  }

  const userBrandKeys = new Set(
    [
      normalizeKey(profile.brandName),
      normalizeKey(profile.sellerProfile?.brandName),
      normalizeKey(profile.name),
    ].filter(Boolean)
  );
  if (userBrandKeys.size === 0) return false;

  const orderBrand = normalizeKey(order.sellerBrandName);
  if (orderBrand && userBrandKeys.has(orderBrand)) return true;

  return (order.items || []).some((item) => {
    if (item.sellerId && profile.id) {
      return item.sellerId === profile.id;
    }
    const itemBrand = normalizeKey(item.sellerBrandName || item.brand);
    return Boolean(itemBrand && userBrandKeys.has(itemBrand));
  });
}

export function isNotificationForUser(
  notification: NotificationItem,
  profile: UserProfile
): boolean {
  if (!profile.isRegistered) return false;
  if (notification.recipientUserId && profile.id) {
    return notification.recipientUserId === profile.id;
  }
  if (notification.recipientBrandName) {
    const targetBrand = normalizeKey(notification.recipientBrandName);
    const userBrandKeys = new Set(
      [
        normalizeKey(profile.brandName),
        normalizeKey(profile.sellerProfile?.brandName),
        normalizeKey(profile.name),
      ].filter(Boolean)
    );
    return userBrandKeys.has(targetBrand);
  }
  return false;
}

export async function createOrderInFirestore(order: Order): Promise<void> {
  const payload = sanitizeOrderForFirestore(order);
  const nextOrder = payload as unknown as Order;

  const local = getLocalSharedOrders();
  saveLocalSharedOrders(mergeOrders([nextOrder], local));

  try {
    await setDoc(doc(db, 'orders', order.id), payload);
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.CREATE, `orders/${order.id}`);
    } catch (wrappedErr) {
      console.warn('Order saved locally; Firestore sync error:', wrappedErr);
    }
  }
}

export async function createOrderAndDecrementStockTransaction(
  order: Order,
  productId?: string,
  qty: number = 1
): Promise<{ nextStock?: number; nextStatus?: 'available' | 'reserved' | 'sold' }> {
  const payload = sanitizeOrderForFirestore(order);
  const nextOrder = payload as unknown as Order;
  saveLocalSharedOrders(mergeOrders([nextOrder], getLocalSharedOrders()));

  const safeQty = Math.max(1, Number(qty) || 1);

  try {
    return await runTransaction(db, async (tx) => {
      const orderRef = doc(db, 'orders', order.id);
      let nextStock: number | undefined;
      let nextStatus: 'available' | 'reserved' | 'sold' | undefined;

      if (productId) {
        const prodRef = doc(db, 'products', productId);
        const prodSnap = await tx.get(prodRef);
        if (prodSnap.exists()) {
          const prodData = prodSnap.data() as Product;
          const currentStock = Math.max(0, Number(prodData.stock) || 0);
          if (prodData.listingStatus === 'sold' || currentStock <= 0) {
            throw new Error('Produk ini sudah terjual atau stok habis.');
          }
          nextStock = Math.max(0, currentStock - safeQty);
          nextStatus = nextStock === 0 ? 'sold' : prodData.listingStatus || 'available';
          const stockUpdates: Record<string, unknown> = {
            stock: nextStock,
            listingStatus: nextStatus,
            updatedAt: new Date().toISOString(),
          };
          if (nextStock === 0) {
            stockUpdates.reservedByUserId = '';
            stockUpdates.reservedByUserName = '';
          }
          tx.update(prodRef, stockUpdates);
        }
      }

      tx.set(orderRef, payload);
      return { nextStock, nextStatus };
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('sudah terjual atau stok habis')) {
      throw err;
    }
    try {
      await setDoc(doc(db, 'orders', order.id), payload);
    } catch {}
    return {};
  }
}

export async function updateOrderInFirestore(
  orderId: string,
  updates: Partial<Order>
): Promise<void> {
  const payload = stripUndefined({ ...updates });
  const local = getLocalSharedOrders().map((o) =>
    o.id === orderId ? { ...o, ...payload } : o
  );
  saveLocalSharedOrders(local);

  try {
    await updateDoc(doc(db, 'orders', orderId), payload);
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    } catch (wrappedErr) {
      console.warn('Order update saved locally; Firestore sync error:', wrappedErr);
    }
  }
}

export function subscribeToLiveOrders(
  onUpdate: (orders: Order[]) => void
): () => void {
  try {
    const ordersCol = collection(db, 'orders');
    return onSnapshot(
      ordersCol,
      (snapshot) => {
        const firestoreList: Order[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Order;
          firestoreList.push({
            ...data,
            id: docSnap.id,
          });
        });

        const merged = mergeOrders(firestoreList, getLocalSharedOrders());
        saveLocalSharedOrders(merged);
        onUpdate(merged);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'orders');
        } catch (wrappedErr) {
          console.warn('Orders live subscription fallback to local:', wrappedErr);
        }
        onUpdate(getLocalSharedOrders());
      }
    );
  } catch (err) {
    console.warn('Could not initialize orders listener:', err);
    onUpdate(getLocalSharedOrders());
    return () => {};
  }
}

export async function createNotificationInFirestore(
  notification: NotificationItem
): Promise<void> {
  const payload = sanitizeNotificationForFirestore(notification);
  const nextNotif = payload as unknown as NotificationItem;

  const local = getLocalSharedNotifications();
  saveLocalSharedNotifications(mergeNotifications([nextNotif], local));

  try {
    await setDoc(doc(db, 'notifications', notification.id), payload);
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.CREATE, `notifications/${notification.id}`);
    } catch (wrappedErr) {
      console.warn('Notification saved locally; Firestore sync error:', wrappedErr);
    }
  }
}

export async function markNotificationReadInFirestore(
  notificationId: string
): Promise<void> {
  const local = getLocalSharedNotifications().map((n) =>
    n.id === notificationId ? { ...n, read: true } : n
  );
  saveLocalSharedNotifications(local);

  try {
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
    } catch (wrappedErr) {
      console.warn('Notification read state saved locally; Firestore sync error:', wrappedErr);
    }
  }
}

export function subscribeToLiveNotifications(
  onUpdate: (notifications: NotificationItem[]) => void
): () => void {
  try {
    const notifsCol = collection(db, 'notifications');
    return onSnapshot(
      notifsCol,
      (snapshot) => {
        const firestoreList: NotificationItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as NotificationItem;
          firestoreList.push({
            ...data,
            id: docSnap.id,
          });
        });

        const merged = mergeNotifications(firestoreList, getLocalSharedNotifications());
        saveLocalSharedNotifications(merged);
        onUpdate(merged);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'notifications');
        } catch (wrappedErr) {
          console.warn('Notifications live subscription fallback to local:', wrappedErr);
        }
        onUpdate(getLocalSharedNotifications());
      }
    );
  } catch (err) {
    console.warn('Could not initialize notifications listener:', err);
    onUpdate(getLocalSharedNotifications());
    return () => {};
  }
}
