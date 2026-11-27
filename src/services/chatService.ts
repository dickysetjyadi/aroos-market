import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  getDocs,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  ChatConversation,
  ChatMessage,
  ChatProductContext,
  OfferStatus,
  UserProfile,
} from '../types';
import { isStoreOwnedByUser } from '../utils/ownership';

const LOCAL_CONVS_KEY = 'aroos_chat_conversations_v4';
const LOCAL_MSGS_KEY = 'aroos_chat_messages_v4';

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

function formatChatFirestoreError(err: unknown): Error {
  const raw = err instanceof Error ? err.message : String(err || '');
  const lower = raw.toLowerCase();
  if (
    lower.includes('unavailable') ||
    lower.includes('network') ||
    lower.includes('offline') ||
    lower.includes('failed to fetch')
  ) {
    return new Error('Koneksi ke server chat terputus. Pesan belum tersinkron, coba lagi.');
  }
  if (lower.includes('permission-denied')) {
    return new Error('Pesan atau data percakapan tidak memenuhi validasi server.');
  }
  if (lower.includes('exceeds the maximum') || lower.includes('too large')) {
    return new Error('Ukuran lampiran foto chat terlalu besar untuk dikirim ke server.');
  }
  return new Error(raw || 'Gagal menyimpan percakapan ke server. Silakan coba lagi.');
}

export function sanitizeFirestoreId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

export function buildConversationId(productId: string, buyerId: string): string {
  const safeProd = sanitizeFirestoreId(productId).slice(0, 56);
  const safeBuyer = sanitizeFirestoreId(buyerId).slice(0, 56);
  return `conv-${safeProd}-${safeBuyer}`.slice(0, 128);
}

function sanitizeImageString(img?: string, maxLen = 700000): string | undefined {
  if (!img) return undefined;
  if (img.length <= maxLen) return img;
  return undefined;
}

function sanitizeProductContext(p: ChatProductContext, maxImgLen = 500000): Record<string, unknown> {
  return stripUndefined({
    id: String(p.id).slice(0, 128),
    name: String(p.name).slice(0, 200),
    price: Number(p.price) || 0,
    image: sanitizeImageString(p.image, maxImgLen) || '',
    brand: String(p.brand).slice(0, 100),
    sellerId: p.sellerId ? String(p.sellerId).slice(0, 128) : undefined,
    status: p.status,
  });
}

function sanitizeConversationForFirestore(conv: ChatConversation): Record<string, unknown> {
  return stripUndefined({
    ...conv,
    id: String(conv.id).slice(0, 128),
    storeId: String(conv.storeId || conv.storeName || 'store').slice(0, 128),
    storeName: String(conv.storeName || 'Penjual').slice(0, 100),
    storeAvatar: sanitizeImageString(conv.storeAvatar, 200000),
    buyerId: conv.buyerId ? String(conv.buyerId).slice(0, 128) : undefined,
    buyerName: conv.buyerName ? String(conv.buyerName).slice(0, 100) : undefined,
    buyerPhone: conv.buyerPhone ? String(conv.buyerPhone).slice(0, 30) : undefined,
    buyerCity: conv.buyerCity ? String(conv.buyerCity).slice(0, 80) : undefined,
    buyerAddress: conv.buyerAddress ? String(conv.buyerAddress).slice(0, 400) : undefined,
    sellerId: conv.sellerId ? String(conv.sellerId).slice(0, 128) : undefined,
    onlineStatus: conv.onlineStatus ? String(conv.onlineStatus).slice(0, 80) : undefined,
    buyerTypingAt:
      conv.buyerTypingAt !== undefined ? Math.max(0, Number(conv.buyerTypingAt) || 0) : undefined,
    sellerTypingAt:
      conv.sellerTypingAt !== undefined ? Math.max(0, Number(conv.sellerTypingAt) || 0) : undefined,
    product: sanitizeProductContext(conv.product, 500000),
    lastMessage: String(conv.lastMessage || '').slice(0, 1000),
    lastTimestamp: String(conv.lastTimestamp || 'Baru saja').slice(0, 64),
    unreadCount: Number(conv.unreadCount) || 0,
    buyerUnreadCount:
      conv.buyerUnreadCount !== undefined ? Number(conv.buyerUnreadCount) : undefined,
    sellerUnreadCount:
      conv.sellerUnreadCount !== undefined ? Number(conv.sellerUnreadCount) : undefined,
    hiddenBy: Array.isArray(conv.hiddenBy) ? conv.hiddenBy.slice(0, 10) : undefined,
    createdAtIso: conv.createdAtIso || new Date().toISOString(),
    updatedAtIso: conv.updatedAtIso || new Date().toISOString(),
  });
}

