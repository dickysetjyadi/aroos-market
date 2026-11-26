import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AccountStatus, UserAccount, UserRole } from '../types';
import {
  getAllUsersFromDb,
  normalizeEmail,
  saveUserToDb,
} from '../utils/userDb';
import { hashEmailKey } from './phoneAuthService';

export interface AdminLoginResponse {
  token: string;
  expiresAt: number;
  admin: {
    id: string;
    name: string;
    username: string;
  };
}

export async function loginSuperadmin(
  identifier: string,
  password: string
): Promise<AdminLoginResponse> {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ identifier, password }),
  });

  const data = (await res.json().catch(() => ({}))) as Partial<AdminLoginResponse> & {
    error?: string;
  };

  if (!res.ok || !data.token) {
    throw new Error(data.error || 'Gagal masuk sebagai Superadmin.');
  }

  return data as AdminLoginResponse;
}

export async function verifySuperadminToken(token: string): Promise<boolean> {
  if (!token) return false;
  try {
    const res = await fetch('/api/admin/verify', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) return false;
    const data = (await res.json().catch(() => ({}))) as { valid?: boolean };
    return Boolean(data.valid);
  } catch {
    return false;
  }
}

const DELETED_USERS_KEY = 'nura_deleted_users';

function getDeletedUserIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_USERS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

function markUserDeleted(userId: string): void {
  try {
    const ids = getDeletedUserIds();
    ids.add(userId);
    localStorage.setItem(DELETED_USERS_KEY, JSON.stringify(Array.from(ids).slice(-100)));
  } catch {}
}

