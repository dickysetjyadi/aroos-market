import React, { Suspense, lazy, useState, useEffect, useMemo, useRef } from 'react';
import { 
  motion, 
  AnimatePresence 
} from 'motion/react';
import { 
  ShoppingBag, ShieldCheck, 
  CheckCircle2, AlertTriangle, X,
  RefreshCw, MessageSquare, Clock, Users, UserPlus, UserCheck, MapPin
} from 'lucide-react';

import { 
  Product, ProductGender, Review, Order, OrderStatus, 
  NotificationItem, UserProfile, UserAccount,
  ChatConversation, ChatProductContext, PaymentMethod,
  LoginLogEntry, UserPresence, UserReport,
} from './types';
import { 
  INITIAL_PRODUCTS, INITIAL_ORDERS, 
  INITIAL_NOTIFICATIONS, INITIAL_CHAT_CONVERSATIONS
} from './data/mockData';
import { 
  getCategorySpec, 
  getFilterSizeOptions, 
  doesProductMatchSizeFilter 
} from './data/categorySpecs';
import { getAllUsersFromDb, getCurrentUserAccount, setCurrentUserAccount, userAccountToProfile } from './utils/userDb';
import { saveUserToFirestore, subscribeToCurrentUserAccount } from './services/phoneAuthService';
import { isProductOwnedByUser, isStoreOwnedByUser } from './utils/ownership';
import {
  buildSellerDirectory,
  getStoreFollowerCount,
  getStoreFollowersList,
  getStoreFollowingList,
  getStoreUniqueKey,
  isStoreFollowed,
  loadFollowerDeltas,
  loadFollowingStores,
  loadRecentlyViewedIds,
  normalizeStoreKey,
  pushRecentlyViewedId,
  saveFollowingStores,
  saveRecentlyViewedIds,
  updateFollowerDelta,
} from './utils/marketplaceSocial';
import {
  AROOS_PAGE_TRANSITION,
  AROOS_PAGE_VARIANTS,
  AROOS_TAB_TRANSITION,
  AROOS_TAB_VARIANTS,
} from './utils/motionPresets';

type PendingAuthIntent =
  | { type: 'sell' }
  | { type: 'wishlist'; product: Product }
  | { type: 'chat'; storeName: string; productContext?: ChatProductContext; sellerId?: string }
  | { type: 'review'; product: Product }
  | { type: 'store_review'; storeTarget: { brandName: string; sellerId?: string } | null }
  | { type: 'follow'; brandName: string; sellerId?: string };

const DEMO_USER_IDS = new Set(['usr-buyer-001', 'usr-seller-001']);

const getWishlistStorageKey = (accountId?: string | null) =>
  accountId ? `nura_wishlist_${accountId}` : null;