function sanitizeMessageForFirestore(msg: ChatMessage): Record<string, unknown> {
  if (msg.image && msg.image.length > 740000) {
    throw new Error('Ukuran foto terlalu besar untuk dikirim. Silakan pilih atau ambil ulang foto.');
  }
  const safeMsgImage = sanitizeImageString(msg.image, 740000);
  const maxContextImage = safeMsgImage
    ? Math.max(0, 820000 - safeMsgImage.length)
    : 500000;
  return stripUndefined({
    ...msg,
    id: String(msg.id).slice(0, 128),
    conversationId: msg.conversationId ? String(msg.conversationId).slice(0, 128) : undefined,
    storeId: String(msg.storeId || msg.storeName || 'store').slice(0, 128),
    storeName: String(msg.storeName || 'Penjual').slice(0, 100),
    senderId: msg.senderId ? String(msg.senderId).slice(0, 128) : undefined,
    senderName: msg.senderName ? String(msg.senderName).slice(0, 100) : undefined,
    text: String(msg.text || '').slice(0, 2000),
    timestamp: String(msg.timestamp || '').slice(0, 64),
    image: safeMsgImage,
    productContext: msg.productContext
      ? sanitizeProductContext(msg.productContext, maxContextImage)
      : undefined,
    createdAtIso: msg.createdAtIso || new Date().toISOString(),
  });
}

