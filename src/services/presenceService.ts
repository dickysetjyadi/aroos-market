import {
  collection,
  doc,
  setDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserPresence } from '../types';

const LOCAL_PRESENCE_KEY = 'aroos_user_presence_cache_v1';
const ONLINE_FRESH_MS = 120_000;

function getLocalPresenceMap(): Record<string, UserPresence> {
  try {
    const raw = localStorage.getItem(LOCAL_PRESENCE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveLocalPresenceEntry(entry: UserPresence): void {
  try {
    const map = getLocalPresenceMap();
    map[entry.userId] = entry;
    localStorage.setItem(LOCAL_PRESENCE_KEY, JSON.stringify(map));
  } catch {}
}

export async function updateUserPresence(
  userId: string,
  isOnline: boolean
): Promise<void> {
  const cleanId = (userId || '').trim();
  if (!cleanId) return;

  const now = Date.now();
  const payload: UserPresence = {
    userId: cleanId,
    isOnline,
    lastActiveAt: now,
    updatedAtIso: new Date(now).toISOString(),
  };

  saveLocalPresenceEntry(payload);

  try {
    await setDoc(doc(db, 'user_presence', cleanId), payload, { merge: true });
  } catch (err) {
    console.warn('Presence update saved locally:', err);
  }
}

export function subscribeToAllPresences(
  onUpdate: (presenceMap: Record<string, UserPresence>) => void
): () => void {
  const emitMerged = (firestoreMap: Record<string, UserPresence>) => {
    const merged: Record<string, UserPresence> = {
      ...getLocalPresenceMap(),
      ...firestoreMap,
    };
    onUpdate(merged);
  };

  try {
    return onSnapshot(
      collection(db, 'user_presence'),
      (snapshot) => {
        const map: Record<string, UserPresence> = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as UserPresence;
          if (data && (data.userId || docSnap.id)) {
            const uid = data.userId || docSnap.id;
            map[uid] = { ...data, userId: uid };
          }
        });
        emitMerged(map);
      },
      () => {
        emitMerged({});
      }
    );
  } catch {
    emitMerged({});
    return () => {};
  }
}

export function subscribeToUserPresence(
  userId: string,
  onUpdate: (presence: UserPresence | null) => void
): () => void {
  const cleanId = (userId || '').trim();
  if (!cleanId) {
    onUpdate(null);
    return () => {};
  }

  try {
    return onSnapshot(
      doc(db, 'user_presence', cleanId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as UserPresence;
          saveLocalPresenceEntry(data);
          onUpdate(data);
        } else {
          onUpdate(getLocalPresenceMap()[cleanId] || null);
        }
      },
      () => {
        onUpdate(getLocalPresenceMap()[cleanId] || null);
      }
    );
  } catch {
    onUpdate(getLocalPresenceMap()[cleanId] || null);
    return () => {};
  }
}

export function formatPresenceLabel(
  presence?: UserPresence | null,
  nowMs: number = Date.now()
): { isOnline: boolean; label: string } {
  if (!presence) {
    return { isOnline: false, label: 'Belum pernah login' };
  }

  const diffMs = Math.max(0, nowMs - (presence.lastActiveAt || 0));
  if (presence.isOnline && diffMs <= ONLINE_FRESH_MS) {
    return { isOnline: true, label: 'Aktif sekarang' };
  }

  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return { isOnline: false, label: 'Terakhir aktif baru saja' };
  if (mins < 60) return { isOnline: false, label: `Terakhir aktif ${mins} mnt lalu` };

  const hours = Math.floor(mins / 60);
  if (hours < 24) return { isOnline: false, label: `Terakhir aktif ${hours} jam lalu` };

  const days = Math.floor(hours / 24);
  if (days < 7) return { isOnline: false, label: `Terakhir aktif ${days} hari lalu` };

  const dateStr = new Date(presence.lastActiveAt).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
  });
  return { isOnline: false, label: `Terakhir aktif ${dateStr}` };
}