function loadAccountWishlist(accountId?: string | null): string[] {
  const key = getWishlistStorageKey(accountId);
  if (!key) return [];
  try {
    const saved = localStorage.getItem(key);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

import { 
  subscribeToLiveProducts, 
  saveProductToFirestore, 
  toggleProductActiveStatus, 
  deleteProductFromFirestore, 
  updateProductListingInFirestore,
  toggleProductLikesTransaction,
  getDeletedProductIds,
} from './services/productService';
import {
  createOrderAndDecrementStockTransaction,
  updateOrderInFirestore,
  subscribeToLiveOrders,
  createNotificationInFirestore,
  markNotificationReadInFirestore,
  subscribeToLiveNotifications,
  resolveSellerIdentity,
  resolveBuyerIdentity,
  isOrderForBuyer,
  isOrderForSeller,
  isNotificationForUser,
  getLocalSharedOrders,
  getLocalSharedNotifications,
} from './services/orderService';

import {
  subscribeToLiveConversations,
  getUnreadCountForUser,
  getRoleInConversation,
  getLocalMessagesMap,
} from './services/chatService';
import { createReviewInFirestore, getLocalReviews, subscribeToLiveReviews } from './services/reviewService';
import { subscribeToAllUsers } from './services/adminService';
import { subscribeToAllPresences, updateUserPresence } from './services/presenceService';
import { subscribeToLoginLogs } from './services/telemetryService';
import { subscribeToUserReports } from './services/reportService';
import type { ReportTarget } from './components/ReportModal';

import { Navbar } from './components/Navbar';
import { HeroBanner, AiSearchResult } from './components/HeroBanner';
import { CatalogFilterBar } from './components/CatalogFilterBar';
import { ProductCard } from './components/ProductCard';
import { MobileNav } from './components/MobileNav';
import type { SellerTabId } from './components/SellerStudio/SellerHeader';

const ProductDetailModal = lazy(() =>
  import('./components/ProductDetailModal').then((m) => ({ default: m.ProductDetailModal }))
);
const OrdersModal = lazy(() =>
  import('./components/OrdersModal').then((m) => ({ default: m.OrdersModal }))
);
const UserAuthModal = lazy(() =>
  import('./components/UserAuthModal').then((m) => ({ default: m.UserAuthModal }))
);
const ProfilePage = lazy(() =>
  import('./components/ProfilePage').then((m) => ({ default: m.ProfilePage }))
);
const ChatModal = lazy(() =>
  import('./components/ChatModal').then((m) => ({ default: m.ChatModal }))
);
const SellerDirectoryModal = lazy(() =>
  import('./components/SellerDirectoryModal').then((m) => ({ default: m.SellerDirectoryModal }))
);
const FollowersModal = lazy(() =>
  import('./components/FollowersModal').then((m) => ({ default: m.FollowersModal }))
);
const SellerHeader = lazy(() =>
  import('./components/SellerStudio/SellerHeader').then((m) => ({ default: m.SellerHeader }))
);
const InventoryManager = lazy(() =>
  import('./components/SellerStudio/InventoryManager').then((m) => ({ default: m.InventoryManager }))
);
const SellerOrdersPanel = lazy(() =>
  import('./components/SellerStudio/SellerOrdersPanel').then((m) => ({ default: m.SellerOrdersPanel }))
);
const ReportExporter = lazy(() =>
  import('./components/SellerStudio/ReportExporter').then((m) => ({ default: m.ReportExporter }))
);
const PostOrderReviewModal = lazy(() =>
  import('./components/PostOrderReviewModal').then((m) => ({ default: m.PostOrderReviewModal }))
);
const ReportModal = lazy(() =>
  import('./components/ReportModal').then((m) => ({ default: m.ReportModal }))
);
const SuperadminPanel = lazy(() =>
  import('./components/Admin/SuperadminPanel').then((m) => ({ default: m.SuperadminPanel }))
);

export default function App() {
  // Current user account & profile state from Database
  const [currentUserAccount, setCurrentUserAccountState] = useState<UserAccount | null>(() => {
    return getCurrentUserAccount();
  });

  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    return userAccountToProfile(currentUserAccount);
  });

  // App View State: 'shopper', 'seller', or 'profile'
  const [activeMode, setActiveMode] = useState<'shopper' | 'seller' | 'profile'>('shopper');
  const [activeSellerTab, setActiveSellerTab] = useState<SellerTabId>('sell');
  const [pendingEditProductId, setPendingEditProductId] = useState<string | null>(null);
  const [pendingAuthIntent, setPendingAuthIntent] = useState<PendingAuthIntent | null>(null);

  // Core Data Stores
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const deletedIds = getDeletedProductIds();
      const saved = localStorage.getItem('nura_products');
      if (!saved) {
        return INITIAL_PRODUCTS.filter(p => !deletedIds.has(p.id));
      }
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return INITIAL_PRODUCTS.filter(p => !deletedIds.has(p.id));
      }
      
      const initialMap = new Map(INITIAL_PRODUCTS.map(p => [p.id, p]));
      const sanitized = parsed.map((p: Product) => {
        const base = initialMap.get(p.id);
        if (base) {
          return {
            ...base,
            ...p,
            image: (!p.image || p.image.startsWith('http') || p.image.includes('unsplash') || p.id === 'prod-005' || p.id === 'prod-006') ? base.image : p.image,
            condition: p.condition || base.condition,
            listingStatus: p.listingStatus || base.listingStatus || 'available',
            images: p.images || base.images,
            allowMeetup: p.allowMeetup ?? base.allowMeetup,
            meetupArea: p.meetupArea || base.meetupArea,
            createdAt: p.createdAt || base.createdAt,
            sellerAvatar: p.sellerAvatar || base.sellerAvatar,
            subCategory: p.subCategory || base.subCategory,
            gender: p.gender || base.gender,
            fit: p.fit || base.fit,
            itemBrand: p.itemBrand || base.itemBrand,
          };
        }
        return p;
      });

      INITIAL_PRODUCTS.forEach(ip => {
        if (!deletedIds.has(ip.id) && !sanitized.some(p => p.id === ip.id)) {
          sanitized.push(ip);
        }
      });

      return sanitized.filter(p => !deletedIds.has(p.id));
    } catch {
      const deletedIds = getDeletedProductIds();
      return INITIAL_PRODUCTS.filter(p => !deletedIds.has(p.id));
    }
  });

  const [reviews, setReviews] = useState<Review[]>(() => getLocalReviews());

  // Superadmin, Presence, Telemetry & Report States
  const [adminSession, setAdminSession] = useState<{
    token: string;
    expiresAt: number;
    name: string;
  } | null>(() => {
    try {
      const saved = localStorage.getItem('nura_admin_session');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed.expiresAt === 'number' && parsed.expiresAt > Date.now()) {
        return parsed;
      }
      localStorage.removeItem('nura_admin_session');
    } catch {}
    return null;
  });

  const handleSetAdminSession = (sess: { token: string; expiresAt: number; name: string; } | null) => {
    setAdminSession(sess);
    try {
      if (sess) {
        localStorage.setItem('nura_admin_session', JSON.stringify(sess));
      } else {
        localStorage.removeItem('nura_admin_session');
      }
    } catch {}
  };
  const [allUsersList, setAllUsersList] = useState<UserAccount[]>(() => getAllUsersFromDb());
  const [loginLogs, setLoginLogs] = useState<LoginLogEntry[]>([]);
  const [userReports, setUserReports] = useState<UserReport[]>([]);
  const [presenceMap, setPresenceMap] = useState<Record<string, UserPresence>>({});
  const [postOrderReviewTarget, setPostOrderReviewTarget] = useState<Order | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  const [allLiveOrders, setAllLiveOrders] = useState<Order[]>(() => getLocalSharedOrders());
  const [allLiveNotifications, setAllLiveNotifications] = useState<NotificationItem[]>(() =>
    getLocalSharedNotifications()
  );
  const [sessionNotifications, setSessionNotifications] = useState<NotificationItem[]>([]);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('aroos_read_notifications_v1');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  });

  const buyerOrders = useMemo(() => {
    if (!userProfile.isRegistered) return [];
    const matched = allLiveOrders.filter((o) => isOrderForBuyer(o, userProfile));
    if (userProfile.id === 'usr-buyer-001') {
      const existingIds = new Set(matched.map((o) => o.id));
      const demo = INITIAL_ORDERS.filter((o) => !existingIds.has(o.id));
      return [...matched, ...demo];
    }
    return matched;
  }, [allLiveOrders, userProfile]);

  const sellerIncomingOrders = useMemo(() => {
    if (!userProfile.isRegistered) return [];
    const matched = allLiveOrders.filter((o) => isOrderForSeller(o, userProfile));
    if (userProfile.id === 'usr-seller-001') {
      const existingIds = new Set(matched.map((o) => o.id));
      const demo = INITIAL_ORDERS.filter((o) => !existingIds.has(o.id));
      return [...matched, ...demo];
    }
    return matched;
  }, [allLiveOrders, userProfile]);

  const notifications = useMemo(() => {
    if (!userProfile.isRegistered) return [];
    const targetedLive = allLiveNotifications.filter((n) =>
      isNotificationForUser(n, userProfile)
    );
    const demoNotifs = DEMO_USER_IDS.has(userProfile.id || '') ? INITIAL_NOTIFICATIONS : [];
    const readIdSet = new Set(readNotificationIds);
    const combinedMap = new Map<string, NotificationItem>();

    [...sessionNotifications, ...targetedLive, ...demoNotifs].forEach((item) => {
      if (item && item.id && !combinedMap.has(item.id)) {
        combinedMap.set(item.id, {
          ...item,
          read: Boolean(item.read) || readIdSet.has(item.id),
        });
      }
    });

    return Array.from(combinedMap.values()).sort((a, b) => {
      const ta = a.createdAtIso || a.id;
      const tb = b.createdAtIso || b.id;
      return tb.localeCompare(ta);
    });
  }, [allLiveNotifications, sessionNotifications, readNotificationIds, userProfile]);

  // Shopper Interaction States
  const [aiSearchQuery, setAiSearchQuery] = useState<string>('');
  const [aiSearchResult, setAiSearchResult] = useState<AiSearchResult | null>(null);
  const [isAiSearching, setIsAiSearching] = useState<boolean>(false);
  const [aiSearchError, setAiSearchError] = useState<string | null>(null);
  const aiSearchAbortRef = useRef<AbortController | null>(null);
  const aiSearchCacheRef = useRef<Map<string, AiSearchResult>>(new Map());
  const [selectedCategory, setSelectedCategory] = useState<'Semua' | Product['category']>('Semua');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('Semua');
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedGender, setSelectedGender] = useState<'Semua' | ProductGender>('Semua');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [selectedCondition, setSelectedCondition] = useState<'Semua' | 'Baru' | 'Pre-loved'>('Semua');
  const [selectedCity, setSelectedCity] = useState<string>('Semua Kota');
  const [catalogSearch, setCatalogSearch] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [sortBy, setSortBy] = useState<'baru' | 'murah' | 'mahal' | 'lama'>('baru');

  // Wishlist State with per-account LocalStorage Persistence
  const [wishlistIds, setWishlistIds] = useState<string[]>(() => loadAccountWishlist(currentUserAccount?.id));
  const [isWishlistOnly, setIsWishlistOnly] = useState<boolean>(false);

  // Social Follow & Recently Viewed States
  const [followingStores, setFollowingStores] = useState<string[]>(() =>
    loadFollowingStores(currentUserAccount?.id)
  );
  const [followerDeltas, setFollowerDeltas] = useState<Record<string, number>>(() =>
    loadFollowerDeltas()
  );
  const [isFollowingOnly, setIsFollowingOnly] = useState<boolean>(false);
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>(() =>
    loadRecentlyViewedIds(currentUserAccount?.id)
  );
  const [isCatalogSearchFocused, setIsCatalogSearchFocused] = useState<boolean>(false);
  const catalogSearchBoxRef = useRef<HTMLDivElement | null>(null);
  const recentlyViewedSectionRef = useRef<HTMLDivElement | null>(null);
  const handledDeepLinkRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isCatalogSearchFocused) return;
    const handlePointerDownOutside = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (
        catalogSearchBoxRef.current?.contains(target) ||
        recentlyViewedSectionRef.current?.contains(target)
      ) {
        return;
      }
      setIsCatalogSearchFocused(false);
    };
    document.addEventListener('pointerdown', handlePointerDownOutside);
    return () => document.removeEventListener('pointerdown', handlePointerDownOutside);
  }, [isCatalogSearchFocused]);

  useEffect(() => {
    const key = getWishlistStorageKey(currentUserAccount?.id);
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(wishlistIds));
    } catch {}
  }, [wishlistIds, currentUserAccount?.id]);

  useEffect(() => {
    if (!currentUserAccount?.id) return;
    saveFollowingStores(currentUserAccount.id, followingStores);
  }, [followingStores, currentUserAccount?.id]);

  useEffect(() => {
    saveRecentlyViewedIds(currentUserAccount?.id, recentlyViewedIds);
  }, [recentlyViewedIds, currentUserAccount?.id]);

  // Modals & Full-Page Storefront Target
  const [isOrdersOpen, setIsOrdersOpen] = useState<boolean>(false);
  const [isUserAuthOpen, setIsUserAuthOpen] = useState<boolean>(false);
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState<boolean>(false);
  const [isSellerDirectoryOpen, setIsSellerDirectoryOpen] = useState<boolean>(false);
  const [selectedStoreTarget, setSelectedStoreTarget] = useState<{
    brandName: string;
    sellerId?: string;
  } | null>(null);
  const [followersModal, setFollowersModal] = useState<{
    brandName: string;
    sellerId?: string;
    tab: 'followers' | 'following';
  } | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Live Chat States
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const isChatOpenRef = useRef<boolean>(false);
  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
  }, [isChatOpen]);
  const [chatStoreName, setChatStoreName] = useState<string>('');
  const [chatProductContext, setChatProductContext] = useState<ChatProductContext | null>(null);
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const [liveConversations, setLiveConversations] = useState<ChatConversation[]>([]);

  const requireAuth = (
    intent: PendingAuthIntent,
    toastTitle?: string,
    toastMessage?: string
  ): boolean => {
    if (userProfile.isRegistered) return true;
    setPendingAuthIntent(intent);
    openAuthModal('login');
    if (toastTitle && toastMessage) {
      triggerToast(toastTitle, toastMessage, 'system');
    }
    return false;
  };

  const handleOpenChatWithStore = (
    storeName?: string,
    productContext?: ChatProductContext,
    targetSellerId?: string
  ) => {
    if (
      !requireAuth(
        { type: 'chat', storeName: storeName || '', productContext, sellerId: targetSellerId },
        'Masuk untuk Chat Penjual',
        'Silakan masuk akun terlebih dahulu untuk menghubungi penjual.'
      )
    ) {
      return;
    }

    if (productContext) {
      const targetProd = products.find(p => p.id === productContext.id);
      if (
        (targetProd && isProductOwnedByUser(targetProd, userProfile)) ||
        isStoreOwnedByUser(productContext.brand, productContext.sellerId, userProfile)
      ) {
        triggerToast('Listing Milik Anda', 'Anda tidak dapat mengirim pesan ke listing milik Anda sendiri.', 'system');
        return;
      }
    } else if (storeName && isStoreOwnedByUser(storeName, targetSellerId, userProfile)) {
      triggerToast('Toko Milik Anda', 'Anda sedang melihat etalase toko Anda sendiri.', 'system');
      return;
    }

    setChatStoreName(storeName || '');
    setChatProductContext(productContext || null);
    setIsChatOpen(true);
  };

  // Real-time Toast State
  const [activeToast, setActiveToast] = useState<{
    id: string;
    title: string;
    message: string;
    type: 'order' | 'low_stock' | 'social_sync' | 'system' | 'chat';
  } | null>(null);

  // Sync products to localStorage and listen to real-time Firestore catalog updates
  useEffect(() => {
    try {
      localStorage.setItem('nura_products', JSON.stringify(products));
    } catch {}
  }, [products]);

  // Sync reviews to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('nura_reviews', JSON.stringify(reviews));
    } catch {}
  }, [reviews]);

  // Real-time Cloud Firestore subscription for active seller catalogs & reviews
  useEffect(() => {
    const unsubProducts = subscribeToLiveProducts((liveList) => {
      setProducts(liveList);
    });
    const unsubReviews = subscribeToLiveReviews((liveReviews) => {
      setReviews(liveReviews);
    });
    const unsubUsers = subscribeToAllUsers((liveUsers) => {
      setAllUsersList(liveUsers);
    });
    return () => {
      unsubProducts();
      unsubReviews();
      unsubUsers();
    };
  }, []);

  // Enforce blocked/banned user restriction in real time
  useEffect(() => {
    if (!currentUserAccount?.id) return;
    const unsubscribe = subscribeToCurrentUserAccount(currentUserAccount.id, (remoteAccount) => {
      if (!remoteAccount) return;
      if (remoteAccount.accountStatus === 'blocked' || remoteAccount.accountStatus === 'banned') {
        const prefix =
          remoteAccount.accountStatus === 'banned'
            ? 'Akun Anda telah dibanned permanen oleh admin.'
            : 'Akun Anda diblokir oleh admin.';
        const reason = remoteAccount.statusReason ? ` (${remoteAccount.statusReason})` : '';
        handleLogout();
        triggerToast('Akses Akun Dibatasi', `${prefix}${reason}`, 'system', false);
        return;
      }
      setCurrentUserAccountState(remoteAccount);
      setCurrentUserAccount(remoteAccount);
      setUserProfile(userAccountToProfile(remoteAccount));
    });
    return () => unsubscribe();
  }, [currentUserAccount?.id]);

  // Live User Presence heartbeat & tab lifecycle
  useEffect(() => {
    const uid = userProfile.isRegistered ? userProfile.id : undefined;
    if (!uid) return;
    void updateUserPresence(uid, true);

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void updateUserPresence(uid, true);
      }
    }, 60_000);

    const handleFocus = () => void updateUserPresence(uid, true);
    const handleVisibility = () => {
      void updateUserPresence(uid, document.visibilityState === 'visible');
    };
    const handleOffline = () => {
      void updateUserPresence(uid, false);
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handleOffline);
    window.addEventListener('beforeunload', handleOffline);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handleOffline);
      window.removeEventListener('beforeunload', handleOffline);
    };
  }, [userProfile.isRegistered, userProfile.id]);

  // Subscribe to Superadmin logs, reports & live presences only when admin session is active
  useEffect(() => {
    if (!adminSession) return;
    const unsubLogs = subscribeToLoginLogs(setLoginLogs);
    const unsubReports = subscribeToUserReports(setUserReports);
    const unsubPres = subscribeToAllPresences(setPresenceMap);
    return () => {
      unsubLogs();
      unsubReports();
      unsubPres();
    };
  }, [adminSession]);

  // Real-time conversation & unread chat count listener
  useEffect(() => {
    if (!userProfile.isRegistered) {
      setUnreadChatCount(0);
      setLiveConversations([]);
      return;
    }

    const computeTotalUnread = (convs: typeof INITIAL_CHAT_CONVERSATIONS) => {
      const localMsgs = getLocalMessagesMap();
      return convs.reduce((sum, conv) => {
        const baseUnread = getUnreadCountForUser(conv, userProfile);
        const role = getRoleInConversation(conv, userProfile);
        const msgs = localMsgs[conv.id];
        if (!msgs || msgs.length === 0) return sum + baseUnread;
        const unreadIncoming = msgs.filter((m) => {
          const isOwn =
            m.senderId && userProfile.id
              ? m.senderId === userProfile.id
              : role === 'seller'
                ? m.sender === 'store'
                : m.sender === 'user';
          return !isOwn && m.isRead !== true;
        }).length;
        return sum + Math.max(baseUnread, unreadIncoming);
      }, 0);
    };

    const unsubscribe = subscribeToLiveConversations(userProfile, (convs) => {
      let merged = convs;
      if (userProfile.id === 'usr-buyer-001') {
        const existingIds = new Set(convs.map((c) => c.id));
        const hiddenIds = new Set<string>();
        convs.forEach((c) => {
          if (Array.isArray(c.hiddenBy) && c.hiddenBy.includes('usr-buyer-001')) {
            hiddenIds.add(c.id);
          }
        });
        const demoSeed = INITIAL_CHAT_CONVERSATIONS.map((c) => ({
          ...c,
          buyerId: 'usr-buyer-001',
          buyerName: 'Anindya Putri',
          buyerUnreadCount: c.unreadCount,
          sellerUnreadCount: 0,
        }));
        merged = [
          ...convs,
          ...demoSeed.filter((c) => !existingIds.has(c.id) && !hiddenIds.has(c.id)),
        ];
      }
      setLiveConversations(merged);
      if (!isChatOpenRef.current) {
        setUnreadChatCount(computeTotalUnread(merged));
      }
    });

    return () => unsubscribe();
  }, [userProfile]);

  // Real-time Cloud Firestore subscriptions for cross-user orders & notifications
  useEffect(() => {
    const unsubOrders = subscribeToLiveOrders((liveOrders) => {
      setAllLiveOrders(liveOrders);
    });
    const unsubNotifs = subscribeToLiveNotifications((liveNotifs) => {
      setAllLiveNotifications(liveNotifs);
    });
    return () => {
      unsubOrders();
      unsubNotifs();
    };
  }, []);

  // Handle successful unified account auth/registration
  const handleAuthSuccess = (account: UserAccount) => {
    setCurrentUserAccountState(account);
    setCurrentUserAccount(account);
    const profile = userAccountToProfile(account);
    setUserProfile(profile);
    setSessionNotifications([]);

    let nextWishlist = loadAccountWishlist(account.id);
    let skippedOwnWishlist = false;
    if (pendingAuthIntent?.type === 'wishlist') {
      if (isProductOwnedByUser(pendingAuthIntent.product, profile)) {
        skippedOwnWishlist = true;
      } else {
        const pid = pendingAuthIntent.product.id;
        if (!nextWishlist.includes(pid)) {
          nextWishlist = [...nextWishlist, pid];
          const currentLikes = Math.max(0, Number(pendingAuthIntent.product.likesCount) || 0);
          const nextLikes = currentLikes + 1;
          setProducts(prev =>
            prev.map(p => (p.id === pid ? { ...p, likesCount: nextLikes } : p))
          );
          void updateProductListingInFirestore(pid, { likesCount: nextLikes });
        }
      }
    }
    setWishlistIds(nextWishlist);

    let nextFollowing = loadFollowingStores(account.id);
    const intent = pendingAuthIntent;
    if (intent?.type === 'follow') {
      const targetKey = getStoreUniqueKey(intent.brandName, intent.sellerId);
      const isSelf = isStoreOwnedByUser(intent.brandName, intent.sellerId, profile);
      if (targetKey && !isSelf && !isStoreFollowed(nextFollowing, intent.brandName, intent.sellerId)) {
        nextFollowing = [...nextFollowing, targetKey];
        setFollowerDeltas(updateFollowerDelta(intent.brandName, 1, intent.sellerId));
      }
    }
    setFollowingStores(nextFollowing);

    const accountRecent = loadRecentlyViewedIds(account.id);
    const mergedRecent = Array.from(new Set([...recentlyViewedIds, ...accountRecent])).slice(0, 12);
    setRecentlyViewedIds(mergedRecent);

    setIsUserAuthOpen(false);
    setPendingAuthIntent(null);

    if (intent?.type === 'sell') {
      setSelectedStoreTarget(null);
      setActiveMode('seller');
      setActiveSellerTab('sell');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      triggerToast(
        'Siap Berjualan di AROOS',
        `Halo ${account.name}, Anda kini dapat langsung menambah dan mengelola listing.`,
        'system'
      );
    } else if (intent?.type === 'wishlist') {
      if (skippedOwnWishlist) {
        triggerToast('Listing Milik Anda', 'Anda tidak dapat menyimpan listing milik Anda sendiri ke Wishlist.', 'system');
      } else {
        triggerToast(
          'Disimpan ke Wishlist',
          `${intent.product.name} berhasil ditambahkan ke Wishlist Anda.`,
          'system'
        );
      }
    } else if (intent?.type === 'follow') {
      if (isStoreOwnedByUser(intent.brandName, intent.sellerId, profile)) {
        triggerToast('Lapak Milik Anda', 'Anda tidak dapat mengikuti lapak milik Anda sendiri.', 'system');
      } else {
        triggerToast('Berhasil Mengikuti', `Anda kini mengikuti ${intent.brandName}.`, 'system');
      }
    } else if (intent?.type === 'chat') {
      const targetProd = intent.productContext
        ? products.find(p => p.id === intent.productContext?.id)
        : null;
      const isOwn =
        (targetProd && isProductOwnedByUser(targetProd, profile)) ||
        isStoreOwnedByUser(
          intent.storeName,
          intent.productContext?.sellerId || intent.sellerId,
          profile
        );
      if (isOwn) {
        triggerToast('Listing Milik Anda', 'Anda tidak dapat mengirim pesan ke listing milik Anda sendiri.', 'system');
      } else {
        setChatStoreName(intent.storeName);
        setChatProductContext(intent.productContext || null);
        setIsChatOpen(true);
      }
    } else if (intent?.type === 'review') {
      if (isProductOwnedByUser(intent.product, profile)) {
        triggerToast('Listing Milik Anda', 'Anda tidak dapat menulis ulasan pada produk Anda sendiri.', 'system');
      } else {
        handleSelectProduct(intent.product);
        triggerToast('Akun Aktif', `Halo ${account.name}, silakan tulis ulasan Anda untuk ${intent.product.name}.`, 'system');
      }
    } else if (intent?.type === 'store_review') {
      if (intent.storeTarget) {
        setSelectedStoreTarget(intent.storeTarget);
        setActiveMode('profile');
      }
      triggerToast('Akun Aktif', `Halo ${account.name}, silakan tulis ulasan & foto untuk toko ini.`, 'system');
    } else {
      triggerToast(
        'Selamat Datang di AROOS',
        `Akun ${account.name} aktif untuk belanja dan berjualan.`,
        'system'
      );
    }
  };

  const handleLogout = () => {
    if (currentUserAccount?.id) {
      void updateUserPresence(currentUserAccount.id, false);
    }
    setCurrentUserAccountState(null);
    setCurrentUserAccount(null);
    const profile = userAccountToProfile(null);
    setUserProfile(profile);
    setSelectedStoreTarget(null);
    setActiveMode('shopper');
    setPendingAuthIntent(null);
    setIsWishlistOnly(false);
    setIsFollowingOnly(false);
    setWishlistIds([]);
    setFollowingStores([]);
    setRecentlyViewedIds(loadRecentlyViewedIds(null));
    setSessionNotifications([]);
    setLiveConversations([]);
    setUnreadChatCount(0);
    setIsOrdersOpen(false);
    setIsChatOpen(false);
    setIsProfileSettingsOpen(false);
    setIsSellerDirectoryOpen(false);
    setFollowersModal(null);
    setPostOrderReviewTarget(null);
    setReportTarget(null);
    syncUrlParams({ toko: null, sid: null });
    triggerToast('Sudah Keluar', 'Anda telah keluar dari akun.', 'system', false);
  };

  // Toast Dispatcher Helper
  const triggerToast = (
    title: string, 
    message: string, 
    type: 'order' | 'low_stock' | 'social_sync' | 'system' | 'chat' = 'system',
    persistInBell: boolean = true
  ) => {
    if ((type === 'low_stock' || type === 'social_sync') && !userProfile.isRegistered) {
      return;
    }

    const nowIso = new Date().toISOString();
    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      message,
      type,
      time: 'Baru saja',
      read: false,
      createdAtIso: nowIso,
    };
    if (persistInBell && userProfile.isRegistered) {
      setSessionNotifications(prev => [newNotif, ...prev]);
    }
    setActiveToast({ id: newNotif.id, title, message, type });

    setTimeout(() => {
      setActiveToast(current => current?.id === newNotif.id ? null : current);
    }, 4500);
  };

  const markNotificationAsRead = (id: string) => {
    setReadNotificationIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [id, ...prev].slice(0, 250);
      try {
        localStorage.setItem('aroos_read_notifications_v1', JSON.stringify(next));
      } catch {}
      return next;
    });
    setSessionNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setAllLiveNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    if (allLiveNotifications.some((n) => n.id === id)) {
      void markNotificationReadInFirestore(id);
    }
  };

  const markAllNotificationsAsRead = () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    const unreadSet = new Set(unreadIds);
    setReadNotificationIds((prev) => {
      const next = Array.from(new Set([...unreadIds, ...prev])).slice(0, 250);
      try {
        localStorage.setItem('aroos_read_notifications_v1', JSON.stringify(next));
      } catch {}
      return next;
    });
    setSessionNotifications((prev) =>
      prev.map((n) => (unreadSet.has(n.id) ? { ...n, read: true } : n))
    );
    setAllLiveNotifications((prev) =>
      prev.map((n) => (unreadSet.has(n.id) ? { ...n, read: true } : n))
    );
    allLiveNotifications.forEach((n) => {
      if (unreadSet.has(n.id)) {
        void markNotificationReadInFirestore(n.id);
      }
    });
  };

  const handleNavigateNotification = (notification: NotificationItem) => {
    markNotificationAsRead(notification.id);

    if (notification.type === 'chat') {
      setIsOrdersOpen(false);
      setIsChatOpen(true);
      return;
    }

    if (notification.targetRole === 'buyer') {
      setActiveMode('shopper');
      setIsOrdersOpen(true);
      return;
    }

    setActiveMode('seller');

    const titleLower = notification.title.toLowerCase();
    if (notification.type === 'low_stock' || titleLower.includes('stok')) {
      setActiveSellerTab('listings');
    } else if (notification.type === 'order' || titleLower.includes('pesanan') || titleLower.includes('deal')) {
      setActiveSellerTab('orders');
    } else if (titleLower.includes('profil')) {
      setIsProfileSettingsOpen(true);
    } else {
      setActiveSellerTab('listings');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleWishlist = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isProductOwnedByUser(product, userProfile)) {
      triggerToast('Listing Milik Anda', 'Anda tidak dapat menyimpan listing milik Anda sendiri ke Wishlist.', 'system');
      return;
    }
    if (
      !requireAuth(
        { type: 'wishlist', product },
        'Masuk untuk Simpan Wishlist',
        `Masuk akun terlebih dahulu untuk menyimpan ${product.name} ke Wishlist.`
      )
    ) {
      return;
    }

    const isSaved = wishlistIds.includes(product.id);
    const delta: 1 | -1 = isSaved ? -1 : 1;
    const currentLikes = Math.max(0, Number(product.likesCount) || 0);
    const optimisticLikes = Math.max(0, currentLikes + delta);

    if (isSaved) {
      setWishlistIds(prev => prev.filter(id => id !== product.id));
    } else {
      setWishlistIds(prev => [...prev, product.id]);
    }

    setProducts(prev =>
      prev.map(p => (p.id === product.id ? { ...p, likesCount: optimisticLikes } : p))
    );
    void toggleProductLikesTransaction(product.id, delta, currentLikes).then((serverLikes) => {
      setProducts(prev =>
        prev.map(p => (p.id === product.id ? { ...p, likesCount: serverLikes } : p))
      );
    });
  };

  // Save/update user shipping address from Profile or Chat "Alamat Saya"
  const handleUpdateUserAddress = async (payload: {
    name: string;
    phone: string;
    city: string;
    address: string;
    postalCode?: string;
  }) => {
    if (!currentUserAccount) return;
    const updatedAccount: UserAccount = {
      ...currentUserAccount,
      name: payload.name || currentUserAccount.name,
      phone: payload.phone || currentUserAccount.phone,
      buyerProfile: {
        ...(currentUserAccount.buyerProfile || {}),
        city: payload.city,
        address: payload.address,
        postalCode: payload.postalCode || '',
      },
    };
    setCurrentUserAccountState(updatedAccount);
    setCurrentUserAccount(updatedAccount);
    setUserProfile(userAccountToProfile(updatedAccount));
    await saveUserToFirestore(updatedAccount);
    triggerToast('Alamat Tersimpan', 'Alamat lengkap Anda telah disimpan ke profil.', 'system', false);
    return updatedAccount;
  };

  // Direct Chat Deal Recording (No Payment Gateway, No Escrow)
  const handleCreateChatDeal = async (deal: {
    productId: string;
    sellerId?: string;
    buyerId?: string;
    buyerEmail?: string;
    storeName: string;
    price: number;
    paymentMethod: 'cod' | 'transfer_langsung';
    courier: string;
    buyerName: string;
    buyerPhone: string;
    buyerCity: string;
    buyerAddress: string;
    convId: string;
  }): Promise<string | void> => {
    const prod = products.find(p => p.id === deal.productId);
    if (!prod || prod.listingStatus === 'sold' || prod.stock <= 0) {
      triggerToast('Item Tidak Tersedia', 'Produk ini sudah terjual atau stok kosong.', 'system');
      return;
    }

    const sellerInfo = await resolveSellerIdentity(prod);
    const resolvedSellerId = deal.sellerId || sellerInfo.sellerId;
    const resolvedBrand = (prod.sellerBrandName || prod.brand || deal.storeName).slice(0, 100);
    const isSellerInitiating = isProductOwnedByUser(prod, userProfile);

    let resolvedBuyerId = isSellerInitiating ? deal.buyerId : userProfile.id;
    let resolvedBuyerEmail = isSellerInitiating ? deal.buyerEmail : userProfile.email;

    if (isSellerInitiating) {
      const buyerInfo = await resolveBuyerIdentity({
        buyerId: deal.buyerId,
        buyerName: deal.buyerName,
        buyerPhone: deal.buyerPhone,
        convId: deal.convId,
      });
      resolvedBuyerId = resolvedBuyerId || buyerInfo.buyerId;
      resolvedBuyerEmail = resolvedBuyerEmail || buyerInfo.buyerEmail;
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const orderNumber = `ARS-${now.toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
    const orderId = `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const safeBuyerName = deal.buyerName.trim().slice(0, 100);
    const safeBuyerPhone = deal.buyerPhone.trim().slice(0, 30);
    const safeBuyerCity = deal.buyerCity.trim().slice(0, 80);
    const safeBuyerAddress = deal.buyerAddress.trim().slice(0, 400);

    const newOrder: Order = {
      id: orderId,
      orderNumber,
      buyerId: resolvedBuyerId ? resolvedBuyerId.slice(0, 128) : undefined,
      buyerName: safeBuyerName,
      buyerEmail: resolvedBuyerEmail ? resolvedBuyerEmail.slice(0, 120) : undefined,
      sellerId: resolvedSellerId ? resolvedSellerId.slice(0, 128) : undefined,
      sellerBrandName: resolvedBrand,
      customerName: safeBuyerName,
      customerPhone: safeBuyerPhone,
      customerCity: safeBuyerCity,
      customerAddress: safeBuyerAddress,
      items: [
        {
          productId: prod.id,
          productName: prod.name,
          brand: resolvedBrand,
          sellerId: resolvedSellerId,
          sellerBrandName: resolvedBrand,
          price: deal.price,
          quantity: 1,
          size: prod.sizes[0] || 'Standar',
          color: prod.colors[0] || 'Default',
          image: prod.image,
        },
      ],
      totalAmount: deal.price,
      shippingFee: 0,
      courier: deal.courier.slice(0, 100),
      paymentMethod: deal.paymentMethod,
      paymentStatus: deal.paymentMethod === 'transfer_langsung' ? 'paid' : 'pending',
      orderStatus: 'diproses',
      negotiatedFromOffer: deal.price !== prod.price,
      trackingNumber: '',
      createdAt: `${now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}, ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`,
      createdAtIso: nowIso,
    };

    try {
      const txResult = await createOrderAndDecrementStockTransaction(newOrder, prod.id, 1);
      setAllLiveOrders(getLocalSharedOrders());

      const nextStock = txResult.nextStock ?? Math.max(0, prod.stock - 1);
      const nextStatus: 'available' | 'reserved' | 'sold' =
        txResult.nextStatus ?? (nextStock === 0 ? 'sold' : prod.listingStatus || 'available');
      setProducts(prev =>
        prev.map(p =>
          p.id === prod.id
            ? {
                ...p,
                stock: nextStock,
                listingStatus: nextStatus,
                ...(nextStock === 0 ? { reservedByUserId: '', reservedByUserName: '' } : {}),
              }
            : p
        )
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mencatat deal transaksi.';
      triggerToast('Deal Gagal Dicatat', msg, 'system');
      return;
    }

    if (resolvedSellerId || resolvedBrand) {
      await createNotificationInFirestore({
        id: `notif-deal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'order',
        title: `Deal Baru Tercatat (#${orderNumber})`,
        message: `${safeBuyerName} sepakat membeli ${prod.name} seharga Rp ${deal.price.toLocaleString('id-ID')} (${deal.paymentMethod === 'cod' ? 'COD / Ketemuan' : 'Transfer Langsung'}).`,
        time: 'Baru saja',
        read: false,
        recipientUserId: resolvedSellerId,
        recipientBrandName: resolvedBrand,
        orderId: newOrder.id,
        targetRole: 'seller',
        createdAtIso: nowIso,
      });
    }

    if (resolvedBuyerId) {
      await createNotificationInFirestore({
        id: `notif-dealb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'order',
        title: `Deal Tercatat (#${orderNumber})`,
        message: `Kesepakatan dengan ${resolvedBrand} untuk ${prod.name} telah dicatat. Pantau resi pengiriman di Pesanan Saya.`,
        time: 'Baru saja',
        read: false,
        recipientUserId: resolvedBuyerId,
        orderId: newOrder.id,
        targetRole: 'buyer',
        createdAtIso: nowIso,
      });
    }

    triggerToast(
      'Deal Berhasil Dicatat',
      `Transaksi #${orderNumber} (Rp ${deal.price.toLocaleString('id-ID')}) telah disimpan tanpa biaya payment gateway.`,
      'order',
      false
    );

    return orderNumber;
  };

  const handleNotifyFromChat = (notif: Omit<NotificationItem, 'id' | 'time' | 'read'>) => {
    void createNotificationInFirestore({
      ...notif,
      id: `notif-chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      time: 'Baru saja',
      read: false,
      createdAtIso: notif.createdAtIso || new Date().toISOString(),
    });
  };

  // Buyer Confirm Received (Direct Deal Completion) -> Trigger Post-Order Review Popup
  const handleConfirmOrderReceived = async (orderId: string) => {
    const target = buyerOrders.find(o => o.id === orderId) || allLiveOrders.find(o => o.id === orderId);
    await updateOrderInFirestore(orderId, {
      orderStatus: 'selesai',
      paymentStatus: 'paid',
      buyerConfirmedAt: 'Baru saja',
    });

    if (target && (target.sellerId || target.sellerBrandName)) {
      await createNotificationInFirestore({
        id: `notif-done-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'order',
        title: `Transaksi Selesai (#${target.orderNumber})`,
        message: `${target.customerName} mengonfirmasi barang telah diterima dengan baik.`,
        time: 'Baru saja',
        read: false,
        recipientUserId: target.sellerId,
        recipientBrandName: target.sellerBrandName,
        orderId: target.id,
        targetRole: 'seller',
        createdAtIso: new Date().toISOString(),
      });
    }

    triggerToast(
      'Barang Diterima · Selesai',
      `Transaksi #${target?.orderNumber || orderId} telah ditandai selesai.`,
      'order',
      false
    );

    if (target && target.items && target.items.length > 0) {
      setIsOrdersOpen(false);
      setPostOrderReviewTarget({
        ...target,
        orderStatus: 'selesai',
        paymentStatus: 'paid',
      });
    }
  };

  // Seller Order Fulfillment (Input Resi, Courier, Mark Shipped & Notify Buyer)
  const handleSellerUpdateOrder = async (
    orderId: string,
    newStatus: OrderStatus,
    trackingNumber?: string,
    courier?: string
  ) => {
    const target = sellerIncomingOrders.find(o => o.id === orderId) || allLiveOrders.find(o => o.id === orderId);
    const nextTracking = trackingNumber ?? target?.trackingNumber;
    const nextCourier = courier !== undefined ? courier : target?.courier;

    await updateOrderInFirestore(orderId, {
      orderStatus: newStatus,
      trackingNumber: nextTracking,
      courier: nextCourier,
    });
    setAllLiveOrders(getLocalSharedOrders());

    if (target?.buyerId) {
      await createNotificationInFirestore({
        id: `notif-ship-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'order',
        title: `Pesanan Dikirim (#${target.orderNumber})`,
        message: `${target.sellerBrandName || 'Penjual'} telah mengirim paket Anda${nextCourier ? ` via ${nextCourier}` : ''}${nextTracking ? ` (Resi: ${nextTracking})` : ''}.`,
        time: 'Baru saja',
        read: false,
        recipientUserId: target.buyerId,
        orderId: target.id,
        targetRole: 'buyer',
        createdAtIso: new Date().toISOString(),
      });
    }

    triggerToast(
      'Status Pengiriman Diperbarui',
      `Pesanan #${target?.orderNumber || orderId} kini berstatus Dikirim${nextCourier ? ` via ${nextCourier}` : ''}${nextTracking ? ` (Resi: ${nextTracking})` : ''}.`,
      'order',
      false
    );
  };

  // Manual Non-COD Seller Order + Resi Input
  const handleCreateManualSellerOrder = async (payload: {
    productId: string;
    productName: string;
    productImage: string;
    productPrice: number;
    quantity: number;
    size: string;
    color: string;
    buyerId?: string;
    buyerName: string;
    buyerPhone: string;
    buyerCity: string;
    buyerAddress: string;
    courier: string;
    trackingNumber: string;
    shippingFee: number;
    paymentMethod: Exclude<PaymentMethod, 'cod' | 'chat_direct'>;
    paymentStatus: 'paid' | 'pending';
  }): Promise<string | void> => {
    if ((payload.paymentMethod as string) === 'cod') {
      triggerToast('Metode Tidak Diizinkan', 'Input pesanan manual hanya mendukung metode non-COD.', 'system');
      return;
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const orderNumber = `ARS-${now.toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
    const orderId = `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const resolvedBrand = (userProfile.brandName || userProfile.name || 'Lapak AROOS').trim().slice(0, 100);
    const resolvedSellerId = userProfile.id ? userProfile.id.slice(0, 128) : undefined;

    const buyerInfo = await resolveBuyerIdentity({
      buyerId: payload.buyerId,
      buyerName: payload.buyerName,
      buyerPhone: payload.buyerPhone,
    });

    const resolvedBuyerId = payload.buyerId || buyerInfo.buyerId;
    const safeBuyerName = payload.buyerName.trim().slice(0, 100);
    const safeBuyerPhone = payload.buyerPhone.trim().slice(0, 30);
    const safeBuyerCity = payload.buyerCity.trim().slice(0, 80);
    const safeBuyerAddress = payload.buyerAddress.trim().slice(0, 400);
    const safeCourier = payload.courier.trim().slice(0, 100);
    const safeTracking = payload.trackingNumber.trim().slice(0, 100);
    const qty = Math.max(1, Number(payload.quantity) || 1);
    const unitPrice = Math.max(0, Number(payload.productPrice) || 0);
    const fee = Math.max(0, Number(payload.shippingFee) || 0);

    const newOrder: Order = {
      id: orderId,
      orderNumber,
      buyerId: resolvedBuyerId ? resolvedBuyerId.slice(0, 128) : undefined,
      buyerName: safeBuyerName,
      buyerEmail: buyerInfo.buyerEmail ? buyerInfo.buyerEmail.slice(0, 120) : undefined,
      sellerId: resolvedSellerId,
      sellerBrandName: resolvedBrand,
      customerName: safeBuyerName,
      customerPhone: safeBuyerPhone,
      customerCity: safeBuyerCity,
      customerAddress: safeBuyerAddress,
      items: [
        {
          productId: payload.productId || `manual-${Date.now()}`,
          productName: payload.productName.trim().slice(0, 140),
          brand: resolvedBrand,
          sellerId: resolvedSellerId,
          sellerBrandName: resolvedBrand,
          price: unitPrice,
          quantity: qty,
          size: payload.size || 'Standar',
          color: payload.color || 'Default',
          image: payload.productImage || '',
        },
      ],
      totalAmount: unitPrice * qty + fee,
      shippingFee: fee,
      courier: safeCourier,
      paymentMethod: payload.paymentMethod,
      paymentStatus: payload.paymentStatus,
      orderStatus: safeTracking ? 'dikirim' : 'diproses',
      trackingNumber: safeTracking,
      createdAt: `${now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}, ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`,
      createdAtIso: nowIso,
    };

    const prod = payload.productId ? products.find(p => p.id === payload.productId) : undefined;
    try {
      const txResult = await createOrderAndDecrementStockTransaction(newOrder, prod?.id, qty);
      setAllLiveOrders(getLocalSharedOrders());

      if (prod) {
        const nextStock = txResult.nextStock ?? Math.max(0, prod.stock - qty);
        const nextStatus: 'available' | 'reserved' | 'sold' =
          txResult.nextStatus ?? (nextStock === 0 ? 'sold' : prod.listingStatus || 'available');
        const stockUpdates: Partial<Product> =
          nextStock === 0
            ? { stock: 0, listingStatus: 'sold', reservedByUserId: '', reservedByUserName: '' }
            : { stock: nextStock, listingStatus: nextStatus };
        setProducts(prev => prev.map(p => (p.id === prod.id ? { ...p, ...stockUpdates } : p)));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan pesanan.';
      triggerToast('Pesanan Gagal Disimpan', msg, 'system');
      return;
    }

    if (resolvedBuyerId) {
      await createNotificationInFirestore({
        id: `notif-manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'order',
        title: `Pesanan Baru (#${orderNumber})`,
        message: `${resolvedBrand} mencatat pesanan ${payload.productName} via ${safeCourier}${safeTracking ? ` (Resi: ${safeTracking})` : ''}.`,
        time: 'Baru saja',
        read: false,
        recipientUserId: resolvedBuyerId,
        orderId: newOrder.id,
        targetRole: 'buyer',
        createdAtIso: nowIso,
      });
    }

    triggerToast(
      'Pesanan Manual Disimpan',
      `Pesanan #${orderNumber} (${safeCourier}${safeTracking ? ` · ${safeTracking}` : ''}) berhasil ditambahkan.`,
      'order',
      false
    );

    return orderNumber;
  };

  // Listing Controls (Synced to Cloud Firestore & Local)
  const handleUpdateProductListing = (productId: string, updates: Partial<Product>) => {
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, ...updates } : p));
    updateProductListingInFirestore(productId, updates);
  };

  const handleReserveProduct = (
    productId: string,
    buyer?: { id?: string; name: string }
  ) => {
    const reservedName = (buyer?.name || '').trim().slice(0, 100);
    const reservedId = (buyer?.id || '').trim().slice(0, 128);
    handleUpdateProductListing(productId, {
      listingStatus: 'reserved',
      reservedByUserId: reservedId,
      reservedByUserName: reservedName,
    });

    if (reservedId && reservedId !== userProfile.id) {
      const targetProd = products.find((p) => p.id === productId);
      void createNotificationInFirestore({
        id: `notif-rsv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'order',
        title: 'Produk Di-reserve Untuk Anda',
        message: `${userProfile.brandName || userProfile.name || 'Penjual'} menandai "${targetProd?.name || 'Produk'}" sebagai Reserved untuk Anda.`,
        time: 'Baru saja',
        read: false,
        recipientUserId: reservedId,
        targetRole: 'buyer',
        createdAtIso: new Date().toISOString(),
      });
    }

    triggerToast(
      'Item Ditandai Reserved',
      reservedName
        ? `Produk diperbarui menjadi Reserved khusus untuk ${reservedName}.`
        : 'Status produk diperbarui menjadi Reserved.',
      'system'
    );
  };

  const handleUnreserveProduct = (productId: string) => {
    handleUpdateProductListing(productId, {
      listingStatus: 'available',
      reservedByUserId: '',
      reservedByUserName: '',
    });
    triggerToast(
      'Status Reserved Dilepas',
      'Produk kini kembali berstatus Tersedia (Available) di katalog.',
      'system'
    );
  };

  const syncUrlParams = (updates: {
    item?: string | null;
    toko?: string | null;
    sid?: string | null;
  }) => {
    try {
      const url = new URL(window.location.href);
      if ('item' in updates) {
        if (updates.item) url.searchParams.set('item', updates.item);
        else url.searchParams.delete('item');
      }
      if ('toko' in updates) {
        if (updates.toko) url.searchParams.set('toko', updates.toko);
        else url.searchParams.delete('toko');
      }
      if ('sid' in updates) {
        if (updates.sid) url.searchParams.set('sid', updates.sid);
        else url.searchParams.delete('sid');
      }
      window.history.replaceState({}, '', url.toString());
    } catch {}
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setRecentlyViewedIds((prev) => pushRecentlyViewedId(prev, product.id));
    syncUrlParams({ item: product.id, toko: null, sid: null });
  };

  const handleCloseProductDetail = () => {
    setSelectedProduct(null);
    syncUrlParams({ item: null });
  };

  const handleOpenStorefront = (brandName: string, sellerId?: string) => {
    let resolvedSellerId = (sellerId || '').trim() || undefined;
    if (!resolvedSellerId) {
      const targetKey = normalizeStoreKey(brandName);
      const matches = sellerDirectory.filter((s) => normalizeStoreKey(s.brandName) === targetKey);
      if (matches.length === 1 && matches[0].sellerId) {
        resolvedSellerId = matches[0].sellerId;
      }
    }

    setSelectedProduct(null);
    setIsSellerDirectoryOpen(false);
    setFollowersModal(null);
    setIsOrdersOpen(false);
    setIsChatOpen(false);
    setSelectedStoreTarget({ brandName, sellerId: resolvedSellerId });
    setActiveMode('profile');
    syncUrlParams({ toko: brandName, sid: resolvedSellerId || null, item: null });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleFollowStore = (brandName: string, sellerId?: string) => {
    if (
      !requireAuth(
        { type: 'follow', brandName, sellerId },
        'Masuk untuk Ikuti Lapak',
        `Masuk akun terlebih dahulu untuk mengikuti ${brandName}.`
      )
    ) {
      return;
    }

    if (isStoreOwnedByUser(brandName, sellerId, userProfile)) {
      triggerToast('Lapak Milik Anda', 'Anda tidak dapat mengikuti lapak milik Anda sendiri.', 'system');
      return;
    }

    const storeKey = getStoreUniqueKey(brandName, sellerId);
    const isFollowed = isStoreFollowed(followingStores, brandName, sellerId);
    if (isFollowed) {
      const nameKey = normalizeStoreKey(brandName);
      setFollowingStores((prev) =>
        prev.filter((k) => k !== storeKey && (sellerId ? true : k !== nameKey))
      );
      setFollowerDeltas(updateFollowerDelta(brandName, -1, sellerId));
      triggerToast('Berhenti Mengikuti', `Anda berhenti mengikuti ${brandName}.`, 'system');
    } else {
      setFollowingStores((prev) => [...prev, storeKey]);
      setFollowerDeltas(updateFollowerDelta(brandName, 1, sellerId));
      triggerToast('Berhasil Mengikuti', `Anda kini mengikuti ${brandName}.`, 'system');
    }
  };

  useEffect(() => {
    if (handledDeepLinkRef.current || products.length === 0) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const itemId = params.get('item');
      const tokoParam = params.get('toko');
      const sidParam = params.get('sid') || undefined;

      if (itemId) {
        const found = products.find(
          (p) => p.id === itemId && (p.isActive !== false || isProductOwnedByUser(p, userProfile))
        );
        if (found) {
          handledDeepLinkRef.current = true;
          setActiveMode('shopper');
          setSelectedProduct(found);
          setRecentlyViewedIds((prev) => pushRecentlyViewedId(prev, found.id));
        }
      } else if (tokoParam) {
        handledDeepLinkRef.current = true;
        setSelectedStoreTarget({ brandName: tokoParam, sellerId: sidParam });
        setActiveMode('profile');
      }
    } catch {}
  }, [products]);

  const handleAddProduct = (newProduct: Product) => {
    setProducts(prev => [newProduct, ...prev]);
    saveProductToFirestore(newProduct);

    if (newProduct.isActive !== false) {
      handleClearAiSearch();
      setCatalogSearch('');
      handleResetCatalogFilters();
      setIsWishlistOnly(false);
      setIsFollowingOnly(false);
      setSelectedStoreTarget(null);
      setActiveMode('shopper');
      handleSelectProduct(newProduct);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleToggleProductActive = (productId: string, newActiveState: boolean) => {
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, isActive: newActiveState } : p));
    toggleProductActiveStatus(productId, newActiveState);
  };

  const handleDeleteProduct = (productId: string) => {
    setProducts(prev => prev.filter(p => p.id !== productId));
    deleteProductFromFirestore(productId);
  };

  // Review System (Persisted to Cloud Firestore & Local Cache)
  const handleAddReview = (newReviewData: Omit<Review, 'id' | 'date' | 'helpfulCount'>) => {
    const fullReview: Review = {
      ...newReviewData,
      id: `rev-${Date.now()}`,
      date: 'Hari ini',
      helpfulCount: 1,
      createdAtIso: new Date().toISOString(),
    };
    setReviews(prev => [fullReview, ...prev]);
    void createReviewInFirestore(fullReview);
    triggerToast('Ulasan Terpublikasi', 'Terima kasih atas ulasan terverifikasi Anda untuk brand lokal.', 'system');
  };

  const AVAILABLE_CITIES = useMemo(() => {
    const cities = Array.from(new Set(products.map(p => p.brandCity).filter(Boolean)));
    return ['Semua Kota', ...cities];
  }, [products]);

  const availableFilterSizes = useMemo(
    () => getFilterSizeOptions(selectedCategory, products),
    [selectedCategory, products]
  );

  const handleChangeCategory = (nextCat: 'Semua' | Product['category']) => {
    setSelectedCategory(nextCat);
    setSelectedSubCategory('Semua');
    if (nextCat !== 'Semua') {
      const spec = getCategorySpec(nextCat);
      if (!spec.supportsSize) {
        setSelectedSizes([]);
      } else {
        const allowed = new Set(spec.sizePresets.map(s => s.toLowerCase()));
        setSelectedSizes(prev => prev.filter(s => allowed.has(s.toLowerCase())));
      }
      if (!spec.supportsGender) {
        setSelectedGender('Semua');
      }
    }
  };

  const handleToggleSize = (size: string) => {
    setSelectedSizes(prev =>
      prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
    );
  };

  const handleResetCatalogFilters = () => {
    setSelectedCategory('Semua');
    setSelectedSubCategory('Semua');
    setSelectedSizes([]);
    setSelectedGender('Semua');
    setMinPrice('');
    setMaxPrice('');
    setSelectedCondition('Semua');
    setSelectedCity('Semua Kota');
    setIsFollowingOnly(false);
    setSortBy('baru');
  };

  const getSimilarAvailableProductIds = (source: Product, catalog: Product[]): string[] => {
    const sourceTokens = new Set(
      `${source.name} ${source.subCategory || ''} ${source.material || ''} ${source.itemBrand || ''}`
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length >= 3)
    );
    const sourceColors = new Set((source.colors || []).map((c) => c.toLowerCase()));

    const scored = catalog
      .filter(
        (p) =>
          p.id !== source.id &&
          p.isActive !== false &&
          p.listingStatus !== 'sold' &&
          p.stock > 0
      )
      .map((p) => {
        let score = 0;
        if (p.category === source.category) score += 50;
        if (source.subCategory && p.subCategory === source.subCategory) score += 35;
        if ((p.gender || 'Unisex') === (source.gender || 'Unisex') || p.gender === 'Unisex') {
          score += 18;
        }
        if ((p.condition || 'Baru') === (source.condition || 'Baru')) score += 12;
        if (source.fit && p.fit === source.fit) score += 10;
        if ((p.colors || []).some((c) => sourceColors.has(c.toLowerCase()))) score += 12;
        if (source.price > 0 && p.price > 0) {
          const ratioDiff = Math.abs(p.price - source.price) / source.price;
          if (ratioDiff <= 0.45) score += 15;
          else if (ratioDiff <= 0.8) score += 6;
        }
        const candText = `${p.name} ${p.subCategory || ''} ${p.material || ''} ${p.itemBrand || ''}`.toLowerCase();
        sourceTokens.forEach((tok) => {
          if (candText.includes(tok)) score += 8;
        });
        return { id: p.id, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, 12).map((item) => item.id);
  };

  const handleRunAiSearch = async (
    overrideQuery?: string,
    options?: {
      excludeProductId?: string;
      onlyAvailable?: boolean;
      fallbackIds?: string[];
      fallbackSummary?: string;
    }
  ) => {
    const targetQuery = (overrideQuery ?? aiSearchQuery).trim();
    if (!targetQuery) return;

    aiSearchAbortRef.current?.abort();

    setIsAiSearching(true);
    setAiSearchError(null);
    setSelectedCategory('Semua');
    setSelectedSubCategory('Semua');
    setSelectedSizes([]);
    setSelectedGender('Semua');
    setMinPrice('');
    setMaxPrice('');
    setSelectedCondition('Semua');
    setSelectedCity('Semua Kota');
    setIsWishlistOnly(false);

    const activeProducts = products
      .filter((p) => {
        if (p.isActive === false) return false;
        if (options?.excludeProductId && p.id === options.excludeProductId) return false;
        if (options?.onlyAvailable && (p.listingStatus === 'sold' || p.stock <= 0)) return false;
        return true;
      })
      .map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.sellerBrandName || p.brand,
        itemBrand: p.itemBrand,
        brandCity: p.brandCity,
        category: p.category,
        subCategory: p.subCategory,
        gender: p.gender,
        fit: p.fit,
        price: p.price,
        stock: p.stock,
        sizes: p.sizes,
        colors: p.colors,
        material: p.material,
        condition: p.condition || 'Baru',
        listingStatus: p.listingStatus || 'available',
        allowMeetup: p.allowMeetup,
        meetupArea: p.meetupArea,
        description: (p.description || '').slice(0, 140),
      }));

    const availableIdSet = new Set(activeProducts.map((p) => p.id));

    const cacheKey = `${targetQuery.toLowerCase()}::${options?.excludeProductId || ''}::${options?.onlyAvailable ? '1' : '0'}::${activeProducts
      .map((p) => `${p.id}:${p.price}:${p.stock}:${p.listingStatus}`)
      .join('|')}`;
    const cachedResult = aiSearchCacheRef.current.get(cacheKey);
    if (cachedResult) {
      setAiSearchResult(cachedResult);
      setIsAiSearching(false);
      return;
    }

    const controller = new AbortController();
    aiSearchAbortRef.current = controller;
    let didTimeout = false;
    const timeoutId = window.setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, 28000);

    try {
      const res = await fetch('/api/ai-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          query: targetQuery,
          products: activeProducts,
        }),
        signal: controller.signal,
      });

      const rawText = await res.text();
      const contentType = res.headers.get('content-type') || '';
      const trimmedText = rawText.trimStart();

      let data: { summary?: string; matchedProductIds?: string[]; error?: string } | null = null;
      if (trimmedText && !trimmedText.startsWith('<')) {
        try {
          data = JSON.parse(rawText);
        } catch {
          data = null;
        }
      }

      if (!data) {
        if (res.status >= 500) {
          throw new Error(
            'Server pencarian AI sedang sibuk atau baru dimuat ulang. Silakan coba lagi beberapa detik lagi.'
          );
        }
        if (!contentType.includes('application/json') || trimmedText.startsWith('<')) {
          throw new Error(
            'Endpoint server pencarian AI belum merespons (mungkin sedang dimuat ulang atau dibuka dari pratinjau statis). Muat ulang halaman lalu coba lagi.'
          );
        }
        throw new Error('Format respons layanan pencarian AI tidak valid.');
      }

      if (!res.ok) {
        throw new Error(data.error || 'Terjadi kesalahan saat mencari dengan AI.');
      }

      let matchedIds = Array.isArray(data.matchedProductIds)
        ? data.matchedProductIds.filter((id) => availableIdSet.has(id))
        : [];
      let summary = data.summary || `Ditemukan hasil untuk "${targetQuery}".`;

      if (matchedIds.length === 0 && options?.fallbackIds && options.fallbackIds.length > 0) {
        matchedIds = options.fallbackIds;
        summary = options.fallbackSummary || summary;
      }

      const nextResult: AiSearchResult = {
        query: targetQuery,
        summary,
        matchedProductIds: matchedIds,
      };

      aiSearchCacheRef.current.set(cacheKey, nextResult);
      if (aiSearchCacheRef.current.size > 50) {
        const firstKey = aiSearchCacheRef.current.keys().next().value;
        if (firstKey) aiSearchCacheRef.current.delete(firstKey);
      }

      setAiSearchResult(nextResult);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError' && !didTimeout) {
        return;
      }
      if (options?.fallbackIds && options.fallbackIds.length > 0) {
        const fallbackResult: AiSearchResult = {
          query: targetQuery,
          summary:
            options.fallbackSummary ||
            `Menampilkan ${options.fallbackIds.length} alternatif tersedia yang serupa.`,
          matchedProductIds: options.fallbackIds,
        };
        setAiSearchError(null);
        setAiSearchResult(fallbackResult);
        return;
      }
      const msg = didTimeout
        ? 'Pencarian AI melebihi batas waktu respons. Silakan coba lagi.'
        : err instanceof Error
          ? err.message
          : 'Gagal menghubungi layanan pencarian AI.';
      setAiSearchError(msg);
      setAiSearchResult(null);
    } finally {
      window.clearTimeout(timeoutId);
      if (aiSearchAbortRef.current === controller) {
        aiSearchAbortRef.current = null;
        setIsAiSearching(false);
      }
    }
  };

  const handleFindSimilar = (sourceProduct: Product) => {
    const fallbackIds = getSimilarAvailableProductIds(sourceProduct, products);
    const descriptorParts = [
      sourceProduct.subCategory || sourceProduct.category,
      sourceProduct.gender && sourceProduct.gender !== 'Unisex' ? sourceProduct.gender : '',
      sourceProduct.fit || '',
      `sekitar Rp ${sourceProduct.price.toLocaleString('id-ID')}`,
    ].filter(Boolean);
    const similarQuery = `Alternatif tersedia mirip "${sourceProduct.name}" (${descriptorParts.join(', ')})`;

    setSelectedProduct(null);
    setSelectedStoreTarget(null);
    syncUrlParams({ item: null, toko: null, sid: null });
    setActiveMode('shopper');
    setCatalogSearch('');
    setAiSearchQuery(similarQuery);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    void handleRunAiSearch(similarQuery, {
      excludeProductId: sourceProduct.id,
      onlyAvailable: true,
      fallbackIds,
      fallbackSummary:
        fallbackIds.length > 0
          ? `Menampilkan ${fallbackIds.length} item tersedia yang serupa dengan "${sourceProduct.name}".`
          : `Belum ada item lain yang serupa dengan "${sourceProduct.name}" saat ini.`,
    });
  };

  const handleClearAiSearch = () => {
    aiSearchAbortRef.current?.abort();
    aiSearchAbortRef.current = null;
    setIsAiSearching(false);
    setAiSearchQuery('');
    setAiSearchResult(null);
    setAiSearchError(null);
  };

  const bannedSellerIds = useMemo(() => {
    return new Set(
      allUsersList.filter((u) => u.accountStatus === 'banned').map((u) => u.id)
    );
  }, [allUsersList]);

  const filteredCatalog = useMemo(() => {
    const matchedOrder = aiSearchResult
      ? new Map(aiSearchResult.matchedProductIds.map((id, idx) => [id, idx]))
      : null;

    const minPriceNum = minPrice.trim() ? Number(minPrice) : null;
    const maxPriceNum = maxPrice.trim() ? Number(maxPrice) : null;

    const result = products.filter(p => {
      // Automatic hide: inactive catalog items or banned sellers are excluded
      if (p.isActive === false) return false;
      if (p.sellerId && bannedSellerIds.has(p.sellerId)) return false;

      // Filter by wishlist items if wishlist view is active
      if (isWishlistOnly && !wishlistIds.includes(p.id)) return false;

      // Filter by followed sellers if active
      if (isFollowingOnly) {
        if (!isStoreFollowed(followingStores, p.sellerBrandName || p.brand || '', p.sellerId)) {
          return false;
        }
      }

      if (matchedOrder && !matchedOrder.has(p.id)) return false;

      if (selectedCategory !== 'Semua' && p.category !== selectedCategory) return false;
      if (selectedSubCategory !== 'Semua' && p.subCategory !== selectedSubCategory) return false;
      if (!doesProductMatchSizeFilter(p.sizes || [], selectedSizes)) return false;
      const categorySupportsGender =
        selectedCategory === 'Semua' || getCategorySpec(selectedCategory).supportsGender;
      if (categorySupportsGender && selectedGender !== 'Semua' && (p.gender || 'Unisex') !== selectedGender) {
        return false;
      }
      if (minPriceNum !== null && !Number.isNaN(minPriceNum) && p.price < minPriceNum) return false;
      if (maxPriceNum !== null && !Number.isNaN(maxPriceNum) && p.price > maxPriceNum) return false;

      if (selectedCondition !== 'Semua' && (p.condition || 'Baru') !== selectedCondition) return false;
      if (selectedCity !== 'Semua Kota' && p.brandCity !== selectedCity) return false;

      const q = catalogSearch.trim().toLowerCase();
      if (q) {
        const haystack = [
          p.name,
          p.brand,
          p.sellerBrandName || '',
          p.itemBrand || '',
          p.category,
          p.subCategory || '',
          p.gender || '',
          p.fit || '',
          p.brandCity,
          p.condition || 'Baru',
          p.material || '',
          ...(p.sizes || []),
          ...(p.colors || []),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });

    const sorted = [...result];
    if (sortBy === 'murah') sorted.sort((a, b) => a.price - b.price);
    else if (sortBy === 'mahal') sorted.sort((a, b) => b.price - a.price);
    else if (matchedOrder && sortBy === 'baru') {
      sorted.sort((a, b) => (matchedOrder.get(a.id) ?? 999) - (matchedOrder.get(b.id) ?? 999));
    }
    else if (sortBy === 'baru') sorted.sort((a, b) => b.id.localeCompare(a.id));
    else if (sortBy === 'lama') sorted.sort((a, b) => a.id.localeCompare(b.id));
    return sorted;
  }, [
    products,
    bannedSellerIds,
    aiSearchResult,
    selectedCategory,
    selectedSubCategory,
    selectedSizes,
    selectedGender,
    minPrice,
    maxPrice,
    selectedCondition,
    selectedCity,
    catalogSearch,
    sortBy,
    isWishlistOnly,
    wishlistIds,
    isFollowingOnly,
    followingStores,
  ]);

  const sellerDirectory = useMemo(
    () =>
      buildSellerDirectory(products, allUsersList, userProfile).filter(
        (s) => !s.sellerId || !bannedSellerIds.has(s.sellerId)
      ),
    [products, allUsersList, bannedSellerIds, userProfile, currentUserAccount]
  );

  const matchingSellers = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return [];
    return sellerDirectory
      .filter((s) => {
        const text = `${s.brandName} ${s.ownerName || ''} ${s.city}`.toLowerCase();
        return text.includes(q);
      })
      .slice(0, 6);
  }, [sellerDirectory, catalogSearch]);

  const recentlyViewedProducts = useMemo(() => {
    const prodMap = new Map(products.filter((p) => p.isActive !== false).map((p) => [p.id, p]));
    return recentlyViewedIds
      .map((id) => prodMap.get(id))
      .filter((p): p is Product => Boolean(p));
  }, [products, recentlyViewedIds]);

  const activeSelectedProduct = useMemo(() => {
    if (!selectedProduct) return null;
    return products.find((p) => p.id === selectedProduct.id) || selectedProduct;
  }, [selectedProduct, products]);

  const activeProfileIsOwn = useMemo(() => {
    if (!selectedStoreTarget) return true;
    return (
      userProfile.isRegistered &&
      isStoreOwnedByUser(selectedStoreTarget.brandName, selectedStoreTarget.sellerId, userProfile)
    );
  }, [selectedStoreTarget, userProfile]);

  const activeProfileSellerEntry = useMemo(() => {
    if (!selectedStoreTarget) {
      return userProfile.isRegistered
        ? sellerDirectory.find((s) => s.isCurrentUser) || null
        : null;
    }
    if (selectedStoreTarget.sellerId) {
      const byId = sellerDirectory.find((s) => s.sellerId === selectedStoreTarget.sellerId);
      if (byId) return byId;
    }
    const targetNameKey = normalizeStoreKey(selectedStoreTarget.brandName);
    const byName = sellerDirectory.filter((s) => normalizeStoreKey(s.brandName) === targetNameKey);
    return byName.length === 1 ? byName[0] : byName[0] || null;
  }, [selectedStoreTarget, sellerDirectory, userProfile.isRegistered]);

  const activeProfileBrandName = activeProfileIsOwn
    ? userProfile.brandName || userProfile.name || 'Lapak Saya'
    : selectedStoreTarget?.brandName || activeProfileSellerEntry?.brandName || 'Toko AROOS';

  const activeProfileSellerId = activeProfileIsOwn
    ? userProfile.id
    : selectedStoreTarget?.sellerId || activeProfileSellerEntry?.sellerId;

  const followersModalTargetIsOwn = useMemo(() => {
    if (!followersModal || !userProfile.isRegistered) return false;
    return isStoreOwnedByUser(followersModal.brandName, followersModal.sellerId, userProfile);
  }, [followersModal, userProfile]);

  const followersModalList = useMemo(() => {
    if (!followersModal) return [];
    const targetCount = getStoreFollowerCount(
      followersModal.brandName,
      followingStores,
      followerDeltas,
      followersModalTargetIsOwn,
      followersModal.sellerId
    );
    const isFollowed =
      userProfile.isRegistered &&
      isStoreFollowed(followingStores, followersModal.brandName, followersModal.sellerId);
    return getStoreFollowersList({
      brandName: followersModal.brandName,
      sellerId: followersModal.sellerId,
      targetCount,
      sellers: sellerDirectory,
      users: getAllUsersFromDb(),
      currentProfile: userProfile,
      isFollowedByCurrentUser: isFollowed,
      isOwnStore: followersModalTargetIsOwn,
    });
  }, [
    followersModal,
    followersModalTargetIsOwn,
    followingStores,
    followerDeltas,
    sellerDirectory,
    userProfile,
  ]);

  const followersModalFollowingList = useMemo(() => {
    if (!followersModal) return [];
    return getStoreFollowingList({
      brandName: followersModal.brandName,
      sellerId: followersModal.sellerId,
      ownFollowingStores: userProfile.isRegistered ? followingStores : [],
      sellers: sellerDirectory,
      isOwnStore: followersModalTargetIsOwn,
    });
  }, [followersModal, followersModalTargetIsOwn, followingStores, sellerDirectory, userProfile.isRegistered]);

  const handleOpenFollowersModal = (
    brandName: string,
    tab: 'followers' | 'following' = 'followers',
    sellerId?: string
  ) => {
    setFollowersModal({ brandName, sellerId, tab });
  };

  const activeOrdersCount = buyerOrders.filter(o => o.orderStatus !== 'selesai').length;
  const pendingSellerOrdersCount = sellerIncomingOrders.filter(o => o.orderStatus === 'diproses').length;

  const openAuthModal = (mode: 'login' | 'register' = 'login') => {
    setAuthMode(mode);
    setIsUserAuthOpen(true);
  };

  const handleChangeMode = (mode: 'shopper' | 'seller' | 'profile') => {
    setActiveMode(mode);
    if (mode !== 'profile') {
      setSelectedStoreTarget(null);
      syncUrlParams({ toko: null, sid: null });
    }
  };

  const handleOpenSellFlow = () => {
    if (!requireAuth({ type: 'sell' })) return;
    setSelectedStoreTarget(null);
    syncUrlParams({ toko: null, sid: null, item: null });
    setActiveMode('seller');
    setActiveSellerTab('sell');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenOwnProfile = () => {
    if (!userProfile.isRegistered) {
      openAuthModal('login');
      return;
    }
    setSelectedStoreTarget(null);
    syncUrlParams({ toko: null, sid: null, item: null });
    setActiveMode('profile');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoHome = () => {
    setActiveMode('shopper');
    setSelectedProduct(null);
    setSelectedStoreTarget(null);
    setIsOrdersOpen(false);
    setIsUserAuthOpen(false);
    setIsProfileSettingsOpen(false);
    setIsSellerDirectoryOpen(false);
    setFollowersModal(null);
    setIsChatOpen(false);
    setIsWishlistOnly(false);
    setIsFollowingOnly(false);
    setCatalogSearch('');
    handleClearAiSearch();
    handleResetCatalogFilters();
    syncUrlParams({ item: null, toko: null, sid: null });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenReportModal = (target: ReportTarget) => {
    if (!userProfile.isRegistered) {
      openAuthModal('login');
      triggerToast('Masuk untuk Melaporkan', 'Silakan masuk akun terlebih dahulu untuk mengirim laporan.', 'system');
      return;
    }
    setReportTarget(target);
  };

  if (adminSession) {
    return (
      <>
        <AnimatePresence>
          {activeToast && (
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.96 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="fixed top-4 right-4 z-[80] max-w-sm w-full bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-neutral-200 p-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-neutral-900">{activeToast.title}</h4>
                  <p className="text-xs text-neutral-600 mt-0.5">{activeToast.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveToast(null)}
                  className="text-neutral-400 hover:text-neutral-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center bg-[#fafafa] text-xs text-neutral-500">
              Memuat panel Superadmin...
            </div>
          }
        >
          <SuperadminPanel
            onLogout={() => {
              handleSetAdminSession(null);
              triggerToast('Keluar Superadmin', 'Sesi Superadmin telah diakhiri.', 'system', false);
            }}
            users={allUsersList}
            loginLogs={loginLogs}
            reports={userReports}
            products={products}
            orders={allLiveOrders}
            presences={presenceMap}
            onToggleProductActive={handleToggleProductActive}
            onDeleteProduct={handleDeleteProduct}
            onTriggerToast={(title, message, type = 'system') =>
              triggerToast(title, message, type, false)
            }
          />
        </Suspense>
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#fafafa] text-neutral-900 antialiased selection:bg-neutral-800 selection:text-white">
      {/* Universal Top Navigation */}
      <Navbar
        activeMode={activeMode}
        setActiveMode={handleChangeMode}
        notifications={notifications}
        markNotificationAsRead={markNotificationAsRead}
        onMarkAllNotificationsAsRead={markAllNotificationsAsRead}
        userProfile={userProfile}
        onOpenAuthModal={openAuthModal}
        onOpenSell={handleOpenSellFlow}
        onOpenProfile={handleOpenOwnProfile}
        onOpenSettings={() => setIsProfileSettingsOpen(true)}
        onOpenOrders={() => setIsOrdersOpen(true)}
        activeOrdersCount={userProfile.isRegistered ? activeOrdersCount : 0}
        onOpenWishlist={() => {
          if (!userProfile.isRegistered) {
            openAuthModal('login');
            return;
          }
          setActiveMode('shopper');
          setIsWishlistOnly(prev => !prev);
          setTimeout(() => {
            document.getElementById('catalog-grid')?.scrollIntoView({ behavior: 'smooth' });
          }, 50);
        }}
        wishlistCount={userProfile.isRegistered ? wishlistIds.length : 0}
        onLogout={handleLogout}
        onNavigateNotification={handleNavigateNotification}
        onGoHome={handleGoHome}
      />

      {/* Floating Push Notification Toast */}
      <AnimatePresence>
        {activeToast && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed top-4 sm:top-20 left-3 right-3 sm:left-auto sm:right-6 z-50 max-w-sm sm:w-full mx-auto sm:mx-0 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-neutral-200/90 p-3.5 sm:p-4 overflow-hidden"
          >
            <div className="flex items-start gap-3">
              {activeToast.type === 'order' && (
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-full shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              )}
              {activeToast.type === 'low_stock' && (
                <div className="p-2 bg-amber-50 text-amber-600 rounded-full shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              )}
              {activeToast.type === 'social_sync' && (
                <div className="p-2 bg-purple-50 text-[#522D60] rounded-full shrink-0">
                  <RefreshCw className="w-5 h-5" />
                </div>
              )}
              {activeToast.type === 'chat' && (
                <div className="p-2 bg-neutral-100 text-neutral-900 rounded-full shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </div>
              )}
              {activeToast.type === 'system' && (
                <div className="p-2 bg-neutral-100 text-neutral-700 rounded-full shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-neutral-900 truncate">
                    {activeToast.title}
                  </h4>
                  <button
                    onClick={() => setActiveToast(null)}
                    className="text-neutral-400 hover:text-neutral-600 ml-2"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-neutral-600 mt-0.5 leading-snug">
                  {activeToast.message}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main View Router */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          {/* SHOPPER MODE (Carousell-style Clean Local Marketplace) */}
          {activeMode === 'profile' ? (
            <motion.div
              key={`view-profile-${activeProfileSellerId || activeProfileBrandName}`}
              variants={AROOS_PAGE_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={AROOS_PAGE_TRANSITION}
            >
              <Suspense fallback={null}>
                <ProfilePage
                  userProfile={userProfile}
                  currentUserAccount={currentUserAccount}
                  onProfileUpdated={(updatedAccount) => {
                    setCurrentUserAccountState(updatedAccount);
                    setUserProfile(userAccountToProfile(updatedAccount));
                    triggerToast('Profil Diperbarui', 'Data profil & alamat Anda telah berhasil disimpan.', 'system');
                  }}
                  onGoHome={handleGoHome}
                  products={products}
                  onSelectProduct={handleSelectProduct}
                  wishlistIds={userProfile.isRegistered ? wishlistIds : []}
                  onToggleWishlist={handleToggleWishlist}
                  reviews={reviews}
                  storeTarget={activeProfileIsOwn ? null : selectedStoreTarget}
                  sellerEntry={activeProfileSellerEntry}
                  isFollowed={
                    userProfile.isRegistered &&
                    isStoreFollowed(followingStores, activeProfileBrandName, activeProfileSellerId)
                  }
                  followerCount={getStoreFollowerCount(
                    activeProfileBrandName,
                    followingStores,
                    followerDeltas,
                    activeProfileIsOwn,
                    activeProfileSellerId
                  )}
                  followingCount={
                    getStoreFollowingList({
                      brandName: activeProfileBrandName,
                      sellerId: activeProfileSellerId,
                      ownFollowingStores: userProfile.isRegistered ? followingStores : [],
                      sellers: sellerDirectory,
                      isOwnStore: activeProfileIsOwn,
                    }).length
                  }
                  onToggleFollow={handleToggleFollowStore}
                  onOpenChat={(brand, sellerId) => handleOpenChatWithStore(brand, undefined, sellerId)}
                  onShareStore={(storeName) => {
                    triggerToast(
                      'Link Lapak Disalin',
                      `Tautan etalase "${storeName}" siap dibagikan.`,
                      'system'
                    );
                  }}
                  onOpenFollowers={(brand, tab = 'followers', sId) =>
                    handleOpenFollowersModal(brand, tab, sId)
                  }
                  onManageListings={() => {
                    setSelectedStoreTarget(null);
                    syncUrlParams({ toko: null, sid: null });
                    setActiveMode('seller');
                    setActiveSellerTab('listings');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  onAddReview={handleAddReview}
                  onRequireAuthForReview={() => {
                    requireAuth(
                      { type: 'store_review', storeTarget: selectedStoreTarget },
                      'Masuk untuk Tulis Ulasan',
                      'Silakan masuk akun terlebih dahulu untuk menulis ulasan & foto toko.'
                    );
                  }}
                  onReportStore={handleOpenReportModal}
                />
              </Suspense>
            </motion.div>
          ) : activeMode === 'shopper' ? (
            <motion.div
              key="view-shopper"
              variants={AROOS_PAGE_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={AROOS_PAGE_TRANSITION}
              className="space-y-8 pb-8 sm:pb-12"
            >
              {/* Search by AI Header */}
              <HeroBanner
                query={aiSearchQuery}
                onQueryChange={setAiSearchQuery}
                onSubmitSearch={handleRunAiSearch}
                onClearSearch={handleClearAiSearch}
                isSearching={isAiSearching}
                error={aiSearchError}
                result={aiSearchResult}
                matchedCount={filteredCatalog.length}
              />

              {/* Product Catalog Grid (Mobile 2-Column Responsive, Full Desktop Width) */}
              <div id="catalog-grid" className="w-full max-w-[1840px] mx-auto px-3.5 sm:px-6 lg:px-8 xl:px-10 space-y-5">
                {/* Carousell-aligned Category, Dynamic Size, Price, Condition & City Filter Bar */}
                <CatalogFilterBar
                  resultCount={filteredCatalog.length}
                  searchQuery={catalogSearch}
                  onChangeSearch={setCatalogSearch}
                  selectedCategory={selectedCategory}
                  onChangeCategory={handleChangeCategory}
                  selectedSubCategory={selectedSubCategory}
                  onChangeSubCategory={setSelectedSubCategory}
                  selectedSizes={selectedSizes}
                  availableSizes={availableFilterSizes}
                  onToggleSize={handleToggleSize}
                  onClearSizes={() => setSelectedSizes([])}
                  selectedGender={selectedGender}
                  onChangeGender={setSelectedGender}
                  minPrice={minPrice}
                  maxPrice={maxPrice}
                  onChangePriceRange={(min, max) => {
                    setMinPrice(min);
                    setMaxPrice(max);
                  }}
                  selectedCondition={selectedCondition}
                  onChangeCondition={setSelectedCondition}
                  selectedCity={selectedCity}
                  availableCities={AVAILABLE_CITIES}
                  onChangeCity={setSelectedCity}
                  sortBy={sortBy}
                  onChangeSort={setSortBy}
                  isAiActive={Boolean(aiSearchResult)}
                  isWishlistOnly={isWishlistOnly}
                  onClearWishlistOnly={() => setIsWishlistOnly(false)}
                  isFollowingOnly={isFollowingOnly}
                  onToggleFollowingOnly={() => {
                    if (!userProfile.isRegistered) {
                      openAuthModal('login');
                      return;
                    }
                    setIsFollowingOnly((prev) => !prev);
                  }}
                  followingCount={userProfile.isRegistered ? followingStores.length : 0}
                  onOpenSellerDirectory={() => setIsSellerDirectoryOpen(true)}
                  onResetFilters={handleResetCatalogFilters}
                  searchInputContainerRef={catalogSearchBoxRef}
                  onFocusSearch={() => setIsCatalogSearchFocused(true)}
                  onEscapeSearch={() => setIsCatalogSearchFocused(false)}
                />

                {/* Inline Matching Stores / Users Strip when searching */}
                {matchingSellers.length > 0 && (
                  <div className="bg-white border border-neutral-200/80 rounded-2xl p-3.5 sm:p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-neutral-700 shrink-0" />
                        <span className="text-xs font-bold text-neutral-900">
                          Toko &amp; Pengguna Ditemukan ({matchingSellers.length})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsSellerDirectoryOpen(true)}
                        className="text-[11px] font-semibold text-neutral-600 hover:text-neutral-900 underline underline-offset-2 cursor-pointer"
                      >
                        Lihat Semua
                      </button>
                    </div>
                    <div className="flex items-stretch gap-2.5 overflow-x-auto pb-1 no-scrollbar">
                      {matchingSellers.map((seller) => {
                        const isFollowed =
                          userProfile.isRegistered &&
                          isStoreFollowed(followingStores, seller.brandName, seller.sellerId);
                        const count = getStoreFollowerCount(
                          seller.brandName,
                          followingStores,
                          followerDeltas,
                          seller.isCurrentUser,
                          seller.sellerId
                        );
                        return (
                          <div
                            key={seller.key}
                            onClick={() => handleOpenStorefront(seller.brandName, seller.sellerId)}
                            className="min-w-[235px] max-w-[260px] shrink-0 p-3 rounded-xl border border-neutral-200/80 hover:border-neutral-400 bg-neutral-50/60 hover:bg-white flex items-center justify-between gap-2.5 transition-all cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {seller.avatarUrl ? (
                                <img
                                  src={seller.avatarUrl}
                                  alt={seller.brandName}
                                  loading="lazy"
                                  decoding="async"
                                  className="w-9 h-9 rounded-xl object-cover border border-neutral-200 shrink-0"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-xl bg-neutral-900 text-white flex items-center justify-center font-mono font-bold text-xs uppercase shrink-0">
                                  {seller.brandName.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-neutral-900 truncate">
                                  {seller.brandName}
                                </p>
                                <p className="text-[10px] text-neutral-500 truncate flex items-center gap-1 tabular-nums">
                                  <MapPin className="w-2.5 h-2.5 shrink-0" />
                                  <span>{seller.city}</span>
                                  <span>·</span>
                                  <span>{count} pengikut</span>
                                </p>
                              </div>
                            </div>
                            {!seller.isCurrentUser && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleFollowStore(seller.brandName, seller.sellerId);
                                }}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer inline-flex items-center gap-1 ${
                                  isFollowed
                                    ? 'bg-white border border-neutral-300 text-neutral-800'
                                    : 'bg-red-600 text-white hover:bg-red-700'
                                }`}
                              >
                                {isFollowed ? (
                                  <>
                                    <UserCheck className="w-3 h-3 text-emerald-600" />
                                    <span>Diikuti</span>
                                  </>
                                ) : (
                                  <>
                                    <UserPlus className="w-3 h-3" />
                                    <span>Ikuti</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Recently Viewed Strip — Revealed below Search Field when clicked/focused */}
                <AnimatePresence>
                  {isCatalogSearchFocused &&
                    recentlyViewedProducts.length > 0 &&
                    !isWishlistOnly &&
                    !isFollowingOnly &&
                    !aiSearchResult &&
                    !catalogSearch.trim() && (
                      <motion.div
                        ref={recentlyViewedSectionRef}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                        className="bg-white border border-neutral-200/80 rounded-2xl p-3 sm:p-3.5 shadow-sm space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                            <h2 className="text-xs font-bold text-neutral-800 tracking-tight">
                              Terakhir Dilihat
                            </h2>
                            <span className="text-[11px] text-neutral-400 tabular-nums">
                              ({recentlyViewedProducts.length})
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                setRecentlyViewedIds([]);
                                setIsCatalogSearchFocused(false);
                              }}
                              className="text-[11px] text-neutral-400 hover:text-neutral-700 underline underline-offset-2 cursor-pointer"
                            >
                              Hapus riwayat
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsCatalogSearchFocused(false)}
                              className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
                              aria-label="Tutup Terakhir Dilihat"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar">
                          {recentlyViewedProducts.map((item) => {
                            const sold = item.listingStatus === 'sold' || item.stock <= 0;
                            return (
                              <button
                                key={`recent-${item.id}`}
                                type="button"
                                onClick={() => {
                                  setIsCatalogSearchFocused(false);
                                  handleSelectProduct(item);
                                }}
                                className="group w-44 sm:w-48 shrink-0 text-left bg-neutral-50/70 hover:bg-white border border-neutral-200/80 hover:border-neutral-400 rounded-xl p-1.5 flex items-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
                              >
                                <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-neutral-100 shrink-0">
                                  <img
                                    src={item.image}
                                    alt={item.name}
                                    className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${
                                      sold ? 'opacity-55 grayscale-[30%]' : ''
                                    }`}
                                    referrerPolicy="no-referrer"
                                    loading="lazy"
                                  />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-medium text-neutral-800 truncate leading-tight">
                                    {item.name}
                                  </p>
                                  <p className="text-[10px] font-bold text-neutral-900 tabular-nums mt-0.5 leading-tight">
                                    {sold ? 'Terjual' : `Rp ${item.price.toLocaleString('id-ID')}`}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                </AnimatePresence>

                {filteredCatalog.length === 0 ? (
                  <div className="p-12 text-center bg-white rounded-3xl border border-neutral-200/80 space-y-3">
                    <ShoppingBag className="w-10 h-10 text-neutral-300 mx-auto" />
                    <p className="text-sm font-semibold text-neutral-800">
                      {isWishlistOnly
                        ? 'Belum ada pakaian di daftar impian (Wishlist) Anda'
                        : isFollowingOnly
                          ? 'Belum ada listing dari lapak yang Anda ikuti'
                          : 'Tidak ada produk yang cocok dengan pencarian Anda'}
                    </p>
                    <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                      {isWishlistOnly
                        ? 'Ketuk ikon hati pada produk apa pun untuk menyimpannya ke wishlist Anda.'
                        : isFollowingOnly
                          ? 'Jelajahi toko & pengguna lain dan ikuti lapak favorit Anda untuk melihat koleksinya di sini.'
                          : 'Coba ubah kata kunci pencarian atau atur ulang filter kategori, ukuran, harga, kondisi, dan kota.'}
                    </p>
                    <button
                      onClick={() => {
                        if (isWishlistOnly) {
                          setIsWishlistOnly(false);
                        } else if (isFollowingOnly) {
                          setIsFollowingOnly(false);
                        } else {
                          handleClearAiSearch();
                          setCatalogSearch('');
                          handleResetCatalogFilters();
                        }
                      }}
                      className="px-5 py-2.5 bg-neutral-900 text-white text-xs font-semibold rounded-full hover:bg-black transition-all duration-200 active:scale-[0.96] cursor-pointer"
                    >
                      {isWishlistOnly || isFollowingOnly ? 'Lihat Semua Katalog' : 'Reset Pencarian & Filter'}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-3 sm:gap-x-5 lg:gap-x-6 gap-y-6 sm:gap-y-8 lg:gap-y-10">
                    {filteredCatalog.map(prod => (
                      <ProductCard
                        key={prod.id}
                        product={prod}
                        onSelect={handleSelectProduct}
                        isWishlisted={userProfile.isRegistered && wishlistIds.includes(prod.id)}
                        isOwnProduct={isProductOwnedByUser(prod, userProfile)}
                        onToggleWishlist={handleToggleWishlist}
                        onOpenStore={handleOpenStorefront}
                      />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            /* HALAMAN JUAL (Jual Barang, Listing Saya, Pesanan Masuk, Laporan) */
            <motion.div
              key="view-seller"
              variants={AROOS_PAGE_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={AROOS_PAGE_TRANSITION}
              className="pb-24 md:pb-20 space-y-8"
            >
              <Suspense
                fallback={
                  <div className="max-w-[1840px] mx-auto px-4 py-12 text-center text-xs text-neutral-400">
                    Memuat studio lapak...
                  </div>
                }
              >
                <SellerHeader
                  activeTab={activeSellerTab}
                  setActiveTab={setActiveSellerTab}
                  listingsCount={products.filter((p) => isProductOwnedByUser(p, userProfile)).length}
                  pendingOrdersCount={pendingSellerOrdersCount}
                  brandName={userProfile.brandName || userProfile.name || 'Lapak Saya'}
                  brandCity={userProfile.brandCity || 'Indonesia'}
                  followerCount={getStoreFollowerCount(
                    userProfile.brandName || userProfile.name || 'Lapak Saya',
                    followingStores,
                    followerDeltas,
                    true,
                    userProfile.id
                  )}
                  followingCount={userProfile.isRegistered ? followingStores.length : 0}
                  onOpenProfile={handleOpenOwnProfile}
                  onOpenFollowers={(tab = 'followers') =>
                    handleOpenFollowersModal(
                      (userProfile.brandName || userProfile.name || 'Lapak Saya').trim(),
                      tab,
                      userProfile.id
                    )
                  }
                  onBackToCatalog={() => handleChangeMode('shopper')}
                />

                <div className="w-full max-w-[1840px] mx-auto px-3.5 sm:px-6 lg:px-8 xl:px-10 space-y-8">
                  <AnimatePresence mode="wait">
                    {(activeSellerTab === 'sell' || activeSellerTab === 'listings') && (
                      <motion.div
                        key={`seller-tab-${activeSellerTab}`}
                        variants={AROOS_TAB_VARIANTS}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={AROOS_TAB_TRANSITION}
                      >
                        <InventoryManager
                          activeSection={activeSellerTab === 'listings' ? 'listings' : 'sell'}
                          onSwitchSection={(sec) => setActiveSellerTab(sec)}
                          products={products}
                          conversations={liveConversations}
                          ownerProfile={userProfile}
                          sellerBrandName={userProfile.brandName || userProfile.name || 'Lapak Saya'}
                          sellerBrandCity={userProfile.brandCity || 'Indonesia'}
                          sellerId={userProfile.id}
                          sellerAvatar={userProfile.avatarUrl}
                          pendingEditProductId={pendingEditProductId}
                          onClearPendingEdit={() => setPendingEditProductId(null)}
                          onUpdateProduct={handleUpdateProductListing}
                          onAddProduct={handleAddProduct}
                          onToggleActive={handleToggleProductActive}
                          onDeleteProduct={handleDeleteProduct}
                          triggerToast={triggerToast}
                        />
                      </motion.div>
                    )}

                    {activeSellerTab === 'orders' && (
                      <motion.div
                        key="seller-tab-orders"
                        variants={AROOS_TAB_VARIANTS}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={AROOS_TAB_TRANSITION}
                      >
                        <SellerOrdersPanel
                          orders={sellerIncomingOrders}
                          products={products.filter((p) => isProductOwnedByUser(p, userProfile))}
                          conversations={liveConversations}
                          sellerBrandName={userProfile.brandName || userProfile.name || 'Lapak Saya'}
                          sellerBrandCity={userProfile.brandCity || 'Indonesia'}
                          sellerId={userProfile.id}
                          onUpdateOrder={handleSellerUpdateOrder}
                          onCreateManualOrder={handleCreateManualSellerOrder}
                          triggerToast={triggerToast}
                        />
                      </motion.div>
                    )}

                    {activeSellerTab === 'reports' && (
                      <motion.div
                        key="seller-tab-reports"
                        variants={AROOS_TAB_VARIANTS}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={AROOS_TAB_TRANSITION}
                      >
                        <ReportExporter
                          orders={sellerIncomingOrders}
                          products={products}
                          brandName={userProfile.brandName || userProfile.name || 'Lapak AROOS'}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Product Detail Modal */}
      <Suspense fallback={null}>
        <AnimatePresence>
          {activeSelectedProduct && (
            <ProductDetailModal
              key={activeSelectedProduct.id}
              product={activeSelectedProduct}
              onClose={handleCloseProductDetail}
              reviews={reviews}
              onAddReview={handleAddReview}
              onOpenStore={handleOpenStorefront}
              onOpenChat={(brand, ctx) => handleOpenChatWithStore(brand, ctx)}
              isRegistered={userProfile.isRegistered}
              isOwnProduct={isProductOwnedByUser(activeSelectedProduct, userProfile)}
              currentUserName={userProfile.name}
              currentUserCity={userProfile.buyerProfile?.city || userProfile.brandCity || 'Jakarta'}
              onRequireAuthForReview={() => {
                const target = activeSelectedProduct;
                handleCloseProductDetail();
                requireAuth(
                  { type: 'review', product: target },
                  'Masuk untuk Tulis Ulasan',
                  'Silakan masuk akun terlebih dahulu untuk menulis ulasan produk.'
                );
              }}
              onFindSimilar={handleFindSimilar}
              isSellerFollowed={
                userProfile.isRegistered &&
                isStoreFollowed(
                  followingStores,
                  activeSelectedProduct.sellerBrandName || activeSelectedProduct.brand,
                  activeSelectedProduct.sellerId
                )
              }
              sellerFollowerCount={getStoreFollowerCount(
                activeSelectedProduct.sellerBrandName || activeSelectedProduct.brand,
                followingStores,
                followerDeltas,
                isProductOwnedByUser(activeSelectedProduct, userProfile),
                activeSelectedProduct.sellerId
              )}
              onToggleFollowSeller={handleToggleFollowStore}
              onOpenFollowers={(brand, sId) => handleOpenFollowersModal(brand, 'followers', sId)}
              onShareProduct={(prod) => {
                triggerToast(
                  'Link Produk Disalin',
                  `Tautan langsung ke "${prod.name}" siap dibagikan.`,
                  'system'
                );
              }}
              onReport={handleOpenReportModal}
            />
          )}
        </AnimatePresence>
      </Suspense>

      {/* Unified User Auth Modal (Single Login & Register) */}
      {isUserAuthOpen && (
        <Suspense fallback={null}>
          <UserAuthModal
            isOpen={isUserAuthOpen}
            onClose={() => {
              setIsUserAuthOpen(false);
              setPendingAuthIntent(null);
            }}
            initialMode={authMode}
            onSuccess={handleAuthSuccess}
            onAdminSuccess={(sess) => {
              setIsUserAuthOpen(false);
              setPendingAuthIntent(null);
              handleSetAdminSession({
                token: sess.token,
                expiresAt: sess.expiresAt,
                name: 'Superadmin',
              });
              triggerToast('Superadmin Aktif', 'Selamat datang di panel Superadmin AROOS.', 'system', false);
            }}
            onGoHome={handleGoHome}
          />
        </Suspense>
      )}

      {/* Search & Browse Other Users / Stores Directory Modal */}
      {isSellerDirectoryOpen && (
        <Suspense fallback={null}>
          <SellerDirectoryModal
            isOpen={isSellerDirectoryOpen}
            onClose={() => setIsSellerDirectoryOpen(false)}
            sellers={sellerDirectory}
            initialQuery={catalogSearch}
            followingStores={userProfile.isRegistered ? followingStores : []}
            followerDeltas={followerDeltas}
            onToggleFollow={handleToggleFollowStore}
            onSelectStore={handleOpenStorefront}
          />
        </Suspense>
      )}

      {/* Store Followers & Following Modal */}
      {!!followersModal && (
        <Suspense fallback={null}>
          <FollowersModal
            isOpen={!!followersModal}
            onClose={() => setFollowersModal(null)}
            brandName={followersModal.brandName}
            initialTab={followersModal.tab}
            followers={followersModalList}
            followingList={followersModalFollowingList}
            isOwnStore={followersModalTargetIsOwn}
            followingStores={userProfile.isRegistered ? followingStores : []}
            onToggleFollow={handleToggleFollowStore}
            onSelectStore={handleOpenStorefront}
          />
        </Suspense>
      )}

      {/* Buyer Pesanan Saya Modal */}
      {isOrdersOpen && (
        <Suspense fallback={null}>
          <OrdersModal
            isOpen={isOrdersOpen}
            onClose={() => setIsOrdersOpen(false)}
            orders={buyerOrders}
            onConfirmReceived={handleConfirmOrderReceived}
            onOpenChat={(brand, ctx) => handleOpenChatWithStore(brand, ctx)}
            onReviewProduct={(productId) => {
              const found = products.find(p => p.id === productId);
              if (found) handleSelectProduct(found);
            }}
          />
        </Suspense>
      )}

      {/* Floating Mobile Bottom Navigation */}
      <MobileNav
        activeMode={activeMode}
        setActiveMode={handleChangeMode}
        isRegistered={userProfile.isRegistered}
        wishlistCount={userProfile.isRegistered ? wishlistIds.length : 0}
        isWishlistActive={isWishlistOnly}
        onToggleWishlistView={() => {
          if (!userProfile.isRegistered) return;
          setIsWishlistOnly(prev => !prev);
          if (activeMode !== 'shopper') handleChangeMode('shopper');
        }}
        onOpenChat={() => handleOpenChatWithStore()}
        unreadChatCount={userProfile.isRegistered ? unreadChatCount : 0}
      />

      {/* Floating Live Chat Launcher (Desktop only; mobile uses MobileNav Chat tab) */}
      <div className="hidden md:block fixed bottom-6 right-6 z-40">
        {(() => {
          const hasUnreadAlert = Boolean(userProfile.isRegistered && unreadChatCount > 0);
          return (
            <button
              onClick={() => handleOpenChatWithStore()}
              className={`group relative flex items-center gap-2 px-4.5 py-3 rounded-full transition-all duration-200 active:scale-95 cursor-pointer ${
                hasUnreadAlert
                  ? 'bg-red-500/90 hover:bg-red-600/95 text-white shadow-[0_8px_32px_rgba(239,68,68,0.35)] backdrop-blur-xl border border-red-300/50 ring-2 ring-red-400/30 aroos-chat-shake'
                  : 'bg-white/75 hover:bg-white/90 text-neutral-900 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-2xl border border-white/60 dark:border-white/20'
              }`}
              aria-label="Buka Chat"
            >
              <div className="relative flex items-center">
                <MessageSquare className={`w-4 h-4 ${hasUnreadAlert ? 'text-white' : 'text-neutral-800'}`} />
                {hasUnreadAlert && (
                  <span className="absolute -top-1.5 -right-2 bg-white text-red-600 text-[9px] font-bold tabular-nums min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center ring-2 ring-red-600">
                    {unreadChatCount > 99 ? '99+' : unreadChatCount}
                  </span>
                )}
              </div>
              <span className="text-xs font-semibold tracking-tight">
                Chat
              </span>
            </button>
          );
        })()}
      </div>

      {/* Live Chat Modal Drawer */}
      {isChatOpen && (
        <Suspense fallback={null}>
          <ChatModal
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            initialStoreName={chatStoreName}
            initialProductContext={chatProductContext}
            userProfile={userProfile}
            currentUserAccount={currentUserAccount}
            products={products}
            onSelectProduct={(productId) => {
              setIsChatOpen(false);
              const found = products.find(p => p.id === productId);
              if (found) handleSelectProduct(found);
            }}
            onUpdateUnreadCount={setUnreadChatCount}
            onReserveProduct={handleReserveProduct}
            onUnreserveProduct={handleUnreserveProduct}
            onOpenStore={handleOpenStorefront}
            onUpdateUserAddress={handleUpdateUserAddress}
            onCreateChatDeal={handleCreateChatDeal}
            onNotifyUser={handleNotifyFromChat}
            onReportUser={handleOpenReportModal}
          />
        </Suspense>
      )}

      {/* Post-Completion Review Prompt Modal */}
      {postOrderReviewTarget && (
        <Suspense fallback={null}>
          <PostOrderReviewModal
            isOpen={Boolean(postOrderReviewTarget)}
            order={postOrderReviewTarget}
            onClose={() => setPostOrderReviewTarget(null)}
            reviewerName={userProfile.name || 'Pembeli AROOS'}
            reviewerCity={userProfile.buyerProfile?.city || 'Indonesia'}
            onSubmitReview={async (rev) => {
              handleAddReview(rev);
            }}
          />
        </Suspense>
      )}

      {/* User / Storefront / Product Report Modal */}
      {reportTarget && (
        <Suspense fallback={null}>
          <ReportModal
            isOpen={Boolean(reportTarget)}
            onClose={() => setReportTarget(null)}
            target={reportTarget}
            reporterUserId={userProfile.id || 'guest'}
            reporterUserName={userProfile.name || 'Pengguna AROOS'}
            onSubmitted={() => {
              triggerToast(
                'Laporan Terkirim',
                'Laporan Anda akan ditinjau oleh tim Superadmin.',
                'system'
              );
            }}
          />
        </Suspense>
      )}

      {/* Clean & Minimalist Footer */}
      <footer className="bg-white border-t border-neutral-200 mt-auto py-3.5 pb-24 md:py-5">
        <div className="w-full max-w-[1840px] mx-auto px-3.5 sm:px-6 lg:px-8 xl:px-10 flex items-center justify-between gap-3 text-xs text-neutral-500">
          <button
            type="button"
            onClick={handleGoHome}
            className="font-black text-[#6e6e6e] hover:text-neutral-900 transition-colors tracking-[-0.05em] text-sm sm:text-base uppercase font-sans cursor-pointer active:scale-95"
            aria-label="AROOS Homepage"
          >
            AROOS
          </button>
          <span className="text-neutral-400 text-[11px]">
            © 2026 AROOS Indonesia.
          </span>
        </div>
      </footer>

    </div>
  );
}