export function getLocalConversations(): ChatConversation[] {
  try {
    const raw = localStorage.getItem(LOCAL_CONVS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalConversations(convs: ChatConversation[]): void {
  try {
    localStorage.setItem(LOCAL_CONVS_KEY, JSON.stringify(convs.slice(0, 150)));
  } catch {}
}

export function getLocalMessagesMap(): Record<string, ChatMessage[]> {
  try {
    const raw = localStorage.getItem(LOCAL_MSGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveLocalMessagesMap(map: Record<string, ChatMessage[]>): void {
  try {
    localStorage.setItem(LOCAL_MSGS_KEY, JSON.stringify(map));
  } catch {}
}

export function isConversationVisibleToUser(
  conv: ChatConversation,
  profile: UserProfile
): boolean {
  if (!profile.isRegistered) return false;
  if (profile.id && Array.isArray(conv.hiddenBy) && conv.hiddenBy.includes(profile.id)) {
    return false;
  }
  const isSeller = isStoreOwnedByUser(conv.storeName, conv.sellerId, profile);
  if (isSeller) return true;
  if (conv.buyerId && profile.id) {
    return conv.buyerId === profile.id;
  }
  return false;
}

export function getRoleInConversation(
  conv: ChatConversation,
  profile: UserProfile
): 'seller' | 'buyer' {
  return isStoreOwnedByUser(conv.storeName, conv.sellerId, profile) ? 'seller' : 'buyer';
}

export function getUnreadCountForUser(
  conv: ChatConversation,
  profile: UserProfile
): number {
  const role = getRoleInConversation(conv, profile);
  if (role === 'seller') {
    return conv.sellerUnreadCount ?? conv.unreadCount ?? 0;
  }
  return conv.buyerUnreadCount ?? conv.unreadCount ?? 0;
}

export async function saveConversationInFirestore(
  conv: ChatConversation
): Promise<void> {
  const payload = sanitizeConversationForFirestore(conv);
  const nextConv = payload as unknown as ChatConversation;

  try {
    await setDoc(doc(db, 'chat_conversations', nextConv.id), payload);
  } catch (error) {
    try {
      handleFirestoreError(
        error,
        OperationType.WRITE,
        `chat_conversations/${nextConv.id}`
      );
    } catch {}
    throw formatChatFirestoreError(error);
  }

  const existing = getLocalConversations();
  const idx = existing.findIndex((c) => c.id === nextConv.id);
  const updated =
    idx > -1
      ? existing.map((c, i) => (i === idx ? nextConv : c))
      : [nextConv, ...existing];
  saveLocalConversations(updated);
}

export async function updateConversationInFirestore(
  convId: string,
  updates: Partial<ChatConversation>,
  fallbackConv?: ChatConversation
): Promise<void> {
  const nextUpdates = stripUndefined({
    ...updates,
    updatedAtIso: updates.updatedAtIso || new Date().toISOString(),
  });

  try {
    await updateDoc(doc(db, 'chat_conversations', convId), nextUpdates);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    if (fallbackConv && (msg.includes('not-found') || msg.includes('no document to update'))) {
      try {
        await setDoc(
          doc(db, 'chat_conversations', convId),
          sanitizeConversationForFirestore({ ...fallbackConv, ...nextUpdates } as ChatConversation)
        );
      } catch (fallbackErr) {
        try {
          handleFirestoreError(
            fallbackErr,
            OperationType.WRITE,
            `chat_conversations/${convId}`
          );
        } catch {}
        throw formatChatFirestoreError(fallbackErr);
      }
    } else {
      try {
        handleFirestoreError(
          error,
          OperationType.UPDATE,
          `chat_conversations/${convId}`
        );
      } catch {}
      throw formatChatFirestoreError(error);
    }
  }

  const existing = getLocalConversations();
  const hasExisting = existing.some((c) => c.id === convId);
  const updatedLocal = hasExisting
    ? existing.map((c) => (c.id === convId ? { ...c, ...nextUpdates } : c))
    : fallbackConv
      ? [{ ...fallbackConv, ...nextUpdates } as ChatConversation, ...existing]
      : existing;
  saveLocalConversations(updatedLocal);
}

export async function updateTypingStatusInFirestore(
  convId: string,
  role: 'buyer' | 'seller',
  typingAt: number
): Promise<void> {
  if (!convId) return;
  const field = role === 'buyer' ? 'buyerTypingAt' : 'sellerTypingAt';
  const payload = { [field]: Math.max(0, typingAt) };

  const existing = getLocalConversations();
  if (existing.some((c) => c.id === convId)) {
    saveLocalConversations(
      existing.map((c) => (c.id === convId ? { ...c, ...payload } : c))
    );
  }

  try {
    await updateDoc(doc(db, 'chat_conversations', convId), payload);
  } catch {
    // Ignore transient typing update errors if conversation isn't persisted yet
  }
}

export async function sendChatMessageInFirestore(
  convId: string,
  message: ChatMessage
): Promise<void> {
  const withIso: ChatMessage = {
    ...message,
    conversationId: convId,
    createdAtIso: message.createdAtIso || new Date().toISOString(),
  };
  const payload = sanitizeMessageForFirestore(withIso);
  const nextMsg = payload as unknown as ChatMessage;

  try {
    await setDoc(
      doc(db, 'chat_conversations', convId, 'messages', nextMsg.id),
      payload
    );
  } catch (error) {
    try {
      handleFirestoreError(
        error,
        OperationType.CREATE,
        `chat_conversations/${convId}/messages/${nextMsg.id}`
      );
    } catch (wrappedErr) {
      throw wrappedErr;
    }
    throw new Error('Gagal mengirim pesan ke server.');
  }

  const map = getLocalMessagesMap();
  const currentList = map[convId] || [];
  if (!currentList.some((m) => m.id === nextMsg.id)) {
    saveLocalMessagesMap({
      ...map,
      [convId]: [...currentList, nextMsg],
    });
  }
}

export async function updateChatMessageOfferStatusInFirestore(
  convId: string,
  messageId: string,
  offerStatus: OfferStatus
): Promise<void> {
  try {
    await updateDoc(
      doc(db, 'chat_conversations', convId, 'messages', messageId),
      { offerStatus }
    );
  } catch (error) {
    try {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `chat_conversations/${convId}/messages/${messageId}`
      );
    } catch {}
    throw formatChatFirestoreError(error);
  }

  const map = getLocalMessagesMap();
  const currentList = map[convId] || [];
  saveLocalMessagesMap({
    ...map,
    [convId]: currentList.map((m) =>
      m.id === messageId ? { ...m, offerStatus } : m
    ),
  });
}

export async function markChatMessagesAsReadInFirestore(
  convId: string,
  messageIds: string[]
): Promise<void> {
  if (!convId || messageIds.length === 0) return;

  const idSet = new Set(messageIds);
  const map = getLocalMessagesMap();
  const currentList = map[convId] || [];
  if (currentList.length > 0) {
    saveLocalMessagesMap({
      ...map,
      [convId]: currentList.map((m) =>
        idSet.has(m.id) ? { ...m, isRead: true } : m
      ),
    });
  }

  await Promise.all(
    messageIds.map(async (messageId) => {
      try {
        await updateDoc(
          doc(db, 'chat_conversations', convId, 'messages', messageId),
          { isRead: true }
        );
      } catch {
        // Ignore missing seed/local-only docs gracefully
      }
    })
  );
}

export function subscribeToLiveConversations(
  profile: UserProfile,
  onUpdate: (convs: ChatConversation[]) => void
): () => void {
  if (!profile.isRegistered) {
    onUpdate([]);
    return () => {};
  }

  const mergeAndEmit = (firestoreList: ChatConversation[]) => {
    const localList = getLocalConversations();
    const map = new Map<string, ChatConversation>();
    localList.forEach((c) => {
      if (c && c.id) map.set(c.id, c);
    });
    firestoreList.forEach((c) => {
      if (c && c.id) map.set(c.id, c);
    });

    const visible = Array.from(map.values())
      .filter((c) => isConversationVisibleToUser(c, profile))
      .sort((a, b) => {
        const ta = a.updatedAtIso || a.createdAtIso || a.id;
        const tb = b.updatedAtIso || b.createdAtIso || b.id;
        return tb.localeCompare(ta);
      });

    onUpdate(visible);
  };

  try {
    return onSnapshot(
      collection(db, 'chat_conversations'),
      (snapshot) => {
        const firestoreList: ChatConversation[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as ChatConversation;
          firestoreList.push({
            ...data,
            id: docSnap.id,
          });
        });
        mergeAndEmit(firestoreList);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'chat_conversations');
        } catch (wrapped) {
          console.warn('Conversations listener fallback to local:', wrapped);
        }
        mergeAndEmit([]);
      }
    );
  } catch (err) {
    console.warn('Could not subscribe to chat_conversations:', err);
    mergeAndEmit([]);
    return () => {};
  }
}

export function subscribeToConversationMessages(
  convId: string,
  onUpdate: (messages: ChatMessage[]) => void
): () => void {
  if (!convId) {
    onUpdate([]);
    return () => {};
  }

  const mergeAndEmit = (firestoreMsgs: ChatMessage[]) => {
    const localMsgs = getLocalMessagesMap()[convId] || [];
    const map = new Map<string, ChatMessage>();
    localMsgs.forEach((m) => {
      if (m && m.id) map.set(m.id, m);
    });
    firestoreMsgs.forEach((m) => {
      if (m && m.id) map.set(m.id, m);
    });

    const sorted = Array.from(map.values()).sort((a, b) => {
      const ta = a.createdAtIso || a.id;
      const tb = b.createdAtIso || b.id;
      return ta.localeCompare(tb);
    });

    const currentMap = getLocalMessagesMap();
    saveLocalMessagesMap({ ...currentMap, [convId]: sorted });
    onUpdate(sorted);
  };

  try {
    const q = query(
      collection(db, 'chat_conversations', convId, 'messages'),
      orderBy('createdAtIso', 'asc')
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const list: ChatMessage[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as ChatMessage;
          list.push({ ...data, id: docSnap.id });
        });
        mergeAndEmit(list);
      },
      (error) => {
        try {
          handleFirestoreError(
            error,
            OperationType.LIST,
            `chat_conversations/${convId}/messages`
          );
        } catch (wrapped) {
          console.warn('Chat messages listener fallback to local:', wrapped);
        }
        mergeAndEmit([]);
      }
    );
  } catch (err) {
    console.warn('Could not subscribe to chat messages:', err);
    mergeAndEmit([]);
    return () => {};
  }
}

