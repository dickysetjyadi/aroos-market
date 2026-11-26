import { UserAccount, UserProfile, UserRole } from '../types';

const USERS_DB_KEY = 'nura_users_database';
const CURRENT_USER_KEY = 'nura_current_user_account';

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const isValidEmailFormat = (email: string): boolean => {
  const clean = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean);
};

// Seed default mock database with 1 buyer and 1 seller account
const INITIAL_USERS: UserAccount[] = [];

export const getAllUsersFromDb = (): UserAccount[] => {
  try {
    const saved = localStorage.getItem(USERS_DB_KEY);
    if (saved) {
      const parsed: UserAccount[] = JSON.parse(saved);
      const clean = parsed.filter(u => 
        u.id !== 'usr-buyer-001' && 
        u.id !== 'usr-seller-001'
      );
      if (clean.length !== parsed.length) {
        localStorage.setItem(USERS_DB_KEY, JSON.stringify(clean));
      }
      return clean;
    }
  } catch (err) {
    console.error('Failed to load users db', err);
  }
  try {
    localStorage.setItem(USERS_DB_KEY, JSON.stringify(INITIAL_USERS));
  } catch {}
  return INITIAL_USERS;
};

export const findLocalUserByEmail = (email: string): UserAccount | null => {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail) return null;
  const users = getAllUsersFromDb();
  return users.find(u => normalizeEmail(u.email || '') === cleanEmail) || null;
};

export const saveUserToDb = (user: UserAccount): UserAccount[] => {
  const users = getAllUsersFromDb();
  const normalizedUser: UserAccount = {
    ...user,
    email: normalizeEmail(user.email || ''),
  };
  const existingIndex = users.findIndex(
    u =>
      u.id === normalizedUser.id ||
      (normalizedUser.email && normalizeEmail(u.email || '') === normalizedUser.email)
  );
  let updatedList: UserAccount[];

  if (existingIndex > -1) {
    updatedList = [...users];
    updatedList[existingIndex] = { ...updatedList[existingIndex], ...normalizedUser };
  } else {
    updatedList = [normalizedUser, ...users];
  }

  try {
    localStorage.setItem(USERS_DB_KEY, JSON.stringify(updatedList));
  } catch (err) {
    console.error('Failed to save user to db', err);
  }
  return updatedList;
};

export const getCurrentUserAccount = (): UserAccount | null => {
  try {
    const saved = localStorage.getItem(CURRENT_USER_KEY);
    if (saved) {
      const user: UserAccount = JSON.parse(saved);
      if (
        user.id === 'usr-buyer-001' || 
        user.id === 'usr-seller-001'
      ) {
        localStorage.removeItem(CURRENT_USER_KEY);
        return null;
      }
      return user;
    }
  } catch {}
  return null;
};

export const setCurrentUserAccount = (user: UserAccount | null) => {
  try {
    if (user) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
      saveUserToDb(user);
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
  } catch (err) {
    console.error('Failed to set current user account', err);
  }
};

// Convert UserAccount to UserProfile format for app legacy compatibility
export const userAccountToProfile = (account: UserAccount | null): UserProfile => {
  if (!account) {
    return {
      isRegistered: false,
      name: '',
      phone: '',
      email: '',
      isSeller: false,
      roles: ['buyer'],
      activeRole: 'buyer',
    };
  }

  // All registered users are universal users (can buy and sell!)
  return {
    id: account.id,
    isRegistered: true,
    name: account.name,
    avatarUrl: account.avatarUrl || '',
    phone: account.phone || '',
    email: account.email,
    isSeller: true,
    brandName: account.sellerProfile?.brandName || account.name,
    brandCity: account.sellerProfile?.brandCity || 'Bandung',
    roles: Array.from(new Set([...(account.roles || ['buyer']), 'seller'])),
    activeRole: account.activeRole || 'buyer',
    buyerProfile: account.buyerProfile,
    sellerProfile: account.sellerProfile || {
      brandName: account.name,
      brandCity: 'Bandung',
      planId: 'starter',
      registeredAt: account.createdAt || new Date().toISOString().split('T')[0],
      verifiedBrand: true,
    },
  };
};
