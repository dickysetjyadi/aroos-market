import { doc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

const CLEANUP_FLAG_KEY = 'aroos_db_cleaned_production_v2';

export async function runProductionCleanup(): Promise<void> {
  try {
    // 1. Clean localStorage caches of demo users, accounts, orders, and chats
    const keysToRemove = [
      'nura_current_user_account',
      'nura_users_database',
      'shared_orders_v1',
      'shared_notifications_v1',
      'local_chat_convs_v1',
      'local_chat_msgs_v1',
    ];

    keysToRemove.forEach((key) => {
      const val = localStorage.getItem(key);
      if (val) {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter(
              (item: any) =>
                item?.id !== 'usr-buyer-001' &&
                item?.id !== 'usr-seller-001' &&
                !String(item?.name || '').toLowerCase().includes('dicky') &&
                !String(item?.email || '').toLowerCase().includes('dicky') &&
                !String(item?.id || '').startsWith('ord-88')
            );
            localStorage.setItem(key, JSON.stringify(filtered));
          } else if (typeof parsed === 'object' && parsed !== null) {
            // Check current user account
            if (
              parsed?.id === 'usr-buyer-001' ||
              parsed?.id === 'usr-seller-001' ||
              String(parsed?.name || '').toLowerCase().includes('dicky') ||
              String(parsed?.email || '').toLowerCase().includes('dicky')
            ) {
              localStorage.removeItem(key);
            }
          }
        } catch {
          // If not json or corrupt, remove if related to demo
          if (val.includes('dicky') || val.includes('usr-buyer-001')) {
            localStorage.removeItem(key);
          }
        }
      }
    });

    // Clean wishlist keys for demo users
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.includes('usr-buyer-001') || k.includes('usr-seller-001') || k.includes('dicky'))) {
        localStorage.removeItem(k);
      }
    }

    // 2. One-time Firestore demo record purge
    const alreadyCleaned = localStorage.getItem(CLEANUP_FLAG_KEY);
    if (!alreadyCleaned) {
      const demoUserIds = ['usr-buyer-001', 'usr-seller-001'];
      for (const uid of demoUserIds) {
        try {
          await deleteDoc(doc(db, 'users', uid));
        } catch {}
      }

      const demoOrderIds = ['ord-8801', 'ord-8802', 'ord-8803'];
      for (const oid of demoOrderIds) {
        try {
          await deleteDoc(doc(db, 'orders', oid));
        } catch {}
      }

      localStorage.setItem(CLEANUP_FLAG_KEY, 'true');
    }
  } catch (err) {
    console.warn('Production cleanup routine warning:', err);
  }
}