export async function syncSellerProfileToConversationsInFirestore(
  sellerId: string,
  updates: { brandName: string; avatarUrl?: string }
): Promise<void> {
  if (!sellerId) return;
  const safeBrand = updates.brandName.trim().slice(0, 100);
  const safeAvatar =
    updates.avatarUrl !== undefined && updates.avatarUrl.length <= 200000
      ? updates.avatarUrl
      : undefined;
  const nowIso = new Date().toISOString();

  try {
    const q = query(collection(db, 'chat_conversations'), where('sellerId', '==', sellerId));
    const snap = await getDocs(q);
    await Promise.all(
      snap.docs.map((d) =>
        updateDoc(doc(db, 'chat_conversations', d.id), {
          ...(safeBrand ? { storeName: safeBrand } : {}),
          ...(safeAvatar !== undefined ? { storeAvatar: safeAvatar } : {}),
          updatedAtIso: nowIso,
        }).catch(() => {})
      )
    );
  } catch (err) {
    console.warn('Could not sync seller profile to chat_conversations:', err);
  }

  const local = getLocalConversations();
  saveLocalConversations(
    local.map((c) =>
      c.sellerId === sellerId
        ? {
            ...c,
            ...(safeBrand ? { storeName: safeBrand } : {}),
            ...(safeAvatar !== undefined ? { storeAvatar: safeAvatar } : {}),
            updatedAtIso: nowIso,
          }
        : c
    )
  );
}