export function subscribeToAllUsers(
  onUpdate: (users: UserAccount[]) => void
): () => void {
  const mergeAndEmit = (firestoreUsers: UserAccount[]) => {
    const deletedIds = getDeletedUserIds();
    const map = new Map<string, UserAccount>();
    getAllUsersFromDb().forEach((u) => {
      if (u && u.id && !deletedIds.has(u.id)) map.set(u.id, u);
    });
    firestoreUsers.forEach((u) => {
      if (u && u.id && !deletedIds.has(u.id)) {
        saveUserToDb(u);
        map.set(u.id, u);
      }
    });
    const list = Array.from(map.values()).sort((a, b) =>
      (b.createdAt || b.id).localeCompare(a.createdAt || a.id)
    );
    onUpdate(list);
  };

  try {
    return onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const list: UserAccount[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as UserAccount;
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

export async function adminCreateUser(params: {
  name: string;
  email: string;
  phone: string;
  city: string;
  address?: string;
  postalCode?: string;
  password: string;
  brandName?: string;
  roles?: UserRole[];
  accountStatus?: AccountStatus;
}): Promise<UserAccount> {
  const cleanEmail = normalizeEmail(params.email);
  const nowDate = new Date().toISOString().split('T')[0];
  const nowIso = new Date().toISOString();
  const id = `usr-${Date.now()}`;
  const cleanCity = (params.city || 'Jakarta Selatan').trim().slice(0, 80);
  const cleanName = params.name.trim().slice(0, 80);

  const account: UserAccount = {
    id,
    name: cleanName,
    email: cleanEmail,
    phone: (params.phone || '').trim().slice(0, 30),
    password: params.password,
    roles: params.roles && params.roles.length > 0 ? params.roles : ['buyer', 'seller'],
    activeRole: 'buyer',
    accountStatus: params.accountStatus || 'active',
    statusReason: '',
    statusUpdatedAt: nowIso,
    buyerProfile: {
      city: cleanCity,
      address: (params.address || '').trim(),
      postalCode: (params.postalCode || '').trim(),
      totalOrdersCount: 0,
    },
    sellerProfile: {
      brandName: (params.brandName || cleanName).trim().slice(0, 80),
      brandCity: cleanCity,
      planId: 'starter',
      registeredAt: nowDate,
      verifiedBrand: true,
    },
    createdAt: nowDate,
    updatedAt: nowIso,
  };

  saveUserToDb(account);

  if (cleanEmail) {
    try {
      const emailKey = await hashEmailKey(cleanEmail);
      await setDoc(doc(db, 'email_registry', emailKey), {
        emailKey,
        userId: id,
        createdAt: nowIso,
      });
    } catch {}
  }

  await setDoc(
    doc(db, 'users', id),
    {
      id: account.id,
      name: account.name,
      avatarUrl: '',
      phone: account.phone || '',
      password: account.password || '',
      email: account.email,
      city: cleanCity,
      roles: account.roles,
      activeRole: account.activeRole,
      phoneVerified: Boolean(account.phone),
      buyerProfile: account.buyerProfile || null,
      sellerProfile: account.sellerProfile || null,
      accountStatus: account.accountStatus || 'active',
      statusReason: '',
      statusUpdatedAt: nowIso,
      createdAt: account.createdAt,
      updatedAt: nowIso,
    },
    { merge: true }
  );

  return account;
}

export async function adminUpdateUser(
  user: UserAccount,
  updates: {
    name?: string;
    email?: string;
    phone?: string;
    city?: string;
    address?: string;
    brandName?: string;
    accountStatus?: AccountStatus;
    statusReason?: string;
    password?: string;
  }
): Promise<UserAccount> {
  const nowIso = new Date().toISOString();
  const nextCity = (
    updates.city ??
    user.buyerProfile?.city ??
    user.sellerProfile?.brandCity ??
    'Jakarta'
  )
    .trim()
    .slice(0, 80);
  const nextName = (updates.name ?? user.name).trim().slice(0, 80);
  const nextEmail = normalizeEmail(updates.email ?? user.email ?? '');

  const updated: UserAccount = {
    ...user,
    name: nextName,
    email: nextEmail,
    phone: (updates.phone ?? user.phone ?? '').trim().slice(0, 30),
    password: updates.password !== undefined ? updates.password : user.password,
    accountStatus: updates.accountStatus ?? user.accountStatus ?? 'active',
    statusReason:
      updates.statusReason !== undefined
        ? updates.statusReason.slice(0, 300)
        : user.statusReason || '',
    statusUpdatedAt: updates.accountStatus ? nowIso : user.statusUpdatedAt || nowIso,
    buyerProfile: {
      ...(user.buyerProfile || {}),
      city: nextCity,
      ...(updates.address !== undefined ? { address: updates.address.trim() } : {}),
    },
    sellerProfile: {
      brandName: (updates.brandName ?? user.sellerProfile?.brandName ?? nextName).trim(),
      brandCity: nextCity,
      planId: user.sellerProfile?.planId || 'starter',
      registeredAt: user.sellerProfile?.registeredAt || user.createdAt || nowIso.split('T')[0],
      verifiedBrand: user.sellerProfile?.verifiedBrand ?? true,
      ...(user.sellerProfile?.brandDescription
        ? { brandDescription: user.sellerProfile.brandDescription }
        : {}),
    },
    updatedAt: nowIso,
  };

  saveUserToDb(updated);

  await setDoc(
    doc(db, 'users', updated.id),
    {
      id: updated.id,
      name: updated.name,
      avatarUrl: updated.avatarUrl || '',
      phone: updated.phone || '',
      password: updated.password || '',
      email: updated.email,
      city: nextCity,
      roles: updated.roles || ['buyer', 'seller'],
      activeRole: updated.activeRole || 'buyer',
      phoneVerified: Boolean(updated.phone),
      buyerProfile: updated.buyerProfile || null,
      sellerProfile: updated.sellerProfile || null,
      accountStatus: updated.accountStatus || 'active',
      statusReason: updated.statusReason || '',
      statusUpdatedAt: updated.statusUpdatedAt || nowIso,
      createdAt: updated.createdAt || nowIso.split('T')[0],
      updatedAt: nowIso,
    },
    { merge: true }
  );

  return updated;
}

export async function adminResetUserPassword(
  user: UserAccount,
  newPassword: string
): Promise<UserAccount> {
  return adminUpdateUser(user, { password: newPassword });
}

export async function adminSetUserStatus(
  user: UserAccount,
  status: AccountStatus,
  reason?: string
): Promise<UserAccount> {
  const updated = await adminUpdateUser(user, {
    accountStatus: status,
    statusReason: reason || '',
  });

  if (status === 'banned') {
    try {
      const q = query(collection(db, 'products'), where('sellerId', '==', user.id));
      const snap = await getDocs(q);
      await Promise.all(
        snap.docs.map((d) =>
          updateDoc(doc(db, 'products', d.id), {
            isActive: false,
            updatedAt: new Date().toISOString(),
          }).catch(() => {})
        )
      );
    } catch {}
  }

  return updated;
}

export async function adminDeleteUser(
  userId: string,
  email?: string
): Promise<void> {
  markUserDeleted(userId);
  try {
    const localList = getAllUsersFromDb().filter((u) => u.id !== userId);
    localStorage.setItem('nura_users_database', JSON.stringify(localList));
  } catch {}

  if (email) {
    try {
      const emailKey = await hashEmailKey(email);
      await deleteDoc(doc(db, 'email_registry', emailKey));
    } catch {}
  }

  try {
    await deleteDoc(doc(db, 'users', userId));
  } catch (err) {
    console.warn('Firestore user delete warning:', err);
  }
}
