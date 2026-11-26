import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate, PanInfo } from 'motion/react';
import {
  X, Send, Image as ImageIcon, Search, ChevronLeft, CheckCheck,
  Tag, ExternalLink, CheckCircle2, Clock, Mail, Pin, PinOff,
  Trash2, RotateCcw, MapPin, Copy, Check, Handshake, XCircle, Flag
} from 'lucide-react';
import {
  ChatMessage,
  ChatConversation,
  ChatProductContext,
  NotificationItem,
  OfferStatus,
  Product,
  UserAccount,
  UserPresence,
  UserProfile,
} from '../types';
import { INITIAL_CHAT_CONVERSATIONS, INITIAL_CHAT_MESSAGES } from '../data/mockData';
import {
  buildConversationId,
  getRoleInConversation,
  getUnreadCountForUser,
  markChatMessagesAsReadInFirestore,
  saveConversationInFirestore,
  sendChatMessageInFirestore,
  subscribeToConversationMessages,
  subscribeToLiveConversations,
  updateChatMessageOfferStatusInFirestore,
  updateConversationInFirestore,
  updateTypingStatusInFirestore,
} from '../services/chatService';
import { fetchUserByIdFromFirestore } from '../services/phoneAuthService';
import { formatPresenceLabel, subscribeToAllPresences } from '../services/presenceService';
import { isProductOwnedByUser, isStoreOwnedByUser, normalizeIdentityKey } from '../utils/ownership';
import { getAllUsersFromDb } from '../utils/userDb';
import { useConfirm } from './ConfirmDialogContext';
import { ReservedBuyerModal } from './ReservedBuyerModal';
import { ReportTarget } from './ReportModal';
import {
  AROOS_BACKDROP_TRANSITION,
  AROOS_MODAL_TRANSITION,
  AROOS_MODAL_VARIANTS,
} from '../utils/motionPresets';

interface SwipeableConversationRowProps {
  conv: ChatConversation;
  role: 'buyer' | 'seller';
  unreadCount: number;
  isActive: boolean;
  isCounterpartyOnline?: boolean;
  isCounterpartyTyping?: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
  onRemove: () => void;
}

const SwipeableConversationRow: React.FC<SwipeableConversationRowProps> = ({
  conv,
  role,
  unreadCount,
  isActive,
  isCounterpartyOnline = false,
  isCounterpartyTyping = false,
  onSelect,
  onTogglePin,
  onRemove,
}) => {
  const x = useMotionValue(0);
  const leftOpacity = useTransform(x, [0, 10, 48], [0, 0.55, 1]);
  const rightOpacity = useTransform(x, [-48, -10, 0], [1, 0.55, 0]);
  const isDraggingRef = useRef(false);
  const isPinned = Boolean(conv.isPinned);
  const isUnread = unreadCount > 0;

  const counterpartyName = role === 'seller' ? (conv.buyerName || 'Pembeli') : conv.storeName;
  const counterpartyAvatar =
    role === 'seller'
      ? (conv.buyerName || 'P').slice(0, 2).toUpperCase()
      : conv.storeAvatar || conv.storeName.slice(0, 2).toUpperCase();

  const snapClose = () => {
    animate(x, 0, { type: 'spring', stiffness: 460, damping: 36 });
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const currentX = x.get();
    window.setTimeout(() => {
      isDraggingRef.current = false;
    }, 60);

    if (currentX > 56 || (info.velocity.x > 340 && currentX > 22)) {
      onTogglePin();
      snapClose();
      return;
    }

    if (currentX < -108 || (info.velocity.x < -520 && currentX < -44)) {
      animate(x, -360, { duration: 0.16 }).then(() => {
        onRemove();
      });
      return;
    }

    if (currentX < -36) {
      animate(x, -84, { type: 'spring', stiffness: 460, damping: 36 });
      return;
    }

    snapClose();
  };

  const handleCardClick = () => {
    if (isDraggingRef.current) return;
    if (Math.abs(x.get()) > 8) {
      snapClose();
      return;
    }
    onSelect();
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
      transition={{ duration: 0.18 }}
      className="relative overflow-hidden rounded-2xl"
    >
      <motion.div
        style={{ opacity: leftOpacity }}
        className="absolute inset-y-0 left-0 w-24 flex items-center justify-start pl-3.5 bg-amber-500 text-white rounded-l-2xl pointer-events-none"
      >
        <div className="flex flex-col items-center gap-0.5 text-[10px] font-bold">
          {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
          <span>{isPinned ? 'Lepas' : 'Pin'}</span>
        </div>
      </motion.div>

      <motion.div
        style={{ opacity: rightOpacity }}
        className="absolute inset-y-0 right-0 w-24 flex items-center justify-end bg-red-600 text-white rounded-r-2xl"
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            animate(x, -360, { duration: 0.16 }).then(() => {
              onRemove();
            });
          }}
          className="w-21 h-full flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold cursor-pointer hover:bg-red-700 transition-colors"
          aria-label="Hapus percakapan"
        >
          <Trash2 className="w-4 h-4" />
          <span>Hapus</span>
        </button>
      </motion.div>

      <motion.div
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -140, right: 105 }}
        dragElastic={0.16}
        onDragStart={() => {
          isDraggingRef.current = true;
        }}
        onDragEnd={handleDragEnd}
        onClick={handleCardClick}
        className={`group relative p-3 rounded-2xl flex items-center gap-3 cursor-pointer transition-colors touch-pan-y select-none ${
          isActive
            ? 'bg-white shadow-sm ring-1 ring-neutral-300/90'
            : isUnread
              ? 'bg-red-50/90 hover:bg-red-50 ring-1 ring-red-200/80 shadow-2xs'
              : isPinned
                ? 'bg-amber-50/70 hover:bg-amber-50 ring-1 ring-amber-200/75'
                : 'bg-neutral-50 hover:bg-white/95 text-neutral-600'
        }`}
      >
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs">
            {counterpartyAvatar}
          </div>
          {isUnread ? (
            <span
              aria-label="Belum dibaca"
              className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-600 rounded-full ring-2 ring-white"
            />
          ) : isCounterpartyOnline ? (
            <span
              aria-label="Aktif sekarang"
              className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white"
            />
          ) : null}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              {isPinned && (
                <Pin className="w-3 h-3 text-amber-500 fill-amber-500 rotate-45 shrink-0" />
              )}
              <span
                className={`text-[11px] truncate tracking-wide ${
                  isUnread ? 'font-bold text-neutral-900' : 'font-semibold text-neutral-600'
                }`}
              >
                {counterpartyName}
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-neutral-200/70 text-neutral-600 shrink-0">
                {role === 'seller' ? 'Pembeli' : 'Penjual'}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <span
                className={`text-[10px] tabular-nums sm:group-hover:hidden ${
                  isUnread ? 'font-bold text-red-600' : 'text-neutral-400'
                }`}
              >
                {conv.lastTimestamp}
              </span>

              <div className="hidden sm:group-hover:flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePin();
                  }}
                  className={`p-1 rounded-lg transition-colors cursor-pointer ${
                    isPinned
                      ? 'text-amber-600 bg-amber-100/80 hover:bg-amber-200/80'
                      : 'text-neutral-400 hover:text-neutral-900 hover:bg-neutral-200/70'
                  }`}
                  title={isPinned ? 'Lepas Pin' : 'Pin Percakapan'}
                  aria-label={isPinned ? 'Lepas Pin' : 'Pin Percakapan'}
                >
                  {isPinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                  }}
                  className="p-1 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                  title="Hapus Percakapan"
                  aria-label="Hapus Percakapan"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          <p
            className={`text-xs truncate mt-0.5 ${
              isUnread
                ? 'font-bold text-neutral-950'
                : isActive
                  ? 'font-semibold text-neutral-900'
                  : 'font-medium text-neutral-700'
            }`}
          >
            {conv.product.name}
          </p>

          <div className="flex items-center justify-between gap-2 mt-1">
            <div className="min-w-0 flex-1">
              {isCounterpartyTyping ? (
                <p className="text-[11px] truncate text-emerald-700 font-semibold italic">
                  (typing..)
                </p>
              ) : conv.dealOrderId ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 truncate">
                  <Handshake className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span className="truncate">Deal Tercatat</span>
                </span>
              ) : conv.offerStatus === 'accepted' ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 truncate">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span className="truncate">Tawaran Disetujui</span>
                </span>
              ) : conv.offerStatus === 'countered' ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 truncate tabular-nums">
                  <Tag className="w-3 h-3 text-blue-600 shrink-0" />
                  <span className="truncate">
                    Balasan Rp {(conv.counterPrice || conv.product.price).toLocaleString('id-ID')}
                  </span>
                </span>
              ) : conv.offerStatus === 'pending' ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 truncate">
                  <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                  <span className="truncate">
                    {role === 'seller' ? 'Ada Tawaran Masuk' : 'Menunggu Penjual'}
                  </span>
                </span>
              ) : conv.lastMessage ? (
                <p
                  className={`text-[11px] truncate ${
                    isUnread ? 'font-semibold text-neutral-900' : 'text-neutral-500'
                  }`}
                >
                  {conv.lastMessage}
                </p>
              ) : (
                <p className="text-[11px] truncate text-neutral-400 italic">
                  Ketik pesan untuk memulai...
                </p>
              )}
            </div>

            {isUnread && (
              <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums shadow-2xs shrink-0">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        </div>

        <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-neutral-100 shrink-0 border border-neutral-200/80 shadow-2xs">
          <img
            src={conv.product.image}
            alt=""
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
      </motion.div>
    </motion.div>
  );
};

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStoreName?: string;
  initialProductContext?: ChatProductContext | null;
  userProfile: UserProfile;
  currentUserAccount?: UserAccount | null;
  products?: Product[];
  onSelectProduct?: (productId: string) => void;
  onUpdateUnreadCount?: (count: number) => void;
  onReserveProduct?: (productId: string, buyer?: { id?: string; name: string }) => void;
  onUnreserveProduct?: (productId: string) => void;
  onOpenStore?: (brandName: string, sellerId?: string) => void;
  onUpdateUserAddress?: (payload: {
    name: string;
    phone: string;
    city: string;
    address: string;
    postalCode?: string;
  }) => Promise<UserAccount | void>;
  onCreateChatDeal?: (deal: {
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
  }) => Promise<string | void>;
  onNotifyUser?: (notif: Omit<NotificationItem, 'id' | 'time' | 'read'>) => void;
  onReportUser?: (target: ReportTarget) => void;
}

const DEMO_BUYER_SEED_CONVS: ChatConversation[] = INITIAL_CHAT_CONVERSATIONS.map((c) => ({
  ...c,
  buyerId: 'usr-buyer-001',
  buyerName: 'Anindya Putri',
  buyerUnreadCount: c.unreadCount,
  sellerUnreadCount: 0,
}));

