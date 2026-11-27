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
import {
  hashEmailKey,
  sanitizeBuyerProfile,
  sanitizeSellerProfile,
  syncPublicProfileToFirestore,
} from './phoneAuthService';
import { hashPassword } from '../utils/passwordHash';

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

function sanitizeUserForClient(
  raw: UserAccount & { city?: string; followingStores?: string[] },
  includePrivatePii: boolean
): UserAccount {
  const baseCity =
    raw.buyerProfile?.city || raw.city || raw.sellerProfile?.brandCity || 'Jakarta';
  const followingStores =
    raw.buyerProfile?.followingStores || raw.followingStores || [];

  if (includePrivatePii) {
    return {
      ...raw,
      password: '',
    };
  }

  return {
    id: raw.id,
    name: raw.name || 'Pengguna AROOS',
    avatarUrl: raw.avatarUrl || '',
    email: '',
    phone: '',
    password: '',
    roles: raw.roles || ['buyer', 'seller'],
    activeRole: raw.activeRole || 'buyer',
    accountStatus: raw.accountStatus || 'active',
    buyerProfile: {
      city: baseCity,
      followingStores,
    },
    sellerProfile: raw.sellerProfile,
    createdAt: raw.createdAt || '',
    updatedAt: raw.updatedAt,
  };
}

export function subscribeToAllUsers(
  onUpdate: (users: UserAccount[]) => void,
  options?: { includePrivatePii?: boolean }
): () => void {
  const includePrivatePii = Boolean(options?.includePrivatePii);
  const sortUsers = (list: UserAccount[]) =>
    [...list].sort((a, b) => (b.createdAt || b.id).localeCompare(a.createdAt || a.id));

  let publicMap = new Map<string, UserAccount>();
  let legacyMap = new Map<string, UserAccount>();

  const emitMerged = () => {
    const merged = new Map<string, UserAccount>();
    legacyMap.forEach((u, id) => merged.set(id, sanitizeUserForClient(u, includePrivatePii)));
    if (!includePrivatePii) {
      publicMap.forEach((u, id) => merged.set(id, sanitizeUserForClient(u, false)));
    }
    const sorted = sortUsers(Array.from(merged.values()));
    if (!includePrivatePii) {
      try {
        localStorage.setItem('nura_users_database', JSON.stringify(sorted));
      } catch {}
    }
    onUpdate(sorted);
  };

  try {
    const unsubPublic = includePrivatePii
      ? () => {}
      : onSnapshot(
          collection(db, 'public_profiles'),
          (snapshot) => {
            const next = new Map<string, UserAccount>();
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as UserAccount & { city?: string; followingStores?: string[] };
              if (data && docSnap.id) {
                next.set(docSnap.id, { ...data, id: docSnap.id });
              }
            });
            publicMap = next;
            emitMerged();
          },
          () => {}
        );

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const next = new Map<string, UserAccount>();
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as UserAccount;
          if (data && docSnap.id) {
            next.set(docSnap.id, { ...data, id: docSnap.id });
          }
        });
        legacyMap = next;
        emitMerged();
      },
      () => {
        onUpdate(
          sortUsers(
            getAllUsersFromDb().map((u) => sanitizeUserForClient(u, includePrivatePii))
          )
        );
      }
    );

    return () => {
      unsubPublic();
      unsubUsers();
    };
  } catch {
    onUpdate(
      sortUsers(getAllUsersFromDb().map((u) => sanitizeUserForClient(u, includePrivatePii)))
    );
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
  const id = `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const cleanCity = (params.city || 'Jakarta Selatan').trim().slice(0, 80);
  const cleanName = params.name.trim().slice(0, 80);

  const hashedPassword = params.password
    ? (await hashPassword(params.password)).slice(0, 200)
    : '';

  const safeBuyerProfile = sanitizeBuyerProfile({
    city: cleanCity,
    address: (params.address || '').trim(),
    postalCode: (params.postalCode || '').trim(),
    totalOrdersCount: 0,
  });

  const safeSellerProfile = sanitizeSellerProfile({
    brandName: (params.brandName || cleanName).trim().slice(0, 80),
    brandCity: cleanCity,
    planId: 'starter',
    registeredAt: nowDate,
    verifiedBrand: true,
  });

  const account: UserAccount = {
    id,
    name: cleanName,
    email: cleanEmail.slice(0, 120),
    phone: (params.phone || '').trim().slice(0, 30),
    password: hashedPassword,
    roles: params.roles && params.roles.length > 0 ? params.roles : ['buyer', 'seller'],
    activeRole: 'buyer',
    accountStatus: params.accountStatus || 'active',
    statusReason: '',
    statusUpdatedAt: nowIso,
    buyerProfile: safeBuyerProfile,
    sellerProfile: safeSellerProfile,
    createdAt: nowDate,
    updatedAt: nowIso,
  };

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

  void syncPublicProfileToFirestore(account);
  saveUserToDb(sanitizeUserForClient(account, false));

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

  const nextPassword =
    updates.password !== undefined
      ? updates.password
        ? (await hashPassword(updates.password)).slice(0, 200)
        : ''
      : user.password || '';

  const safeBuyerProfile = sanitizeBuyerProfile({
    ...(user.buyerProfile || {}),
    city: nextCity,
    ...(updates.address !== undefined ? { address: updates.address.trim() } : {}),
  });

  const safeSellerProfile = sanitizeSellerProfile({
    brandName: (updates.brandName ?? user.sellerProfile?.brandName ?? nextName).trim(),
    brandCity: nextCity,
    planId: user.sellerProfile?.planId || 'starter',
    registeredAt: user.sellerProfile?.registeredAt || user.createdAt || nowIso.split('T')[0],
    verifiedBrand: user.sellerProfile?.verifiedBrand ?? true,
    ...(user.sellerProfile?.brandDescription
      ? { brandDescription: user.sellerProfile.brandDescription }
      : {}),
  });

  const updated: UserAccount = {
    ...user,
    name: nextName,
    email: nextEmail,
    phone: (updates.phone ?? user.phone ?? '').trim().slice(0, 30),
    password: nextPassword,
    accountStatus: updates.accountStatus ?? user.accountStatus ?? 'active',
    statusReason:
      updates.statusReason !== undefined
        ? updates.statusReason.slice(0, 300)
        : user.statusReason || '',
    statusUpdatedAt: updates.accountStatus ? nowIso : user.statusUpdatedAt || nowIso,
    buyerProfile: safeBuyerProfile,
    sellerProfile: safeSellerProfile,
    updatedAt: nowIso,
  };

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
      buyerProfile: safeBuyerProfile || null,
      sellerProfile: safeSellerProfile || null,
      accountStatus: updated.accountStatus || 'active',
      statusReason: updated.statusReason || '',
      statusUpdatedAt: updated.statusUpdatedAt || nowIso,
      createdAt: updated.createdAt || nowIso.split('T')[0],
      updatedAt: nowIso,
    },
    { merge: true }
  );

  void syncPublicProfileToFirestore(updated);
  saveUserToDb(sanitizeUserForClient(updated, false));

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

  try {
    await deleteDoc(doc(db, 'public_profiles', userId));
  } catch {}
}