export const ChatModal: React.FC<ChatModalProps> = ({
  isOpen,
  onClose,
  initialStoreName,
  initialProductContext = null,
  userProfile,
  currentUserAccount = null,
  products = [],
  onSelectProduct,
  onUpdateUnreadCount,
  onReserveProduct,
  onUnreserveProduct,
  onOpenStore,
  onUpdateUserAddress,
  onCreateChatDeal,
  onNotifyUser,
  onReportUser,
}) => {
  const confirm = useConfirm();

  const [liveConversations, setLiveConversations] = useState<ChatConversation[]>([]);
  const [draftConversation, setDraftConversation] = useState<ChatConversation | null>(null);
  const [activeConvId, setActiveConvId] = useState<string>('');
  const [mobileView, setMobileView] = useState<'inbox' | 'chat'>('inbox');
  const [messagesByConv, setMessagesByConv] = useState<Record<string, ChatMessage[]>>({});

  // Inbox Tabs & Filter
  const [inboxSearch, setInboxSearch] = useState<string>('');
  const [inboxRoleTab, setInboxRoleTab] = useState<'all' | 'buying' | 'selling'>('all');
  const [onlyUnread, setOnlyUnread] = useState<boolean>(false);

  const [lastRemovedChat, setLastRemovedChat] = useState<{
    conv: ChatConversation;
    index: number;
  } | null>(null);

  const [inputText, setInputText] = useState<string>('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  // Offer & Counter-Offer Dialog States
  const [isOfferOpen, setIsOfferOpen] = useState<boolean>(false);
  const [offerPriceInput, setOfferPriceInput] = useState<string>('');
  const [isCounterOpen, setIsCounterOpen] = useState<boolean>(false);
  const [counterPriceInput, setCounterPriceInput] = useState<string>('');

  // Quick Address Modal State ("Alamat Saya")
  const [isAddressModalOpen, setIsAddressModalOpen] = useState<boolean>(false);
  const [addrName, setAddrName] = useState<string>('');
  const [addrPhone, setAddrPhone] = useState<string>('');
  const [addrCity, setAddrCity] = useState<string>('');
  const [addrPostalCode, setAddrPostalCode] = useState<string>('');
  const [addrFull, setAddrFull] = useState<string>('');
  const [addrSaving, setAddrSaving] = useState<boolean>(false);

  // Catat Deal Modal State (Direct Chat Commerce - No Payment Gateway)
  const [isDealModalOpen, setIsDealModalOpen] = useState<boolean>(false);
  const [dealPaymentMethod, setDealPaymentMethod] = useState<'transfer_langsung' | 'cod'>('transfer_langsung');
  const [dealCourier, setDealCourier] = useState<string>('Kurir Reguler (JNE / J&T / SiCepat)');
  const [dealBuyerName, setDealBuyerName] = useState<string>('');
  const [dealBuyerPhone, setDealBuyerPhone] = useState<string>('');
  const [dealBuyerCity, setDealBuyerCity] = useState<string>('');
  const [dealBuyerAddress, setDealBuyerAddress] = useState<string>('');
  const [isSubmittingDeal, setIsSubmittingDeal] = useState<boolean>(false);
  const [reservePickerTarget, setReservePickerTarget] = useState<{
    product: Product;
    preferredBuyerId?: string;
    preferredBuyerName?: string;
  } | null>(null);

  const [presenceMap, setPresenceMap] = useState<Record<string, UserPresence>>({});
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const undoTimerRef = useRef<number | null>(null);
  const handledOpenContextRef = useRef<string>('');
  const skipAutoReadConvIdRef = useRef<string | null>(null);
  const lastTypingSentAtRef = useRef<number>(0);
  const typingClearTimerRef = useRef<number | null>(null);
  const lastTypingConvRef = useRef<{ convId: string; role: 'buyer' | 'seller' } | null>(null);

  // Subscribe to all presences & refresh ticker when modal is open
  useEffect(() => {
    if (!isOpen || !userProfile.isRegistered) return;
    const unsubscribe = subscribeToAllPresences(setPresenceMap);
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1500);
    return () => {
      unsubscribe();
      window.clearInterval(intervalId);
    };
  }, [isOpen, userProfile.isRegistered]);

  // Real-time Firestore conversations subscription
  useEffect(() => {
    if (!userProfile.isRegistered) {
      setLiveConversations([]);
      return;
    }

    const unsubscribe = subscribeToLiveConversations(userProfile, (convs) => {
      if (userProfile.id === 'usr-buyer-001') {
        const existingIds = new Set(convs.map((c) => c.id));
        const hiddenIds = new Set<string>();
        convs.forEach((c) => {
          if (Array.isArray(c.hiddenBy) && c.hiddenBy.includes('usr-buyer-001')) {
            hiddenIds.add(c.id);
          }
        });
        const merged = [
          ...convs,
          ...DEMO_BUYER_SEED_CONVS.filter((c) => !existingIds.has(c.id) && !hiddenIds.has(c.id)),
        ];
        setLiveConversations(merged);
      } else {
        setLiveConversations(convs);
      }
    });

    return () => unsubscribe();
  }, [userProfile]);

  const conversations = useMemo(() => {
    if (!draftConversation) return liveConversations;
    if (liveConversations.some((c) => c.id === draftConversation.id)) {
      return liveConversations;
    }
    return [draftConversation, ...liveConversations];
  }, [liveConversations, draftConversation]);

  // Reconcile per-conversation unread count from counterparty (conversation field + loaded incoming messages)
  const getEffectiveUnreadCount = React.useCallback(
    (conv: ChatConversation): number => {
      const baseUnread = getUnreadCountForUser(conv, userProfile);
      const role = getRoleInConversation(conv, userProfile);
      const msgs = messagesByConv[conv.id];
      if (!msgs || msgs.length === 0) return baseUnread;

      const unreadIncomingMsgs = msgs.filter((m) => {
        const isOwn =
          m.senderId && userProfile.id
            ? m.senderId === userProfile.id
            : role === 'seller'
              ? m.sender === 'store'
              : m.sender === 'user';
        return !isOwn && m.isRead !== true;
      }).length;

      return Math.max(baseUnread, unreadIncomingMsgs);
    },
    [userProfile, messagesByConv]
  );

  // Report total unread count across all visible conversations in real time
  useEffect(() => {
    if (!userProfile.isRegistered) {
      onUpdateUnreadCount?.(0);
      return;
    }
    const total = conversations.reduce((sum, c) => sum + getEffectiveUnreadCount(c), 0);
    onUpdateUnreadCount?.(total);
  }, [conversations, userProfile, getEffectiveUnreadCount, onUpdateUnreadCount]);

  // Active conversation resolution
  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConvId) || conversations[0] || null,
    [conversations, activeConvId]
  );

  // Real-time Firestore messages subscription for active conversation
  useEffect(() => {
    if (!userProfile.isRegistered || !activeConversation?.id) return;
    const convId = activeConversation.id;

    const unsubscribe = subscribeToConversationMessages(convId, (msgs) => {
      const seedFallback =
        msgs.length === 0 && userProfile.id === 'usr-buyer-001'
          ? INITIAL_CHAT_MESSAGES[convId] || []
          : [];
      setMessagesByConv((prev) => ({
        ...prev,
        [convId]: msgs.length > 0 ? msgs : seedFallback,
      }));
    });

    return () => unsubscribe();
  }, [activeConversation?.id, userProfile.isRegistered, userProfile.id]);

  // Clear unread counter & mark incoming messages as read when viewing an open conversation
  useEffect(() => {
    if (!isOpen || !activeConversation || !userProfile.isRegistered) return;
    if (window.innerWidth < 640 && mobileView !== 'chat') return;
    if (skipAutoReadConvIdRef.current === activeConversation.id) return;

    const unread = getUnreadCountForUser(activeConversation, userProfile);
    const role = getRoleInConversation(activeConversation, userProfile);
    if (unread > 0) {
      const patch: Partial<ChatConversation> =
        role === 'seller'
          ? { sellerUnreadCount: 0, unreadCount: 0 }
          : { buyerUnreadCount: 0, unreadCount: 0 };

      setLiveConversations((prev) =>
        prev.map((c) => (c.id === activeConversation.id ? { ...c, ...patch } : c))
      );
      void updateConversationInFirestore(activeConversation.id, patch, activeConversation);
    }

    const currentMsgs = messagesByConv[activeConversation.id] || [];
    const unreadIncomingIds = currentMsgs
      .filter((m) => {
        const isOwn =
          m.senderId && userProfile.id
            ? m.senderId === userProfile.id
            : role === 'seller'
              ? m.sender === 'store'
              : m.sender === 'user';
        return !isOwn && m.isRead !== true;
      })
      .map((m) => m.id);

    if (unreadIncomingIds.length > 0) {
      const idSet = new Set(unreadIncomingIds);
      setMessagesByConv((prev) => ({
        ...prev,
        [activeConversation.id]: (prev[activeConversation.id] || []).map((m) =>
          idSet.has(m.id) ? { ...m, isRead: true } : m
        ),
      }));
      void markChatMessagesAsReadInFirestore(activeConversation.id, unreadIncomingIds);
    }
  }, [isOpen, activeConversation, mobileView, userProfile, messagesByConv]);

  // Handle opening with a specific product inquiry or store name
  useEffect(() => {
    if (!isOpen) {
      handledOpenContextRef.current = '';
      skipAutoReadConvIdRef.current = null;
      setDraftConversation(null);
      return;
    }
    if (!userProfile.isRegistered) return;

    const contextKey = initialProductContext
      ? `prod:${initialProductContext.id}:${userProfile.id || ''}`
      : initialStoreName
        ? `store:${initialStoreName}:${userProfile.id || ''}`
        : `inbox:${userProfile.id || ''}`;

    if (handledOpenContextRef.current === contextKey) return;
    handledOpenContextRef.current = contextKey;

    if (initialProductContext) {
      const targetProd = products.find((p) => p.id === initialProductContext.id);
      const isOwn =
        (targetProd && isProductOwnedByUser(targetProd, userProfile)) ||
        isStoreOwnedByUser(
          initialProductContext.brand,
          initialProductContext.sellerId || targetProd?.sellerId,
          userProfile
        );

      if (isOwn) {
        // Seller clicked their own listing: never open self-chat
        const sellerInboxConv = conversations.find(
          (c) =>
            c.product.id === initialProductContext.id &&
            getRoleInConversation(c, userProfile) === 'seller'
        );
        if (sellerInboxConv) {
          setActiveConvId(sellerInboxConv.id);
          setMobileView('chat');
        } else {
          setMobileView('inbox');
        }
        return;
      }

      const deterministicId = buildConversationId(
        initialProductContext.id,
        userProfile.id || 'buyer'
      );
      const existing = conversations.find(
        (c) =>
          c.id === deterministicId ||
          (c.product.id === initialProductContext.id &&
            getRoleInConversation(c, userProfile) === 'buyer')
      );

      if (existing) {
        setDraftConversation(null);
        setActiveConvId(existing.id);
        setMobileView('chat');
        return;
      }

      // Resolve sellerId accurately
      const matchedSellerUser = getAllUsersFromDb().find((u) => {
        const uBrand = normalizeIdentityKey(u.sellerProfile?.brandName);
        const uName = normalizeIdentityKey(u.name);
        const targetBrand = normalizeIdentityKey(initialProductContext.brand);
        return Boolean(targetBrand && (uBrand === targetBrand || uName === targetBrand));
      });
      const resolvedSellerId =
        initialProductContext.sellerId || targetProd?.sellerId || matchedSellerUser?.id;
      const storeBrand = initialProductContext.brand || targetProd?.sellerBrandName || targetProd?.brand || 'Penjual';
      const nowIso = new Date().toISOString();

      const newConv: ChatConversation = {
        id: deterministicId,
        storeId: storeBrand,
        storeName: storeBrand,
        storeAvatar: storeBrand.slice(0, 2).toUpperCase(),
        buyerId: userProfile.id,
        buyerName: userProfile.name || 'Pembeli',
        sellerId: resolvedSellerId,
        onlineStatus: 'Aktif di AROOS',
        product: {
          ...initialProductContext,
          sellerId: resolvedSellerId,
        },
        offerStatus: null,
        itemStatus:
          targetProd?.listingStatus === 'sold' || (targetProd && targetProd.stock <= 0)
            ? 'Sold Out'
            : 'Tersedia',
        lastMessage: '',
        lastTimestamp: 'Baru saja',
        unreadCount: 0,
        buyerUnreadCount: 0,
        sellerUnreadCount: 0,
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      };

      setDraftConversation(newConv);
      setActiveConvId(deterministicId);
      setMobileView('chat');
    } else if (initialStoreName) {
      const storeKey = normalizeIdentityKey(initialStoreName);
      const matched = conversations.find(
        (c) => normalizeIdentityKey(c.storeName) === storeKey
      );
      if (matched) {
        setActiveConvId(matched.id);
        setMobileView('chat');
      } else {
        setMobileView(window.innerWidth < 640 ? 'inbox' : 'chat');
      }
    } else {
      setMobileView(window.innerWidth < 640 ? 'inbox' : 'chat');
    }
  }, [isOpen, initialProductContext, initialStoreName, userProfile, products, conversations, onNotifyUser]);

  // Auto scroll messages
  const activeMessages = activeConversation ? messagesByConv[activeConversation.id] || [] : [];

  const activeRole: 'buyer' | 'seller' = useMemo(() => {
    if (!activeConversation) return 'buyer';
    return getRoleInConversation(activeConversation, userProfile);
  }, [activeConversation, userProfile]);

  const isActiveCounterpartyTyping = useMemo(() => {
    if (!activeConversation) return false;
    const typingAt =
      activeRole === 'seller'
        ? activeConversation.buyerTypingAt
        : activeConversation.sellerTypingAt;
    return Boolean(typingAt && nowMs - typingAt <= 4500);
  }, [activeConversation, activeRole, nowMs]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length, activeConversation?.id, isActiveCounterpartyTyping]);

  // Clear typing status on conversation change or modal close
  useEffect(() => {
    if (!isOpen && lastTypingConvRef.current) {
      const prev = lastTypingConvRef.current;
      void updateTypingStatusInFirestore(prev.convId, prev.role, 0);
      lastTypingConvRef.current = null;
      lastTypingSentAtRef.current = 0;
    }
  }, [isOpen]);

  const activeFullProduct = useMemo(
    () => products.find((p) => p.id === activeConversation?.product.id),
    [products, activeConversation?.product.id]
  );

  // Contextual quick reply suggestions based on per-conversation role
  const contextualSuggestions = useMemo(() => {
    if (!activeConversation) return [];
    const prod = activeFullProduct;
    const stock = prod?.stock ?? 1;
    const isSold = prod?.listingStatus === 'sold' || stock <= 0 || activeConversation.itemStatus === 'Sold Out';
    const condition = prod?.condition || 'Pre-loved';
    const sizesList = prod?.sizes && prod.sizes.length > 0 ? prod.sizes : [];
    const sizesText = sizesList.slice(0, 3).join(', ') || 'tersedia';
    const city = prod?.brandCity || 'lokasi penjual';
    const material = prod?.material || 'bahan pilihan';
    const allowMeetup = Boolean(prod?.allowMeetup);
    const meetupArea = prod?.meetupArea || city;
    const basePrice = activeConversation.product.price;
    const softNegoPrice = Math.max(10000, Math.round((basePrice * 0.9) / 5000) * 5000);

    const list: string[] = [];

    if (activeRole === 'seller') {
      if (isSold) {
        list.push('Maaf kak, item ini baru saja terjual.');
        list.push('Nanti kalau ada stok serupa saya kabari ya kak.');
      } else {
        list.push(`Masih ready ${stock} pcs (size ${sizesText}), siap kirim dari ${city}!`);
        if (allowMeetup) {
          list.push(`Bisa COD area ${meetupArea} atau kirim ekspedisi hari ini.`);
        } else {
          list.push(`Bisa kirim hari ini dari ${city} pakai ekspedisi reguler/instan.`);
        }
        list.push(`Kondisi ${condition}, bahan ${material}. Boleh ajukan tawaran ya kak.`);
      }
    } else {
      if (isSold) {
        list.push('Apakah ada stok atau model serupa lainnya kak?');
      } else if (activeConversation.offerStatus === 'accepted') {
        list.push('Oke deal kak! Ini alamat pengiriman saya ya.');
        list.push(`Bisa kirim hari ini dari ${city}?`);
        if (allowMeetup) {
          list.push(`Atau ketemu COD di area ${meetupArea}?`);
        }
      } else {
        const primarySize = sizesList[0];
        list.push(
          primarySize
            ? `Apakah size ${primarySize} masih ready?`
            : 'Apakah item ini masih ready stok kak?'
        );
        list.push(
          condition === 'Pre-loved'
            ? 'Kondisi pre-loved-nya ada minus pemakaian kak?'
            : `Detail bahan ${material} & fitting-nya bagaimana kak?`
        );
        list.push(
          allowMeetup
            ? `Bisa COD di sekitar ${meetupArea} kak?`
            : `Bisa dikirim hari ini dari ${city}?`
        );
        list.push(`Boleh nego ke Rp ${softNegoPrice.toLocaleString('id-ID')} kak?`);
      }
    }

    return Array.from(new Set(list)).slice(0, 3);
  }, [activeConversation, activeFullProduct, activeRole]);

  // Role tab counts & filtered list
  const { buyingCount, sellingCount, totalUnreadCount } = useMemo(() => {
    let buying = 0;
    let selling = 0;
    let unread = 0;
    conversations.forEach((c) => {
      const r = getRoleInConversation(c, userProfile);
      if (r === 'seller') selling++;
      else buying++;
      if (getEffectiveUnreadCount(c) > 0) unread++;
    });
    return { buyingCount: buying, sellingCount: selling, totalUnreadCount: unread };
  }, [conversations, userProfile, getEffectiveUnreadCount]);

  const filteredConversations = useMemo(() => {
    return conversations
      .filter((c) => {
        const r = getRoleInConversation(c, userProfile);
        if (inboxRoleTab === 'buying' && r !== 'buyer') return false;
        if (inboxRoleTab === 'selling' && r !== 'seller') return false;
        if (onlyUnread && getEffectiveUnreadCount(c) <= 0) return false;
        if (!inboxSearch.trim()) return true;
        const q = inboxSearch.toLowerCase();
        const counterparty = r === 'seller' ? (c.buyerName || 'Pembeli') : c.storeName;
        return (
          counterparty.toLowerCase().includes(q) ||
          c.storeName.toLowerCase().includes(q) ||
          c.product.name.toLowerCase().includes(q) ||
          c.lastMessage.toLowerCase().includes(q)
        );
      })
      .slice()
      .sort((a, b) => {
        const aPinned = Boolean(a.isPinned);
        const bPinned = Boolean(b.isPinned);
        if (aPinned !== bPinned) return aPinned ? -1 : 1;
        if (aPinned && bPinned) return (b.pinnedAt || 0) - (a.pinnedAt || 0);
        const ta = a.updatedAtIso || a.createdAtIso || a.id;
        const tb = b.updatedAtIso || b.createdAtIso || b.id;
        return tb.localeCompare(ta);
      });
  }, [conversations, userProfile, inboxRoleTab, onlyUnread, inboxSearch, getEffectiveUnreadCount]);

  const handleMarkAllAsRead = () => {
    skipAutoReadConvIdRef.current = null;
    setLiveConversations((prev) =>
      prev.map((c) => {
        if (getEffectiveUnreadCount(c) <= 0) return c;
        const r = getRoleInConversation(c, userProfile);
        const patch: Partial<ChatConversation> =
          r === 'seller'
            ? { sellerUnreadCount: 0, unreadCount: 0 }
            : { buyerUnreadCount: 0, unreadCount: 0 };
        void updateConversationInFirestore(c.id, patch, c);

        const loadedMsgs = messagesByConv[c.id] || [];
        const unreadIds = loadedMsgs
          .filter((m) => {
            const isOwn =
              m.senderId && userProfile.id
                ? m.senderId === userProfile.id
                : r === 'seller'
                  ? m.sender === 'store'
                  : m.sender === 'user';
            return !isOwn && m.isRead !== true;
          })
          .map((m) => m.id);
        if (unreadIds.length > 0) {
          void markChatMessagesAsReadInFirestore(c.id, unreadIds);
        }

        return { ...c, ...patch };
      })
    );
    setMessagesByConv((prev) => {
      const next: Record<string, ChatMessage[]> = {};
      Object.entries(prev).forEach(([convId, list]) => {
        next[convId] = list.map((m) => ({ ...m, isRead: true }));
      });
      return next;
    });
  };

  const handleMarkAsUnread = (convId: string) => {
    const conv = conversations.find((c) => c.id === convId);
    if (!conv) return;
    const r = getRoleInConversation(conv, userProfile);
    const patch: Partial<ChatConversation> =
      r === 'seller'
        ? { sellerUnreadCount: Math.max(1, conv.sellerUnreadCount || 0), unreadCount: 1 }
        : { buyerUnreadCount: Math.max(1, conv.buyerUnreadCount || 0), unreadCount: 1 };

    skipAutoReadConvIdRef.current = convId;
    setLiveConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, ...patch } : c)));
    void updateConversationInFirestore(convId, patch, conv);

    if (window.innerWidth < 640) {
      setMobileView('inbox');
    } else {
      const nextRead = conversations.find((c) => c.id !== convId && getEffectiveUnreadCount(c) === 0);
      if (nextRead) setActiveConvId(nextRead.id);
    }
  };

  const handleTogglePin = (convId: string) => {
    const target = conversations.find((c) => c.id === convId);
    if (!target) return;
    const nextPinned = !target.isPinned;
    const patch: Partial<ChatConversation> = {
      isPinned: nextPinned,
      pinnedAt: nextPinned ? Date.now() : 0,
    };
    if (draftConversation?.id === convId && !liveConversations.some((c) => c.id === convId)) {
      setDraftConversation({ ...target, ...patch });
      return;
    }
    setLiveConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, ...patch } : c)));
    void updateConversationInFirestore(convId, patch);
  };

  const handleRemoveConversation = (convId: string) => {
    if (draftConversation?.id === convId && !liveConversations.some((c) => c.id === convId)) {
      setDraftConversation(null);
      if (activeConvId === convId) {
        setActiveConvId(liveConversations[0]?.id || '');
        if (window.innerWidth < 640) {
          setMobileView('inbox');
        }
      }
      return;
    }

    const idx = conversations.findIndex((c) => c.id === convId);
    if (idx === -1) return;
    const removedConv = conversations[idx];

    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current);
    }
    setLastRemovedChat({ conv: removedConv, index: idx });
    undoTimerRef.current = window.setTimeout(() => {
      setLastRemovedChat(null);
    }, 4500);

    const uid = userProfile.id || 'guest';
    const nextHiddenBy = Array.from(new Set([...(removedConv.hiddenBy || []), uid]));
    void updateConversationInFirestore(convId, { hiddenBy: nextHiddenBy });

    const remaining = conversations.filter((c) => c.id !== convId);
    setLiveConversations(remaining);

    if (activeConvId === convId) {
      setActiveConvId(remaining[0]?.id || '');
      if (window.innerWidth < 640) {
        setMobileView('inbox');
      }
    }
  };

  const handleUndoRemove = () => {
    if (!lastRemovedChat) return;
    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    const { conv, index } = lastRemovedChat;
    const uid = userProfile.id || 'guest';
    const nextHiddenBy = (conv.hiddenBy || []).filter((id) => id !== uid);
    void updateConversationInFirestore(conv.id, { hiddenBy: nextHiddenBy });

    setLiveConversations((prev) => {
      if (prev.some((c) => c.id === conv.id)) return prev;
      const next = [...prev];
      next.splice(Math.min(index, next.length), 0, { ...conv, hiddenBy: nextHiddenBy });
      return next;
    });
    setLastRemovedChat(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setComposerError('Ukuran file foto maksimal 5MB.');
      return;
    }
    setComposerError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      setAttachedImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const sendMessageCore = (
    text: string,
    options?: {
      image?: string;
      messageType?: ChatMessage['messageType'];
      offerAmount?: number;
      counterAmount?: number;
      offerStatus?: OfferStatus;
      convPatch?: Partial<ChatConversation>;
      notifyTitle?: string;
      notifyMessage?: string;
    }
  ) => {
    if (!activeConversation) return;
    const currentConvId = activeConversation.id;
    const role = getRoleInConversation(activeConversation, userProfile);
    const senderType: 'user' | 'store' = role === 'seller' ? 'store' : 'user';
    const nowIso = new Date().toISOString();
    const timeLabel = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      conversationId: currentConvId,
      sender: senderType,
      senderId: userProfile.id,
      senderName: userProfile.name,
      storeId: activeConversation.storeId,
      storeName: activeConversation.storeName,
      text,
      timestamp: timeLabel,
      image: options?.image,
      isRead: false,
      messageType: options?.messageType || (options?.image ? 'image' : 'text'),
      offerAmount: options?.offerAmount,
      counterAmount: options?.counterAmount,
      offerStatus: options?.offerStatus,
      createdAtIso: nowIso,
    };

    const unreadPatch: Partial<ChatConversation> =
      role === 'seller'
        ? {
            buyerUnreadCount: (activeConversation.buyerUnreadCount || 0) + 1,
            sellerUnreadCount: 0,
            unreadCount: (activeConversation.buyerUnreadCount || 0) + 1,
          }
        : {
            sellerUnreadCount: (activeConversation.sellerUnreadCount || 0) + 1,
            buyerUnreadCount: 0,
            unreadCount: (activeConversation.sellerUnreadCount || 0) + 1,
          };

    const convPatch: Partial<ChatConversation> = {
      lastMessage: text.replace(/\n+/g, ' ').slice(0, 200),
      lastTimestamp: 'Baru saja',
      updatedAtIso: nowIso,
      ...unreadPatch,
      ...(options?.convPatch || {}),
    };

    const isDraft =
      draftConversation?.id === currentConvId &&
      !liveConversations.some((c) => c.id === currentConvId);

    setMessagesByConv((prev) => ({
      ...prev,
      [currentConvId]: [...(prev[currentConvId] || []), newMsg],
    }));

    if (isDraft) {
      const persistedConv: ChatConversation = {
        ...activeConversation,
        ...convPatch,
      };
      setLiveConversations((prev) => [
        persistedConv,
        ...prev.filter((c) => c.id !== currentConvId),
      ]);
      setDraftConversation(null);
      void saveConversationInFirestore(persistedConv);
    } else {
      setLiveConversations((prev) =>
        prev.map((c) => (c.id === currentConvId ? { ...c, ...convPatch } : c))
      );
      void updateConversationInFirestore(currentConvId, convPatch);
    }

    void sendChatMessageInFirestore(currentConvId, newMsg);

    if (onNotifyUser) {
      const targetUserId =
        role === 'seller' ? activeConversation.buyerId : activeConversation.sellerId;
      const targetBrand = role === 'buyer' ? activeConversation.storeName : undefined;
      if (targetUserId || targetBrand) {
        onNotifyUser({
          type: 'chat',
          title:
            options?.notifyTitle ||
            `Pesan dari ${role === 'seller' ? activeConversation.storeName : userProfile.name || 'Pembeli'}`,
          message:
            options?.notifyMessage ||
            `${activeConversation.product.name}: ${text.replace(/\n+/g, ' ').slice(0, 140)}`,
          recipientUserId: targetUserId,
          recipientBrandName: targetBrand,
          targetRole: role === 'seller' ? 'buyer' : 'seller',
        });
      }
    }
  };

  // Standard chat send (NO fake auto-reply!)
  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend ?? inputText).trim();
    if (!text && !attachedImage) return;
    if (!activeConversation) return;
    setComposerError(null);

    if (typingClearTimerRef.current) {
      window.clearTimeout(typingClearTimerRef.current);
      typingClearTimerRef.current = null;
    }
    lastTypingSentAtRef.current = 0;
    lastTypingConvRef.current = null;
    void updateTypingStatusInFirestore(activeConversation.id, activeRole, 0);

    sendMessageCore(text || 'Lampiran foto produk', {
      image: attachedImage || undefined,
    });

    setInputText('');
    setAttachedImage(null);
  };

  const handleComposerChange = (nextText: string) => {
    setInputText(nextText);
    if (!activeConversation || !userProfile.isRegistered) return;
    const convId = activeConversation.id;
    const role = activeRole;

    if (!nextText.trim()) {
      if (typingClearTimerRef.current) {
        window.clearTimeout(typingClearTimerRef.current);
        typingClearTimerRef.current = null;
      }
      lastTypingSentAtRef.current = 0;
      void updateTypingStatusInFirestore(convId, role, 0);
      return;
    }

    lastTypingConvRef.current = { convId, role };
    const now = Date.now();
    if (now - lastTypingSentAtRef.current >= 1800) {
      lastTypingSentAtRef.current = now;
      void updateTypingStatusInFirestore(convId, role, now);
    }

    if (typingClearTimerRef.current) {
      window.clearTimeout(typingClearTimerRef.current);
    }
    typingClearTimerRef.current = window.setTimeout(() => {
      lastTypingSentAtRef.current = 0;
      void updateTypingStatusInFirestore(convId, role, 0);
    }, 3500);
  };

  // One-click "Alamat Saya" handler
  const getSavedAddressFields = () => {
    const name = (currentUserAccount?.name || userProfile.name || '').trim();
    const phone = (currentUserAccount?.phone || userProfile.phone || '').trim();
    const city = (currentUserAccount?.buyerProfile?.city || userProfile.buyerProfile?.city || '').trim();
    const address = (currentUserAccount?.buyerProfile?.address || userProfile.buyerProfile?.address || '').trim();
    const postalCode = (currentUserAccount?.buyerProfile?.postalCode || userProfile.buyerProfile?.postalCode || '').trim();
    return { name, phone, city, address, postalCode };
  };

  const formatAddressMessage = (fields: {
    name: string;
    phone: string;
    city: string;
    address: string;
    postalCode?: string;
  }) => {
    const lines = [
      `Penerima: ${fields.name}`,
      `No. HP: ${fields.phone}`,
      `Alamat: ${fields.address}`,
      `Kota: ${fields.city}${fields.postalCode ? ` (${fields.postalCode})` : ''}`,
    ];
    return lines.join('\n');
  };

  const handleClickMyAddress = async () => {
    if (!activeConversation) return;
    const saved = getSavedAddressFields();
    if (saved.name && saved.phone && saved.city && saved.address) {
      const ok = await confirm({
        title: 'Kirim Alamat Lengkap?',
        message: `Anda yakin ingin mengirimkan alamat lengkap (${saved.address}, ${saved.city})?`,
        confirmLabel: 'Kirim Alamat',
        cancelLabel: 'Batal',
      });
      if (!ok) return;

      const formatted = formatAddressMessage(saved);
      sendMessageCore(formatted, {
        messageType: 'address',
        convPatch: {
          buyerPhone: saved.phone,
          buyerCity: `${saved.city}${saved.postalCode ? ` (${saved.postalCode})` : ''}`,
          buyerAddress: saved.address,
        },
        notifyTitle: `${saved.name} mengirim alamat`,
        notifyMessage: `${activeConversation.product.name}: ${saved.city}`,
      });
    } else {
      setAddrName(saved.name);
      setAddrPhone(saved.phone);
      setAddrCity(saved.city);
      setAddrPostalCode(saved.postalCode);
      setAddrFull(saved.address);
      setIsAddressModalOpen(true);
    }
  };

  const handleSaveAndSendAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addrName.trim() || !addrPhone.trim() || !addrCity.trim() || !addrFull.trim()) return;
    setAddrSaving(true);
    try {
      const payload = {
        name: addrName.trim(),
        phone: addrPhone.trim(),
        city: addrCity.trim(),
        address: addrFull.trim(),
        postalCode: addrPostalCode.trim() || undefined,
      };
      if (onUpdateUserAddress) {
        await onUpdateUserAddress(payload);
      }
      setIsAddressModalOpen(false);
      const formatted = formatAddressMessage(payload);
      sendMessageCore(formatted, {
        messageType: 'address',
        convPatch: {
          buyerPhone: payload.phone,
          buyerCity: `${payload.city}${payload.postalCode ? ` (${payload.postalCode})` : ''}`,
          buyerAddress: payload.address,
        },
        notifyTitle: `${payload.name} mengirim alamat`,
        notifyMessage: `${activeConversation?.product.name || 'Produk'}: ${payload.city}`,
      });
    } finally {
      setAddrSaving(false);
    }
  };

  // Buyer submits offer -> ALWAYS 'pending' until seller accepts/rejects/counters
  const handleMakeOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    const offeredNum = Number(offerPriceInput.replace(/\D/g, ''));
    if (!offeredNum || offeredNum <= 0 || !activeConversation) return;
    if (activeRole !== 'buyer') return;

    const ok = await confirm({
      title: 'Ajukan Tawaran Harga',
      message: `Kirim tawaran Rp ${offeredNum.toLocaleString('id-ID')} untuk "${activeConversation.product.name}"? Penjual akan memutuskan menerima, menolak, atau memberi harga balasan.`,
      confirmLabel: 'Kirim Tawaran',
    });
    if (!ok) return;

    sendMessageCore(`Menawar Rp ${offeredNum.toLocaleString('id-ID')}`, {
      messageType: 'offer',
      offerAmount: offeredNum,
      offerStatus: 'pending',
      convPatch: {
        offerStatus: 'pending',
        offeredPrice: offeredNum,
        offerUpdatedBy: 'buyer',
      },
      notifyTitle: `Tawaran Masuk Rp ${offeredNum.toLocaleString('id-ID')}`,
      notifyMessage: `${userProfile.name || 'Pembeli'} menawar "${activeConversation.product.name}". Buka chat untuk merespons.`,
    });

    setIsOfferOpen(false);
    setOfferPriceInput('');
  };

  // Seller accepts or rejects buyer's pending offer
  const handleSellerRespondOffer = async (decision: 'accepted' | 'rejected') => {
    if (!activeConversation || activeRole !== 'seller') return;
    const price = activeConversation.offeredPrice || activeConversation.product.price;

    const ok = await confirm({
      title: decision === 'accepted' ? 'Terima Tawaran' : 'Tolak Tawaran',
      message: `${decision === 'accepted' ? 'Setujui' : 'Tolak'} tawaran Rp ${price.toLocaleString('id-ID')} untuk "${activeConversation.product.name}"?`,
      confirmLabel: decision === 'accepted' ? 'Terima' : 'Tolak',
      tone: decision === 'rejected' ? 'warning' : 'default',
    });
    if (!ok) return;

    // Update any pending offer message card in this conversation
    const pendingMsgs = activeMessages.filter(
      (m) => m.messageType === 'offer' && m.offerStatus === 'pending'
    );
    pendingMsgs.forEach((m) => {
      void updateChatMessageOfferStatusInFirestore(activeConversation.id, m.id, decision);
    });
    setMessagesByConv((prev) => ({
      ...prev,
      [activeConversation.id]: (prev[activeConversation.id] || []).map((m) =>
        m.messageType === 'offer' && m.offerStatus === 'pending'
          ? { ...m, offerStatus: decision }
          : m
      ),
    }));

    const text =
      decision === 'accepted'
        ? `Tawaran Rp ${price.toLocaleString('id-ID')} disetujui! Silakan kirim alamat via tombol "Alamat Saya" atau catat deal.`
        : `Maaf kak, tawaran Rp ${price.toLocaleString('id-ID')} belum bisa dilepas. Silakan ajukan penawaran baru ya.`;

    sendMessageCore(text, {
      messageType: 'offer_response',
      offerAmount: price,
      offerStatus: decision,
      convPatch: {
        offerStatus: decision,
        offeredPrice: price,
        offerUpdatedBy: 'seller',
      },
      notifyTitle:
        decision === 'accepted'
          ? `Tawaran Disetujui (Rp ${price.toLocaleString('id-ID')})`
          : 'Tawaran Ditolak Penjual',
      notifyMessage: `${activeConversation.storeName}: ${activeConversation.product.name}`,
    });
  };

  // Seller sends Counter-Offer price
  const handleSubmitCounterOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversation || activeRole !== 'seller') return;
    const counterNum = Number(counterPriceInput.replace(/\D/g, ''));
    if (!counterNum || counterNum <= 0) return;

    const ok = await confirm({
      title: 'Kirim Harga Balasan',
      message: `Ajukan harga balasan Rp ${counterNum.toLocaleString('id-ID')} ke pembeli?`,
      confirmLabel: 'Kirim Balasan',
    });
    if (!ok) return;

    const pendingMsgs = activeMessages.filter(
      (m) => m.messageType === 'offer' && m.offerStatus === 'pending'
    );
    pendingMsgs.forEach((m) => {
      void updateChatMessageOfferStatusInFirestore(activeConversation.id, m.id, 'countered');
    });
    setMessagesByConv((prev) => ({
      ...prev,
      [activeConversation.id]: (prev[activeConversation.id] || []).map((m) =>
        m.messageType === 'offer' && m.offerStatus === 'pending'
          ? { ...m, offerStatus: 'countered' }
          : m
      ),
    }));

    sendMessageCore(`Menawarkan harga balasan Rp ${counterNum.toLocaleString('id-ID')}`, {
      messageType: 'counter_offer',
      counterAmount: counterNum,
      offerStatus: 'countered',
      convPatch: {
        offerStatus: 'countered',
        counterPrice: counterNum,
        offerUpdatedBy: 'seller',
      },
      notifyTitle: `Harga Balasan Rp ${counterNum.toLocaleString('id-ID')}`,
      notifyMessage: `${activeConversation.storeName} membalas tawaran Anda untuk ${activeConversation.product.name}.`,
    });

    setIsCounterOpen(false);
    setCounterPriceInput('');
  };

  // Buyer agrees to seller's counter-offer
  const handleBuyerAcceptCounter = async () => {
    if (!activeConversation || activeRole !== 'buyer' || !activeConversation.counterPrice) return;
    const agreedPrice = activeConversation.counterPrice;

    const ok = await confirm({
      title: 'Setujui Harga Balasan',
      message: `Sepakati harga Rp ${agreedPrice.toLocaleString('id-ID')} untuk "${activeConversation.product.name}"?`,
      confirmLabel: 'Setuju Deal',
    });
    if (!ok) return;

    const counteredMsgs = activeMessages.filter(
      (m) => m.messageType === 'counter_offer' && m.offerStatus === 'countered'
    );
    counteredMsgs.forEach((m) => {
      void updateChatMessageOfferStatusInFirestore(activeConversation.id, m.id, 'accepted');
    });
    setMessagesByConv((prev) => ({
      ...prev,
      [activeConversation.id]: (prev[activeConversation.id] || []).map((m) =>
        m.messageType === 'counter_offer' && m.offerStatus === 'countered'
          ? { ...m, offerStatus: 'accepted' }
          : m
      ),
    }));

    sendMessageCore(`Deal disepakati di harga Rp ${agreedPrice.toLocaleString('id-ID')}!`, {
      messageType: 'offer_response',
      offerAmount: agreedPrice,
      offerStatus: 'accepted',
      convPatch: {
        offerStatus: 'accepted',
        offeredPrice: agreedPrice,
        offerUpdatedBy: 'buyer',
      },
      notifyTitle: `Harga Deal Disetujui (Rp ${agreedPrice.toLocaleString('id-ID')})`,
      notifyMessage: `${userProfile.name || 'Pembeli'} menyetujui harga Rp ${agreedPrice.toLocaleString('id-ID')} untuk ${activeConversation.product.name}.`,
    });
  };

  const parseAddressFromMessages = (msgs: ChatMessage[]) => {
    const latestAddrMsg = [...msgs]
      .reverse()
      .find((m) => m.messageType === 'address' && m.text);
    let parsedName = '';
    let parsedPhone = '';
    let parsedCity = '';
    let parsedAddr = '';

    if (latestAddrMsg) {
      latestAddrMsg.text.split('\n').forEach((line) => {
        if (line.startsWith('Penerima:')) parsedName = line.replace('Penerima:', '').trim();
        else if (line.startsWith('No. HP:')) parsedPhone = line.replace('No. HP:', '').trim();
        else if (line.startsWith('Alamat:')) parsedAddr = line.replace('Alamat:', '').trim();
        else if (line.startsWith('Kota:')) parsedCity = line.replace('Kota:', '').trim();
      });
    }

    return { parsedName, parsedPhone, parsedCity, parsedAddr };
  };

  // Keep Deal modal fields auto-hydrated if buyer shares Alamat Saya or remote buyer profile loads
  useEffect(() => {
    if (!isDealModalOpen || !activeConversation) return;
    const { parsedName, parsedPhone, parsedCity, parsedAddr } = parseAddressFromMessages(activeMessages);

    if (activeRole === 'buyer') {
      const saved = getSavedAddressFields();
      setDealBuyerName((curr) => curr || saved.name || parsedName || userProfile.name || '');
      setDealBuyerPhone((curr) => curr || saved.phone || parsedPhone || activeConversation.buyerPhone || userProfile.phone || '');
      setDealBuyerCity((curr) => curr || saved.city || parsedCity || activeConversation.buyerCity || '');
      setDealBuyerAddress((curr) => curr || saved.address || parsedAddr || activeConversation.buyerAddress || '');
      return;
    }

    const localBuyer = activeConversation.buyerId
      ? getAllUsersFromDb().find((u) => u.id === activeConversation.buyerId)
      : undefined;

    setDealBuyerName((curr) => curr || parsedName || activeConversation.buyerName || localBuyer?.name || '');
    setDealBuyerPhone((curr) => curr || parsedPhone || activeConversation.buyerPhone || localBuyer?.phone || '');
    setDealBuyerCity((curr) => curr || parsedCity || activeConversation.buyerCity || localBuyer?.buyerProfile?.city || '');
    setDealBuyerAddress((curr) => curr || parsedAddr || activeConversation.buyerAddress || localBuyer?.buyerProfile?.address || '');
  }, [isDealModalOpen, activeConversation, activeMessages, activeRole]);

  // Open Catat Deal dialog with full auto-fill from Alamat Saya / conversation / buyer profile
  const handleOpenDealModal = () => {
    if (!activeConversation) return;
    const { parsedName, parsedPhone, parsedCity, parsedAddr } = parseAddressFromMessages(activeMessages);
    const saved = getSavedAddressFields();

    if (activeRole === 'buyer') {
      setDealBuyerName(saved.name || parsedName || userProfile.name || '');
      setDealBuyerPhone(saved.phone || parsedPhone || activeConversation.buyerPhone || userProfile.phone || '');
      setDealBuyerCity(saved.city || parsedCity || activeConversation.buyerCity || '');
      setDealBuyerAddress(saved.address || parsedAddr || activeConversation.buyerAddress || '');
    } else {
      const localBuyer = activeConversation.buyerId
        ? getAllUsersFromDb().find((u) => u.id === activeConversation.buyerId)
        : undefined;

      const initName = parsedName || activeConversation.buyerName || localBuyer?.name || '';
      const initPhone = parsedPhone || activeConversation.buyerPhone || localBuyer?.phone || '';
      const initCity = parsedCity || activeConversation.buyerCity || localBuyer?.buyerProfile?.city || '';
      const initAddress = parsedAddr || activeConversation.buyerAddress || localBuyer?.buyerProfile?.address || '';

      setDealBuyerName(initName);
      setDealBuyerPhone(initPhone);
      setDealBuyerCity(initCity);
      setDealBuyerAddress(initAddress);

      if ((!initPhone || !initCity || !initAddress) && activeConversation.buyerId) {
        void fetchUserByIdFromFirestore(activeConversation.buyerId).then((remoteBuyer) => {
          if (!remoteBuyer) return;
          setDealBuyerName((curr) => curr || remoteBuyer.name || '');
          setDealBuyerPhone((curr) => curr || remoteBuyer.phone || '');
          setDealBuyerCity((curr) => curr || remoteBuyer.buyerProfile?.city || '');
          setDealBuyerAddress((curr) => curr || remoteBuyer.buyerProfile?.address || '');
        });
      }
    }
    setDealPaymentMethod('transfer_langsung');
    setDealCourier('Kurir Reguler (JNE / J&T / SiCepat)');
    setIsDealModalOpen(true);
  };

  const handleSubmitDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversation || !onCreateChatDeal) return;
    if (!dealBuyerName.trim() || !dealBuyerPhone.trim() || !dealBuyerCity.trim() || !dealBuyerAddress.trim()) {
      return;
    }

    const dealPrice = activeConversation.offeredPrice || activeConversation.product.price;
    const resolvedBuyerId =
      activeConversation.buyerId || (activeRole === 'buyer' ? userProfile.id : undefined);
    const resolvedBuyerEmail = activeRole === 'buyer' ? userProfile.email : undefined;

    setIsSubmittingDeal(true);
    try {
      const orderNum = await onCreateChatDeal({
        productId: activeConversation.product.id,
        sellerId: activeConversation.sellerId || activeConversation.product.sellerId,
        buyerId: resolvedBuyerId,
        buyerEmail: resolvedBuyerEmail,
        storeName: activeConversation.storeName,
        price: dealPrice,
        paymentMethod: dealPaymentMethod,
        courier: dealPaymentMethod === 'cod' ? 'COD / Ketemuan Langsung' : dealCourier,
        buyerName: dealBuyerName.trim(),
        buyerPhone: dealBuyerPhone.trim(),
        buyerCity: dealBuyerCity.trim(),
        buyerAddress: dealBuyerAddress.trim(),
        convId: activeConversation.id,
      });

      const methodLabel = dealPaymentMethod === 'cod' ? 'COD / Ketemuan' : 'Transfer Langsung';
      const summary = [
        `Deal Tercatat ${orderNum ? `(${orderNum})` : ''}`.trim(),
        `Harga Deal: Rp ${dealPrice.toLocaleString('id-ID')}`,
        `Metode: ${methodLabel}`,
        `Penerima: ${dealBuyerName.trim()} (${dealBuyerCity.trim()})`,
      ].join('\n');

      sendMessageCore(summary, {
        messageType: 'deal',
        offerAmount: dealPrice,
        convPatch: {
          dealOrderId: orderNum || `deal-${Date.now()}`,
        },
        notifyTitle: `Deal Tercatat ${orderNum ? `(${orderNum})` : ''}`,
        notifyMessage: `${activeConversation.product.name} · Rp ${dealPrice.toLocaleString('id-ID')} (${methodLabel})`,
      });

      setIsDealModalOpen(false);
    } finally {
      setIsSubmittingDeal(false);
    }
  };

  const setQuickDiscount = (pct: number) => {
    if (!activeConversation) return;
    const base = activeConversation.product.price;
    const discounted = Math.round(base * (1 - pct / 100));
    setOfferPriceInput(discounted.toLocaleString('id-ID'));
  };

  const handleCopyText = async (msgId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMsgId(msgId);
      window.setTimeout(() => {
        setCopiedMsgId((curr) => (curr === msgId ? null : curr));
      }, 2000);
    } catch {}
  };

  const activeCounterpartyName = activeConversation
    ? activeRole === 'seller'
      ? activeConversation.buyerName || 'Pembeli'
      : activeConversation.storeName
    : '';
  const activeCounterpartyAvatar = activeConversation
    ? activeRole === 'seller'
      ? (activeConversation.buyerName || 'P').slice(0, 2).toUpperCase()
      : activeConversation.storeAvatar || activeConversation.storeName.slice(0, 2).toUpperCase()
    : 'AR';

  const activeCounterpartyId = activeConversation
    ? activeRole === 'seller'
      ? activeConversation.buyerId
      : activeConversation.sellerId || activeConversation.product?.sellerId
    : undefined;

  const activePresenceInfo = useMemo(() => {
    const entry = activeCounterpartyId ? presenceMap[activeCounterpartyId] : undefined;
    return formatPresenceLabel(entry, nowMs);
  }, [activeCounterpartyId, presenceMap, nowMs]);

  const isActiveProductSoldOut =
    activeFullProduct?.listingStatus === 'sold' ||
    (activeFullProduct !== undefined && activeFullProduct.stock <= 0) ||
    activeConversation?.itemStatus === 'Sold Out';

  const agreedOrOriginalPrice = activeConversation
    ? activeConversation.offeredPrice || activeConversation.product.price
    : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="chat-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={AROOS_BACKDROP_TRANSITION}
          className="fixed inset-0 z-50 overflow-hidden bg-neutral-950/60 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4 select-none"
          onClick={onClose}
        >
          <motion.div
            key="chat-modal-panel"
            variants={AROOS_MODAL_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={AROOS_MODAL_TRANSITION}
            className="relative bg-white text-neutral-900 w-full max-w-5xl h-[100dvh] sm:h-[86vh] sm:rounded-3xl shadow-2xl overflow-hidden border border-neutral-200/90 flex flex-col font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-1 flex overflow-hidden">
              {/* LEFT COLUMN: INBOX */}
              <div
                className={`w-full sm:w-[360px] md:w-[380px] bg-neutral-50/70 border-r border-neutral-200/80 flex flex-col shrink-0 ${
                  mobileView === 'chat' ? 'hidden sm:flex' : 'flex'
                }`}
              >
                {/* Inbox Header */}
                <div className="p-4 sm:p-5 bg-white border-b border-neutral-200/80 flex items-center justify-between gap-2 shrink-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base sm:text-lg font-bold tracking-tight text-neutral-900">
                        Chat &amp; Negosiasi
                      </h2>
                      {totalUnreadCount > 0 ? (
                        <span className="px-2 py-0.5 bg-red-600 text-white rounded-full text-[10px] font-bold tabular-nums whitespace-nowrap">
                          {totalUnreadCount} baru
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded-full text-[11px] font-semibold tabular-nums">
                          {conversations.length}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Transaksi langsung pembeli &amp; penjual
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {totalUnreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllAsRead}
                        className="px-2.5 py-1 text-[11px] font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-full transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Baca semua
                      </button>
                    )}
                    <button
                      onClick={onClose}
                      className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-full transition-colors cursor-pointer sm:hidden"
                      aria-label="Tutup"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Search + Role Tabs + Unread Toggle */}
                <div className="p-3 bg-white/80 border-b border-neutral-200/60 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                      <input
                        type="text"
                        value={inboxSearch}
                        onChange={(e) => setInboxSearch(e.target.value)}
                        placeholder="Cari toko, pembeli, produk..."
                        className="w-full bg-neutral-100/80 hover:bg-neutral-100 focus:bg-white text-xs text-neutral-900 pl-8 pr-3 py-2 rounded-xl placeholder:text-neutral-400 border border-transparent focus:border-neutral-300 focus:outline-none transition-all"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setOnlyUnread((prev) => !prev)}
                      className={`px-2.5 py-2 rounded-xl text-[11px] font-semibold border transition-all cursor-pointer whitespace-nowrap tabular-nums shrink-0 ${
                        onlyUnread
                          ? 'bg-red-600 text-white border-red-600'
                          : 'bg-neutral-100/80 text-neutral-600 border-transparent hover:bg-neutral-200/70'
                      }`}
                      title="Filter belum dibaca"
                    >
                      Belum dibaca{totalUnreadCount > 0 ? ` (${totalUnreadCount})` : ''}
                    </button>
                  </div>

                  {/* Role Tabs: Semua, Pembelian, Penjualan */}
                  <div className="grid grid-cols-3 gap-1 p-1 bg-neutral-100 rounded-xl border border-neutral-200/70">
                    <button
                      type="button"
                      onClick={() => setInboxRoleTab('all')}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap tabular-nums ${
                        inboxRoleTab === 'all'
                          ? 'bg-white text-neutral-900 shadow-2xs'
                          : 'text-neutral-500 hover:text-neutral-800'
                      }`}
                    >
                      Semua ({conversations.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setInboxRoleTab('buying')}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap tabular-nums ${
                        inboxRoleTab === 'buying'
                          ? 'bg-white text-neutral-900 shadow-2xs'
                          : 'text-neutral-500 hover:text-neutral-800'
                      }`}
                    >
                      Pembelian ({buyingCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setInboxRoleTab('selling')}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap tabular-nums ${
                        inboxRoleTab === 'selling'
                          ? 'bg-white text-neutral-900 shadow-2xs'
                          : 'text-neutral-500 hover:text-neutral-800'
                      }`}
                    >
                      Penjualan ({sellingCount})
                    </button>
                  </div>
                </div>

                {/* Conversation List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5 relative">
                  {filteredConversations.length === 0 ? (
                    <div className="p-8 text-center text-xs text-neutral-400 space-y-2">
                      <p>
                        {onlyUnread
                          ? 'Semua pesan sudah dibaca.'
                          : inboxRoleTab === 'selling'
                            ? 'Belum ada pesan masuk dari pembeli untuk listing Anda.'
                            : inboxRoleTab === 'buying'
                              ? 'Belum ada chat ke penjual.'
                              : 'Belum ada percakapan di inbox.'}
                      </p>
                      {(onlyUnread || inboxRoleTab !== 'all') && (
                        <button
                          type="button"
                          onClick={() => {
                            setOnlyUnread(false);
                            setInboxRoleTab('all');
                          }}
                          className="text-neutral-700 font-semibold underline underline-offset-4 cursor-pointer"
                        >
                          Lihat Semua Percakapan
                        </button>
                      )}
                    </div>
                  ) : (
                    <AnimatePresence initial={false}>
                      {filteredConversations.map((conv) => {
                        const r = getRoleInConversation(conv, userProfile);
                        const unread = getEffectiveUnreadCount(conv);
                        const rowCounterpartyId =
                          r === 'seller' ? conv.buyerId : conv.sellerId || conv.product?.sellerId;
                        const rowPresence = formatPresenceLabel(
                          rowCounterpartyId ? presenceMap[rowCounterpartyId] : undefined,
                          nowMs
                        );
                        const rowTypingAt = r === 'seller' ? conv.buyerTypingAt : conv.sellerTypingAt;
                        const rowIsTyping = Boolean(rowTypingAt && nowMs - rowTypingAt <= 4500);
                        return (
                          <SwipeableConversationRow
                            key={conv.id}
                            conv={conv}
                            role={r}
                            unreadCount={unread}
                            isActive={conv.id === activeConversation?.id}
                            isCounterpartyOnline={rowPresence.isOnline}
                            isCounterpartyTyping={rowIsTyping}
                            onSelect={() => {
                              skipAutoReadConvIdRef.current = null;
                              setActiveConvId(conv.id);
                              setMobileView('chat');
                              if (unread > 0) {
                                const patch: Partial<ChatConversation> =
                                  r === 'seller'
                                    ? { sellerUnreadCount: 0, unreadCount: 0 }
                                    : { buyerUnreadCount: 0, unreadCount: 0 };
                                setLiveConversations((prev) =>
                                  prev.map((c) => (c.id === conv.id ? { ...c, ...patch } : c))
                                );
                                void updateConversationInFirestore(conv.id, patch, conv);
                              }
                            }}
                            onTogglePin={() => handleTogglePin(conv.id)}
                            onRemove={() => handleRemoveConversation(conv.id)}
                          />
                        );
                      })}
                    </AnimatePresence>
                  )}

                  {filteredConversations.length > 0 && (
                    <p className="text-[10px] text-neutral-400 text-center pt-2 pb-1">
                      Geser kanan untuk pin · Geser kiri untuk hapus
                    </p>
                  )}
                </div>

                <AnimatePresence>
                  {lastRemovedChat && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 12 }}
                      className="mx-2.5 mb-2.5 px-3.5 py-2.5 bg-neutral-900 text-white rounded-2xl shadow-lg flex items-center justify-between gap-2 text-xs shrink-0"
                    >
                      <span className="truncate text-neutral-200">
                        Chat <strong className="text-white">{lastRemovedChat.conv.product.name}</strong> dihapus
                      </span>
                      <button
                        type="button"
                        onClick={handleUndoRemove}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-neutral-900 hover:bg-neutral-100 rounded-full text-[11px] font-bold shrink-0 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Urungkan</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* RIGHT COLUMN: ACTIVE CHAT ROOM */}
              <div
                className={`flex-1 bg-white flex flex-col min-w-0 ${
                  mobileView === 'inbox' ? 'hidden sm:flex' : 'flex'
                }`}
              >
                {activeConversation ? (
                  <>
                    {/* Top Bar: Counterparty Header with Live Presence & Report */}
                    <div className="px-3.5 sm:px-4 py-3 bg-white border-b border-neutral-200/80 flex items-center justify-between gap-2 shrink-0">
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => setMobileView('inbox')}
                          className="p-1.5 -ml-1 text-neutral-500 hover:text-neutral-900 rounded-xl hover:bg-neutral-100 sm:hidden cursor-pointer"
                          aria-label="Kembali ke Inbox"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>

                        <div className="relative shrink-0">
                          <div className="w-9 h-9 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs">
                            {activeCounterpartyAvatar}
                          </div>
                          {activePresenceInfo.isOnline && (
                            <span
                              aria-label="Aktif sekarang"
                              className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white"
                            />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            {activeRole === 'buyer' && onOpenStore ? (
                              <button
                                type="button"
                                onClick={() => {
                                  onClose();
                                  onOpenStore(
                                    activeConversation.storeName,
                                    activeConversation.sellerId || activeConversation.product?.sellerId
                                  );
                                }}
                                className="font-bold text-xs sm:text-sm text-neutral-900 hover:underline underline-offset-2 truncate cursor-pointer text-left"
                              >
                                {activeCounterpartyName}
                              </button>
                            ) : (
                              <h3 className="font-bold text-xs sm:text-sm text-neutral-900 truncate">
                                {activeCounterpartyName}
                              </h3>
                            )}
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 shrink-0">
                              {activeRole === 'seller' ? 'Pembeli' : 'Penjual'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] leading-tight">
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                activePresenceInfo.isOnline ? 'bg-emerald-500' : 'bg-neutral-300'
                              }`}
                            />
                            <span
                              className={`truncate ${
                                activePresenceInfo.isOnline
                                  ? 'text-emerald-700 font-semibold'
                                  : 'text-neutral-500 font-medium'
                              }`}
                            >
                              {activePresenceInfo.label}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {onReportUser && (
                          <button
                            type="button"
                            onClick={() =>
                              onReportUser({
                                reportedUserId: activeCounterpartyId || activeCounterpartyName,
                                reportedUserName: activeCounterpartyName,
                                source: 'chat',
                                targetProductId: activeConversation.product.id,
                                targetProductName: activeConversation.product.name,
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors cursor-pointer whitespace-nowrap"
                            title="Laporkan Pengguna"
                            aria-label="Laporkan Pengguna"
                          >
                            <Flag className="w-3.5 h-3.5 shrink-0" />
                            <span className="hidden md:inline">Laporkan</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleTogglePin(activeConversation.id)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-full transition-colors cursor-pointer whitespace-nowrap ${
                            activeConversation.isPinned
                              ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                              : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
                          }`}
                          title={activeConversation.isPinned ? 'Lepas Pin' : 'Pin Percakapan'}
                        >
                          {activeConversation.isPinned ? (
                            <>
                              <PinOff className="w-3.5 h-3.5 shrink-0" />
                              <span className="hidden md:inline">Lepas Pin</span>
                            </>
                          ) : (
                            <>
                              <Pin className="w-3.5 h-3.5 shrink-0" />
                              <span className="hidden md:inline">Pin</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMarkAsUnread(activeConversation.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-full transition-colors cursor-pointer whitespace-nowrap"
                          title="Tandai Belum Dibaca"
                        >
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          <span className="hidden md:inline">Belum Dibaca</span>
                        </button>
                        <button
                          type="button"
                          onClick={onClose}
                          className="p-2 text-neutral-400 hover:text-neutral-800 rounded-full hover:bg-neutral-100 transition-colors cursor-pointer"
                          aria-label="Tutup"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* CLEAN RESPONSIVE ITEM DISKUSI SECTION (Mobile & Desktop) */}
                    <div className="px-3.5 sm:px-4 py-3 bg-neutral-50/90 border-b border-neutral-200/80 space-y-2.5 shrink-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-neutral-200 border border-neutral-200 shrink-0 shadow-2xs">
                          <img
                            src={activeConversation.product.image}
                            alt=""
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          {(activeConversation.dealOrderId ||
                            activeConversation.offerStatus === 'accepted' ||
                            (activeConversation.offerStatus === 'countered' && activeConversation.counterPrice) ||
                            (activeConversation.offerStatus === 'pending' && activeConversation.offeredPrice) ||
                            activeConversation.offerStatus === 'rejected') && (
                            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                              {activeConversation.dealOrderId ? (
                                <span className="text-[10px] font-semibold text-emerald-700 whitespace-nowrap">
                                  Deal Tercatat
                                </span>
                              ) : activeConversation.offerStatus === 'accepted' ? (
                                <span className="text-[10px] font-semibold text-emerald-700 whitespace-nowrap">
                                  Tawaran Disetujui
                                </span>
                              ) : activeConversation.offerStatus === 'countered' && activeConversation.counterPrice ? (
                                <span className="text-[10px] font-semibold text-blue-700 whitespace-nowrap tabular-nums">
                                  Balasan Rp {activeConversation.counterPrice.toLocaleString('id-ID')}
                                </span>
                              ) : activeConversation.offerStatus === 'pending' && activeConversation.offeredPrice ? (
                                <span className="text-[10px] font-semibold text-amber-700 whitespace-nowrap tabular-nums">
                                  Tawaran Rp {activeConversation.offeredPrice.toLocaleString('id-ID')}
                                </span>
                              ) : activeConversation.offerStatus === 'rejected' ? (
                                <span className="text-[10px] font-semibold text-neutral-500 whitespace-nowrap">
                                  Tawaran Ditolak
                                </span>
                              ) : null}
                            </div>
                          )}

                          <h4 className="text-xs sm:text-sm font-bold text-neutral-900 truncate leading-snug">
                            {activeConversation.product.name}
                          </h4>

                          <div className="flex items-center gap-2 text-xs mt-0.5 tabular-nums flex-wrap">
                            {activeConversation.offerStatus === 'accepted' && activeConversation.offeredPrice ? (
                              <>
                                <span className="text-neutral-400 line-through text-[11px] whitespace-nowrap">
                                  Rp {activeConversation.product.price.toLocaleString('id-ID')}
                                </span>
                                <span className="text-emerald-700 font-bold whitespace-nowrap">
                                  Rp {activeConversation.offeredPrice.toLocaleString('id-ID')}
                                </span>
                              </>
                            ) : activeConversation.offerStatus === 'countered' && activeConversation.counterPrice ? (
                              <>
                                <span className="text-neutral-400 line-through text-[11px] whitespace-nowrap">
                                  Rp {activeConversation.product.price.toLocaleString('id-ID')}
                                </span>
                                <span className="text-blue-700 font-bold whitespace-nowrap">
                                  Rp {activeConversation.counterPrice.toLocaleString('id-ID')}
                                </span>
                              </>
                            ) : (
                              <span className="text-neutral-900 font-bold whitespace-nowrap">
                                Rp {activeConversation.product.price.toLocaleString('id-ID')}
                              </span>
                            )}
                          </div>
                        </div>

                        {onSelectProduct && (
                          <button
                            type="button"
                            onClick={() => onSelectProduct(activeConversation.product.id)}
                            className="w-9 h-9 flex items-center justify-center text-neutral-500 hover:text-neutral-900 bg-white border border-neutral-200/80 hover:border-neutral-300 rounded-xl transition-colors cursor-pointer shrink-0 shadow-2xs"
                            title="Lihat Detail Produk"
                            aria-label="Lihat Detail Produk"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Clean Compact Action Bar: Role-Aware (Buyer vs Seller) */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {activeRole === 'buyer' ? (
                          <>
                            {activeConversation.dealOrderId ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-semibold">
                                <Handshake className="w-3 h-3" />
                                <span>Deal Sudah Tercatat di Pesanan</span>
                              </span>
                            ) : activeConversation.offerStatus === 'accepted' && activeConversation.offeredPrice ? (
                              <>
                                {onCreateChatDeal && !isActiveProductSoldOut && (
                                  <button
                                    type="button"
                                    onClick={handleOpenDealModal}
                                    className="flex-1 sm:flex-initial h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold rounded-lg transition-all active:scale-95 cursor-pointer shadow-xs inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                                  >
                                    <Handshake className="w-3.5 h-3.5" />
                                    <span>Catat Deal (Rp {activeConversation.offeredPrice.toLocaleString('id-ID')})</span>
                                  </button>
                                )}
                              </>
                            ) : activeConversation.offerStatus === 'countered' && activeConversation.counterPrice ? (
                              <>
                                <button
                                  type="button"
                                  onClick={handleBuyerAcceptCounter}
                                  className="flex-1 sm:flex-initial h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold rounded-lg transition-all active:scale-95 cursor-pointer shadow-xs inline-flex items-center justify-center gap-1 whitespace-nowrap"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Setuju Rp {activeConversation.counterPrice.toLocaleString('id-ID')}</span>
                                </button>
                                {!isActiveProductSoldOut && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOfferPriceInput(String(activeConversation.counterPrice || activeConversation.product.price));
                                      setIsOfferOpen(true);
                                    }}
                                    className="h-8 px-3 bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-200 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                                  >
                                    Tawar Ulang
                                  </button>
                                )}
                              </>
                            ) : activeConversation.offerStatus === 'pending' ? (
                              <>
                                <span className="inline-flex items-center gap-1.5 h-8 px-2.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-semibold">
                                  <Clock className="w-3 h-3" />
                                  <span>Menunggu respons penjual</span>
                                </span>
                                {!isActiveProductSoldOut && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOfferPriceInput(
                                        String(activeConversation.offeredPrice || activeConversation.product.price)
                                      );
                                      setIsOfferOpen(true);
                                    }}
                                    className="h-8 px-2.5 bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-200 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                                  >
                                    Ubah Tawaran
                                  </button>
                                )}
                              </>
                            ) : (
                              !isActiveProductSoldOut && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOfferPriceInput(String(activeConversation.product.price));
                                    setIsOfferOpen(true);
                                  }}
                                  className="w-full sm:w-auto h-8 px-3.5 bg-neutral-900 hover:bg-neutral-800 text-white text-[11px] font-semibold rounded-lg transition-all active:scale-95 cursor-pointer shadow-xs inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                                >
                                  <Tag className="w-3 h-3" />
                                  <span>Ajukan Tawaran</span>
                                </button>
                              )
                            )}
                          </>
                        ) : (
                          /* SELLER ACTIONS (Compact Grid on Mobile, Inline on Desktop) */
                          <>
                            {activeConversation.offerStatus === 'pending' && (
                              <div className="grid grid-cols-3 sm:flex items-center gap-1.5 w-full sm:w-auto">
                                <button
                                  type="button"
                                  onClick={() => handleSellerRespondOffer('accepted')}
                                  className="h-8 px-2 sm:px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold rounded-lg cursor-pointer inline-flex items-center justify-center gap-1 whitespace-nowrap shadow-xs transition-colors"
                                >
                                  <Check className="w-3 h-3 shrink-0" />
                                  <span>Terima</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCounterPriceInput(
                                      String(
                                        Math.round(
                                          ((activeConversation.offeredPrice || activeConversation.product.price) +
                                            activeConversation.product.price) /
                                            2
                                        )
                                      )
                                    );
                                    setIsCounterOpen(true);
                                  }}
                                  className="h-8 px-2 sm:px-3 bg-neutral-900 hover:bg-neutral-800 text-white text-[11px] font-semibold rounded-lg cursor-pointer inline-flex items-center justify-center gap-1 whitespace-nowrap shadow-xs transition-colors"
                                >
                                  <Tag className="w-3 h-3 shrink-0" />
                                  <span className="truncate">Harga Balasan</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSellerRespondOffer('rejected')}
                                  className="h-8 px-2 sm:px-3 bg-white hover:bg-red-50 text-red-600 border border-red-200 text-[11px] font-semibold rounded-lg cursor-pointer inline-flex items-center justify-center gap-1 whitespace-nowrap transition-colors"
                                >
                                  <XCircle className="w-3 h-3 shrink-0" />
                                  <span>Tolak</span>
                                </button>
                              </div>
                            )}

                            {activeConversation.offerStatus === 'countered' && activeConversation.counterPrice && (
                              <span className="inline-flex items-center gap-1.5 h-8 px-2.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-semibold">
                                <Clock className="w-3 h-3 shrink-0" />
                                <span>Menunggu pembeli setujui Rp {activeConversation.counterPrice.toLocaleString('id-ID')}</span>
                              </span>
                            )}

                            {activeConversation.dealOrderId ? (
                              <span className="inline-flex items-center gap-1.5 h-8 px-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-semibold">
                                <Handshake className="w-3 h-3 shrink-0" />
                                <span>Deal Tercatat</span>
                              </span>
                            ) : (
                              <>
                                {activeConversation.offerStatus === 'accepted' && onCreateChatDeal && !isActiveProductSoldOut && (
                                  <button
                                    type="button"
                                    onClick={handleOpenDealModal}
                                    className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold rounded-lg transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap shadow-xs"
                                  >
                                    <Handshake className="w-3.5 h-3.5 shrink-0" />
                                    <span>Catat Deal (Rp {agreedOrOriginalPrice.toLocaleString('id-ID')})</span>
                                  </button>
                                )}

                                {onReserveProduct && !isActiveProductSoldOut && (
                                  activeFullProduct?.listingStatus === 'reserved' ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (activeFullProduct) {
                                          setReservePickerTarget({
                                            product: activeFullProduct,
                                            preferredBuyerId: activeConversation.buyerId,
                                            preferredBuyerName: activeConversation.buyerName,
                                          });
                                        }
                                      }}
                                      className="h-7 sm:h-8 px-2.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap inline-flex items-center justify-center gap-1"
                                    >
                                      <span>
                                        Reserved
                                        {activeFullProduct.reservedByUserName
                                          ? ` (${activeFullProduct.reservedByUserName})`
                                          : ''}
                                      </span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const targetProd: Product = activeFullProduct || {
                                          id: activeConversation.product.id,
                                          name: activeConversation.product.name,
                                          brand: activeConversation.storeName,
                                          sellerBrandName: activeConversation.storeName,
                                          sellerId:
                                            activeConversation.sellerId ||
                                            activeConversation.product.sellerId,
                                          brandCity: 'Indonesia',
                                          category: 'Atasan',
                                          price: activeConversation.product.price,
                                          stock: 1,
                                          sku: activeConversation.product.id,
                                          barcode: '',
                                          sizes: ['Standar'],
                                          colors: ['Default'],
                                          image: activeConversation.product.image,
                                          description: '',
                                          rating: 5,
                                          reviewsCount: 0,
                                          verifiedBrand: true,
                                        };
                                        setReservePickerTarget({
                                          product: targetProd,
                                          preferredBuyerId: activeConversation.buyerId,
                                          preferredBuyerName: activeConversation.buyerName,
                                        });
                                      }}
                                      className={`h-7 sm:h-8 px-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap inline-flex items-center justify-center ${
                                        activeConversation.offerStatus === 'pending' ? 'w-full sm:w-auto' : ''
                                      }`}
                                    >
                                      Tandai Reserved
                                    </button>
                                  )
                                )}
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* MESSAGES FLOW AREA */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-[#fbfbfb]">
                      {activeMessages.length > 0 && (
                        <div className="text-center my-2">
                          <span className="text-[10px] text-neutral-400 font-medium bg-white px-3 py-1 rounded-full border border-neutral-200/60 shadow-2xs">
                            {activeConversation.lastTimestamp}
                          </span>
                        </div>
                      )}

                      {activeMessages.map((msg) => {
                        const isOwnMessage =
                          msg.senderId && userProfile.id
                            ? msg.senderId === userProfile.id
                            : activeRole === 'seller'
                              ? msg.sender === 'store'
                              : msg.sender === 'user';

                        return (
                          <div
                            key={msg.id}
                            className={`flex items-end gap-2.5 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                          >
                            {!isOwnMessage && (
                              <div className="w-7 h-7 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold text-[10px] uppercase shrink-0 mb-1 shadow-2xs">
                                {activeCounterpartyAvatar}
                              </div>
                            )}

                            <div
                              className={`space-y-1 max-w-[85%] sm:max-w-md ${
                                isOwnMessage ? 'items-end' : 'items-start'
                              } flex flex-col`}
                            >
                              {msg.messageType === 'offer' ? (
                                <div className="p-3.5 bg-white border border-neutral-200 rounded-2xl text-xs space-y-2 w-[min(16rem,calc(100vw-5.5rem))] sm:w-64 shadow-xs">
                                  <div className="flex items-center justify-between text-neutral-400 text-[11px]">
                                    <span className="font-medium">
                                      {isOwnMessage ? 'Tawaran Harga Anda' : `Tawaran dari ${activeCounterpartyName}`}
                                    </span>
                                    <Tag className="w-3.5 h-3.5 text-neutral-600" />
                                  </div>
                                  <p className="text-base font-extrabold text-neutral-900 tabular-nums">
                                    Rp {msg.offerAmount?.toLocaleString('id-ID')}
                                  </p>
                                  <div
                                    className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg w-fit ${
                                      msg.offerStatus === 'accepted'
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : msg.offerStatus === 'rejected'
                                          ? 'bg-red-50 text-red-600'
                                          : msg.offerStatus === 'countered'
                                            ? 'bg-blue-50 text-blue-700'
                                            : 'bg-amber-50 text-amber-700'
                                    }`}
                                  >
                                    {msg.offerStatus === 'accepted'
                                      ? 'Disetujui Penjual'
                                      : msg.offerStatus === 'rejected'
                                        ? 'Ditolak Penjual'
                                        : msg.offerStatus === 'countered'
                                          ? 'Dibalas Harga Baru'
                                          : 'Menunggu konfirmasi penjual'}
                                  </div>
                                </div>
                              ) : msg.messageType === 'counter_offer' ? (
                                <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl text-xs space-y-2 w-[min(16rem,calc(100vw-5.5rem))] sm:w-64 shadow-xs">
                                  <div className="flex items-center justify-between text-blue-700 text-[11px] font-semibold">
                                    <span>Harga Balasan Penjual</span>
                                    <Tag className="w-3.5 h-3.5" />
                                  </div>
                                  <p className="text-base font-extrabold text-neutral-900 tabular-nums">
                                    Rp {(msg.counterAmount || msg.offerAmount || 0).toLocaleString('id-ID')}
                                  </p>
                                  <div className="text-[10px] text-blue-700 font-medium bg-white/80 px-2.5 py-1 rounded-lg w-fit">
                                    {msg.offerStatus === 'accepted'
                                      ? 'Disepakati Pembeli'
                                      : 'Menunggu persetujuan pembeli'}
                                  </div>
                                </div>
                              ) : msg.messageType === 'offer_response' || msg.messageType === 'system' ? (
                                <div
                                  className={`p-3.5 rounded-2xl text-xs space-y-2 w-[min(16rem,calc(100vw-5.5rem))] sm:w-64 shadow-xs border ${
                                    msg.offerStatus === 'rejected'
                                      ? 'bg-neutral-50 border-neutral-200'
                                      : 'bg-emerald-50/90 border-emerald-200'
                                  }`}
                                >
                                  <div
                                    className={`flex items-center gap-1.5 font-semibold text-[11px] ${
                                      msg.offerStatus === 'rejected' ? 'text-neutral-700' : 'text-emerald-700'
                                    }`}
                                  >
                                    {msg.offerStatus === 'rejected' ? (
                                      <XCircle className="w-3.5 h-3.5" />
                                    ) : (
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                    )}
                                    <span>
                                      {msg.offerStatus === 'rejected'
                                        ? 'Tawaran Belum Disepakati'
                                        : 'Harga Deal Disepakati!'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-neutral-900 font-medium leading-relaxed">
                                    {msg.text}
                                  </p>
                                </div>
                              ) : msg.messageType === 'address' ? (
                                <div className="p-3.5 bg-white border border-neutral-200 rounded-2xl text-xs space-y-2 w-[min(17.5rem,calc(100vw-5.5rem))] sm:w-72 shadow-xs">
                                  <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-neutral-100">
                                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-neutral-900">
                                      <MapPin className="w-3.5 h-3.5 text-red-600" />
                                      <span>Alamat Pengiriman</span>
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleCopyText(msg.id, msg.text)}
                                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-neutral-500 hover:text-neutral-900 cursor-pointer"
                                    >
                                      {copiedMsgId === msg.id ? (
                                        <>
                                          <Check className="w-3 h-3 text-emerald-600" />
                                          <span className="text-emerald-600">Disalin</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3 h-3" />
                                          <span>Salin</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                  <p className="text-xs text-neutral-700 leading-relaxed whitespace-pre-wrap select-text">
                                    {msg.text}
                                  </p>
                                </div>
                              ) : msg.messageType === 'deal' ? (
                                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs space-y-1.5 w-[min(17.5rem,calc(100vw-5.5rem))] sm:w-72 shadow-xs">
                                  <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-[11px]">
                                    <Handshake className="w-4 h-4" />
                                    <span>Transaksi Deal Tercatat</span>
                                  </div>
                                  <p className="text-xs text-emerald-950 font-medium leading-relaxed whitespace-pre-wrap">
                                    {msg.text}
                                  </p>
                                </div>
                              ) : (
                                <div
                                  className={`px-4 py-2.5 rounded-2xl text-xs sm:text-[13px] leading-relaxed break-words whitespace-pre-wrap select-text ${
                                    isOwnMessage
                                      ? 'bg-neutral-900 text-white rounded-tr-xs shadow-xs'
                                      : 'bg-white text-neutral-800 border border-neutral-200/80 rounded-tl-xs shadow-2xs'
                                  }`}
                                >
                                  {msg.image && (
                                    <div className="mb-2 rounded-xl overflow-hidden max-h-48 border border-black/5">
                                      <img
                                        src={msg.image}
                                        alt=""
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                      />
                                    </div>
                                  )}
                                  {msg.text}
                                </div>
                              )}

                              <div className="flex items-center gap-1 text-[10px] text-neutral-400 px-1">
                                <span>{msg.timestamp}</span>
                                {isOwnMessage && (
                                  msg.isRead ? (
                                    <CheckCheck
                                      className="w-3.5 h-3.5 text-sky-500"
                                      aria-label="Sudah dibaca"
                                    />
                                  ) : (
                                    <Check
                                      className="w-3.5 h-3.5 text-neutral-400"
                                      aria-label="Belum dibaca"
                                    />
                                  )
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {isActiveCounterpartyTyping && (
                        <div className="flex items-end gap-2.5 justify-start">
                          <div className="w-7 h-7 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold text-[10px] uppercase shrink-0 mb-1 shadow-2xs">
                            {activeCounterpartyAvatar}
                          </div>
                          <div className="px-3.5 py-2 rounded-2xl rounded-tl-xs bg-white text-neutral-500 border border-neutral-200/80 text-xs italic shadow-2xs">
                            (typing..)
                          </div>
                        </div>
                      )}

                      <div ref={messagesEndRef} />
                    </div>

                    {/* Composer error banner */}
                    {composerError && (
                      <div className="px-4 py-1.5 bg-red-50 border-t border-red-100 text-[11px] font-medium text-red-600 flex items-center justify-between shrink-0">
                        <span>{composerError}</span>
                        <button type="button" onClick={() => setComposerError(null)} className="cursor-pointer">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Attached photo thumbnail preview before send */}
                    {attachedImage && (
                      <div className="px-4 py-2 bg-neutral-50 border-t border-neutral-200 flex items-center gap-2 shrink-0">
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-neutral-200 bg-white shadow-2xs shrink-0">
                          <img src={attachedImage} alt="" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setAttachedImage(null)}
                            className="absolute top-0.5 right-0.5 p-0.5 bg-black/75 hover:bg-neutral-900 text-white rounded-full cursor-pointer"
                            aria-label="Hapus foto lampiran"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Quick Action Bar: One-Click "Alamat Saya" + Contextual Reply Chips */}
                    <div className="px-3 sm:px-4 py-2 bg-white border-t border-neutral-100 flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleClickMyAddress}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-[11px] font-semibold rounded-xl whitespace-nowrap transition-all active:scale-95 cursor-pointer shrink-0 shadow-2xs"
                        title="Kirim alamat lengkap saya ke chat"
                      >
                        <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        <span>Alamat Saya</span>
                      </button>

                      {contextualSuggestions.length > 0 && (
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1">
                          {contextualSuggestions.map((chip, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleSendMessage(chip)}
                              className="px-3 py-1.5 bg-neutral-100/80 hover:bg-neutral-200/80 text-neutral-700 hover:text-neutral-900 text-[11px] rounded-xl whitespace-nowrap transition-colors cursor-pointer shrink-0"
                            >
                              {chip}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Bottom Input Composer Bar */}
                    <div className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 bg-white border-t border-neutral-200/80 flex items-center gap-2.5 shrink-0">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        className="hidden"
                      />

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-neutral-400 hover:text-neutral-700 rounded-xl hover:bg-neutral-100 transition-colors cursor-pointer shrink-0"
                        title="Lampirkan foto"
                      >
                        <ImageIcon className="w-5 h-5" />
                      </button>

                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={inputText}
                          onChange={(e) => handleComposerChange(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                          placeholder={
                            activeRole === 'seller'
                              ? `Balas ${activeCounterpartyName}...`
                              : `Tulis pesan ke ${activeCounterpartyName}...`
                          }
                          className="w-full bg-neutral-100/80 focus:bg-white text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 pl-4 pr-3 py-2.5 rounded-2xl border border-transparent focus:border-neutral-300 focus:outline-none transition-all"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSendMessage()}
                        disabled={!inputText.trim() && !attachedImage}
                        className="w-10 h-10 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-30 text-white rounded-2xl flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0 shadow-xs"
                        aria-label="Kirim Pesan"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center p-8 text-center text-xs text-neutral-400">
                    Pilih percakapan dari daftar inbox atau klik tombol Chat Penjual pada produk yang diminati.
                  </div>
                )}
              </div>
            </div>

            {/* MAKE OFFER MODAL DIALOG (BUYER) */}
            <AnimatePresence>
              {isOfferOpen && activeConversation && (
                <motion.div
                  key="offer-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={AROOS_BACKDROP_TRANSITION}
                  className="fixed inset-0 z-60 bg-neutral-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
                  onClick={() => setIsOfferOpen(false)}
                >
                  <motion.div
                    key="offer-modal"
                    variants={AROOS_MODAL_VARIANTS}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={AROOS_MODAL_TRANSITION}
                    className="bg-white border border-neutral-200 text-neutral-900 rounded-3xl max-w-sm w-full p-4 sm:p-6 space-y-4 shadow-2xl max-h-[90dvh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                      <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-1.5">
                        <Tag className="w-4 h-4 text-neutral-700" />
                        <span>Ajukan Penawaran Harga</span>
                      </h3>
                      <button
                        type="button"
                        onClick={() => setIsOfferOpen(false)}
                        className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-2xl border border-neutral-200/80">
                      <img
                        src={activeConversation.product.image}
                        alt=""
                        className="w-12 h-12 rounded-xl object-cover border border-neutral-200"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-neutral-900 truncate">{activeConversation.product.name}</p>
                        <p className="text-xs text-neutral-500 mt-0.5 tabular-nums">
                          Harga Asli: <strong className="text-neutral-900">Rp {activeConversation.product.price.toLocaleString('id-ID')}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-neutral-400 font-medium">Saran:</span>
                      {[5, 10, 15].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setQuickDiscount(pct)}
                          className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                        >
                          -{pct}%
                        </button>
                      ))}
                    </div>

                    <form onSubmit={handleMakeOffer} className="space-y-4">
                      <div>
                        <label className="text-xs font-semibold text-neutral-700 block mb-1">
                          Nominal Tawaran Anda (IDR):
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-neutral-400 font-bold">
                            Rp
                          </span>
                          <input
                            type="text"
                            required
                            value={offerPriceInput}
                            onChange={(e) => setOfferPriceInput(e.target.value)}
                            placeholder="Contoh: 110.000"
                            className="w-full bg-neutral-50 text-neutral-900 pl-10 pr-4 py-2.5 rounded-xl border border-neutral-300 text-sm font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsOfferOpen(false)}
                          className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer shadow-xs"
                        >
                          Kirim Tawaran
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* COUNTER-OFFER MODAL DIALOG (SELLER) */}
            <AnimatePresence>
              {isCounterOpen && activeConversation && (
                <motion.div
                  key="counter-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={AROOS_BACKDROP_TRANSITION}
                  className="fixed inset-0 z-60 bg-neutral-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
                  onClick={() => setIsCounterOpen(false)}
                >
                  <motion.div
                    key="counter-modal"
                    variants={AROOS_MODAL_VARIANTS}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={AROOS_MODAL_TRANSITION}
                    className="bg-white border border-neutral-200 text-neutral-900 rounded-3xl max-w-sm w-full p-4 sm:p-6 space-y-4 shadow-2xl max-h-[90dvh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                      <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-1.5">
                        <Tag className="w-4 h-4 text-neutral-700" />
                        <span>Ajukan Harga Balasan</span>
                      </h3>
                      <button
                        type="button"
                        onClick={() => setIsCounterOpen(false)}
                        className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200/80 text-xs space-y-1">
                      <p className="font-bold text-neutral-900 truncate">{activeConversation.product.name}</p>
                      <p className="text-neutral-500 tabular-nums">
                        Tawaran pembeli:{' '}
                        <strong className="text-amber-700">
                          Rp {(activeConversation.offeredPrice || activeConversation.product.price).toLocaleString('id-ID')}
                        </strong>
                      </p>
                      <p className="text-neutral-500 tabular-nums">
                        Harga asli:{' '}
                        <strong className="text-neutral-900">
                          Rp {activeConversation.product.price.toLocaleString('id-ID')}
                        </strong>
                      </p>
                    </div>

                    <form onSubmit={handleSubmitCounterOffer} className="space-y-4">
                      <div>
                        <label className="text-xs font-semibold text-neutral-700 block mb-1">
                          Harga Balasan Penjual (IDR):
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-neutral-400 font-bold">
                            Rp
                          </span>
                          <input
                            type="text"
                            required
                            value={counterPriceInput}
                            onChange={(e) => setCounterPriceInput(e.target.value)}
                            placeholder="Contoh: 250.000"
                            className="w-full bg-neutral-50 text-neutral-900 pl-10 pr-4 py-2.5 rounded-xl border border-neutral-300 text-sm font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsCounterOpen(false)}
                          className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer shadow-xs"
                        >
                          Kirim Balasan
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* QUICK-FILL "ALAMAT SAYA" MODAL */}
            <AnimatePresence>
              {isAddressModalOpen && (
                <motion.div
                  key="address-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={AROOS_BACKDROP_TRANSITION}
                  className="fixed inset-0 z-60 bg-neutral-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
                  onClick={() => setIsAddressModalOpen(false)}
                >
                  <motion.div
                    key="address-modal"
                    variants={AROOS_MODAL_VARIANTS}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={AROOS_MODAL_TRANSITION}
                    className="bg-white border border-neutral-200 text-neutral-900 rounded-3xl max-w-md w-full p-4 sm:p-6 space-y-4 shadow-2xl max-h-[90dvh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                      <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-red-600" />
                        <span>Lengkapi Alamat Pengiriman</span>
                      </h3>
                      <button
                        type="button"
                        onClick={() => setIsAddressModalOpen(false)}
                        className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-xs text-neutral-500">
                      Alamat ini akan disimpan di profil Anda agar selanjutnya cukup 1 klik untuk dikirim ke penjual.
                    </p>

                    <form onSubmit={handleSaveAndSendAddress} className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-neutral-700 block mb-1">
                          Nama Penerima
                        </label>
                        <input
                          type="text"
                          required
                          value={addrName}
                          onChange={(e) => setAddrName(e.target.value)}
                          placeholder="Nama lengkap penerima"
                          className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:bg-white focus:border-neutral-900 focus:outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-xs font-semibold text-neutral-700 block mb-1">
                            No. HP / WhatsApp
                          </label>
                          <input
                            type="tel"
                            required
                            value={addrPhone}
                            onChange={(e) => setAddrPhone(e.target.value)}
                            placeholder="08xxxxxxxxxx"
                            className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:bg-white focus:border-neutral-900 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-neutral-700 block mb-1">
                            Kode Pos
                          </label>
                          <input
                            type="text"
                            value={addrPostalCode}
                            onChange={(e) => setAddrPostalCode(e.target.value)}
                            placeholder="12190"
                            className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:bg-white focus:border-neutral-900 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-neutral-700 block mb-1">
                          Kota / Kabupaten &amp; Kecamatan
                        </label>
                        <input
                          type="text"
                          required
                          value={addrCity}
                          onChange={(e) => setAddrCity(e.target.value)}
                          placeholder="Contoh: Jakarta Selatan, Kebayoran Baru"
                          className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:bg-white focus:border-neutral-900 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-neutral-700 block mb-1">
                          Alamat Lengkap
                        </label>
                        <textarea
                          rows={3}
                          required
                          value={addrFull}
                          onChange={(e) => setAddrFull(e.target.value)}
                          placeholder="Nama jalan, nomor rumah, patokan..."
                          className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:bg-white focus:border-neutral-900 focus:outline-none resize-none"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsAddressModalOpen(false)}
                          className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-xl cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          disabled={addrSaving}
                          className="flex-1 py-2.5 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
                        >
                          {addrSaving ? 'Menyimpan...' : 'Simpan & Kirim Alamat'}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* CATAT DEAL MODAL (DIRECT CHAT COMMERCE - COD / TRANSFER LANGSUNG) */}
            <AnimatePresence>
              {isDealModalOpen && activeConversation && (
                <motion.div
                  key="deal-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={AROOS_BACKDROP_TRANSITION}
                  className="fixed inset-0 z-60 bg-neutral-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
                  onClick={() => setIsDealModalOpen(false)}
                >
                  <motion.div
                    key="deal-modal"
                    variants={AROOS_MODAL_VARIANTS}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={AROOS_MODAL_TRANSITION}
                    className="bg-white border border-neutral-200 text-neutral-900 rounded-3xl max-w-md w-full p-4 sm:p-6 space-y-4 shadow-2xl max-h-[90dvh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                      <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-1.5">
                        <Handshake className="w-4 h-4 text-emerald-600" />
                        <span>Catat Kesepakatan Deal</span>
                      </h3>
                      <button
                        type="button"
                        onClick={() => setIsDealModalOpen(false)}
                        className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200/80 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-neutral-900 truncate">{activeConversation.product.name}</p>
                        <p className="text-[11px] text-neutral-500">Tanpa payment gateway · Langsung antara penjual &amp; pembeli</p>
                      </div>
                      <p className="text-sm font-extrabold text-emerald-700 tabular-nums shrink-0">
                        Rp {agreedOrOriginalPrice.toLocaleString('id-ID')}
                      </p>
                    </div>

                    <form onSubmit={handleSubmitDeal} className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-neutral-700 block mb-1.5">
                          Metode Transaksi Langsung
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setDealPaymentMethod('transfer_langsung')}
                            className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                              dealPaymentMethod === 'transfer_langsung'
                                ? 'bg-neutral-900 text-white border-neutral-900'
                                : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400'
                            }`}
                          >
                            Transfer Langsung
                          </button>
                          <button
                            type="button"
                            onClick={() => setDealPaymentMethod('cod')}
                            className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                              dealPaymentMethod === 'cod'
                                ? 'bg-neutral-900 text-white border-neutral-900'
                                : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400'
                            }`}
                          >
                            COD / Ketemuan
                          </button>
                        </div>
                      </div>

                      {dealPaymentMethod === 'transfer_langsung' && (
                        <div>
                          <label className="text-xs font-semibold text-neutral-700 block mb-1">
                            Kurir Pengiriman
                          </label>
                          <select
                            value={dealCourier}
                            onChange={(e) => setDealCourier(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:bg-white focus:border-neutral-900 focus:outline-none"
                          >
                            <option value="Kurir Reguler (JNE / J&T / SiCepat)">Kurir Reguler (JNE / J&T / SiCepat)</option>
                            <option value="Instan / Sameday (GoSend / Grab)">Instan / Sameday (GoSend / Grab)</option>
                            <option value="Ambil di Lokasi Penjual">Ambil di Lokasi Penjual</option>
                          </select>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-xs font-semibold text-neutral-700 block mb-1">
                            Nama Pembeli
                          </label>
                          <input
                            type="text"
                            required
                            value={dealBuyerName}
                            onChange={(e) => setDealBuyerName(e.target.value)}
                            placeholder="Nama lengkap"
                            className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:bg-white focus:border-neutral-900 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-neutral-700 block mb-1">
                            No. HP Pembeli
                          </label>
                          <input
                            type="tel"
                            required
                            value={dealBuyerPhone}
                            onChange={(e) => setDealBuyerPhone(e.target.value)}
                            placeholder="08xxxxxxxxxx"
                            className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:bg-white focus:border-neutral-900 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-neutral-700 block mb-1">
                          Kota / Titik Temu
                        </label>
                        <input
                          type="text"
                          required
                          value={dealBuyerCity}
                          onChange={(e) => setDealBuyerCity(e.target.value)}
                          placeholder="Contoh: Jakarta Selatan"
                          className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:bg-white focus:border-neutral-900 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-neutral-700 block mb-1">
                          Alamat Pengiriman / Lokasi Ketemuan
                        </label>
                        <textarea
                          rows={2}
                          required
                          value={dealBuyerAddress}
                          onChange={(e) => setDealBuyerAddress(e.target.value)}
                          placeholder="Alamat tujuan atau detail titik temu"
                          className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:bg-white focus:border-neutral-900 focus:outline-none resize-none"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsDealModalOpen(false)}
                          className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-xl cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmittingDeal}
                          className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
                        >
                          {isSubmittingDeal ? 'Menyimpan...' : 'Simpan Deal'}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <ReservedBuyerModal
              isOpen={Boolean(reservePickerTarget)}
              onClose={() => setReservePickerTarget(null)}
              product={reservePickerTarget?.product || null}
              conversations={conversations}
              preferredBuyerId={reservePickerTarget?.preferredBuyerId}
              preferredBuyerName={reservePickerTarget?.preferredBuyerName}
              onConfirmReserve={(prod, buyer) => {
                onReserveProduct?.(prod.id, buyer);
              }}
              onUnreserve={
                onUnreserveProduct
                  ? (prod) => {
                      onUnreserveProduct(prod.id);
                    }
                  : undefined
              }
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
