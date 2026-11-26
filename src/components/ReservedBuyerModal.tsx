import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MessageSquare, Check, BookmarkCheck, UserCheck, RotateCcw } from 'lucide-react';
import { ChatConversation, Product } from '../types';
import { getLocalConversations } from '../services/chatService';
import {
  AROOS_BACKDROP_TRANSITION,
  AROOS_MODAL_TRANSITION,
  AROOS_MODAL_VARIANTS,
} from '../utils/motionPresets';

export interface ReservedBuyerCandidate {
  key: string;
  id?: string;
  name: string;
  lastMessage: string;
  lastTimestamp: string;
  offeredPrice?: number;
  offerStatus?: string | null;
}

interface ReservedBuyerModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  conversations?: ChatConversation[];
  preferredBuyerId?: string;
  preferredBuyerName?: string;
  onConfirmReserve: (product: Product, buyer: { id?: string; name: string }) => void;
  onUnreserve?: (product: Product) => void;
}

export const ReservedBuyerModal: React.FC<ReservedBuyerModalProps> = ({
  isOpen,
  onClose,
  product,
  conversations = [],
  preferredBuyerId,
  preferredBuyerName,
  onConfirmReserve,
  onUnreserve,
}) => {
  const [selectedKey, setSelectedKey] = useState<string>('');

  const candidates = useMemo<ReservedBuyerCandidate[]>(() => {
    if (!product) return [];

    // Merge live Firestore conversations prop with local cached conversations
    const mergedMap = new Map<string, ChatConversation>();
    getLocalConversations().forEach((c) => {
      if (c && c.id) mergedMap.set(c.id, c);
    });
    conversations.forEach((c) => {
      if (c && c.id) mergedMap.set(c.id, c);
    });

    const list: ReservedBuyerCandidate[] = [];
    const seenBuyerKeys = new Set<string>();

    Array.from(mergedMap.values()).forEach((conv) => {
      if (conv.product?.id !== product.id) return;
      const buyerName = (conv.buyerName || '').trim();
      const buyerId = (conv.buyerId || '').trim() || undefined;
      if (!buyerId && !buyerName) return;

      // Never treat seller own account as a buyer candidate
      if (product.sellerId && buyerId && buyerId === product.sellerId) return;

      const key = buyerId ? `id:${buyerId}` : `name:${buyerName.toLowerCase()}`;
      if (seenBuyerKeys.has(key)) return;
      seenBuyerKeys.add(key);

      list.push({
        key,
        id: buyerId,
        name: buyerName || 'Pembeli AROOS',
        lastMessage: conv.lastMessage || 'Percakapan produk',
        lastTimestamp: conv.lastTimestamp || 'Baru saja',
        offeredPrice: conv.offeredPrice,
        offerStatus: conv.offerStatus,
      });
    });

    // If opened from a specific chat conversation and somehow not present yet, include preferred buyer
    if (preferredBuyerId || preferredBuyerName) {
      const prefKey = preferredBuyerId
        ? `id:${preferredBuyerId.trim()}`
        : `name:${(preferredBuyerName || '').trim().toLowerCase()}`;
      if (prefKey && !seenBuyerKeys.has(prefKey)) {
        list.unshift({
          key: prefKey,
          id: preferredBuyerId?.trim() || undefined,
          name: (preferredBuyerName || 'Pembeli').trim(),
          lastMessage: 'Chat aktif produk ini',
          lastTimestamp: 'Baru saja',
        });
      }
    }

    return list;
  }, [product, conversations, preferredBuyerId, preferredBuyerName]);

  useEffect(() => {
    if (!isOpen || !product) {
      setSelectedKey('');
      return;
    }

    if (preferredBuyerId || preferredBuyerName) {
      const prefMatch = candidates.find(
        (c) =>
          (preferredBuyerId && c.id === preferredBuyerId) ||
          (preferredBuyerName && c.name.toLowerCase() === preferredBuyerName.trim().toLowerCase())
      );
      if (prefMatch) {
        setSelectedKey(prefMatch.key);
        return;
      }
    }

    if (product.reservedByUserId || product.reservedByUserName) {
      const existingMatch = candidates.find(
        (c) =>
          (product.reservedByUserId && c.id === product.reservedByUserId) ||
          (product.reservedByUserName &&
            c.name.toLowerCase() === product.reservedByUserName.trim().toLowerCase())
      );
      if (existingMatch) {
        setSelectedKey(existingMatch.key);
        return;
      }
    }

    if (candidates.length === 1) {
      setSelectedKey(candidates[0].key);
    } else {
      setSelectedKey('');
    }
  }, [isOpen, product, candidates, preferredBuyerId, preferredBuyerName]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const selectedCandidate = candidates.find((c) => c.key === selectedKey) || null;
  const isAlreadyReserved = product?.listingStatus === 'reserved';

  return (
    <AnimatePresence>
      {isOpen && product && (
        <motion.div
          key="reserved-buyer-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={AROOS_BACKDROP_TRANSITION}
          className="fixed inset-0 z-[75] overflow-y-auto bg-black/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 select-none"
          onClick={onClose}
        >
          <motion.div
            key="reserved-buyer-dialog"
            variants={AROOS_MODAL_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={AROOS_MODAL_TRANSITION}
            role="dialog"
            aria-label="Pilih Pembeli untuk Status Reserved"
            className="w-full max-w-md bg-white rounded-3xl border border-neutral-200 shadow-2xl overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                  <BookmarkCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-neutral-900 truncate">
                    Tandai Barang Reserved
                  </h3>
                  <p className="text-[11px] text-neutral-500 truncate">
                    Pilih pembeli yang pernah chat produk ini
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 rounded-full transition-colors cursor-pointer shrink-0"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Product Summary */}
            <div className="px-5 py-3 bg-neutral-50 border-b border-neutral-100 flex items-center gap-3">
              <img
                src={product.image}
                alt={product.name}
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-xl object-cover border border-neutral-200 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-neutral-900 truncate">{product.name}</p>
                <p className="text-xs font-semibold text-neutral-600 tabular-nums">
                  Rp {product.price.toLocaleString('id-ID')}
                </p>
                {isAlreadyReserved && product.reservedByUserName && (
                  <p className="text-[11px] font-medium text-amber-700 truncate">
                    Saat ini di-reserve oleh {product.reservedByUserName}
                  </p>
                )}
              </div>
            </div>

            {/* Candidate List */}
            <div className="p-5 space-y-4 max-h-[55vh] overflow-y-auto">
              {candidates.length === 0 ? (
                <div className="py-8 px-4 text-center rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-2">
                  <MessageSquare className="w-7 h-7 text-neutral-300 mx-auto" />
                  <p className="text-xs font-semibold text-neutral-800">
                    Belum ada pembeli yang chat produk ini
                  </p>
                  <p className="text-[11px] text-neutral-500 leading-relaxed">
                    Status Reserved hanya dapat diberikan kepada pembeli yang sudah memulai percakapan untuk barang ini.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-neutral-500">
                    Pembeli dari chat produk ({candidates.length})
                  </p>
                  <div className="space-y-2">
                    {candidates.map((cand) => {
                      const isSelected = selectedKey === cand.key;
                      return (
                        <button
                          key={cand.key}
                          type="button"
                          onClick={() => setSelectedKey(cand.key)}
                          className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                            isSelected
                              ? 'border-amber-500 bg-amber-50/70 ring-1 ring-amber-400/40'
                              : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/60'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div
                              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs uppercase shrink-0 ${
                                isSelected
                                  ? 'bg-amber-600 text-white'
                                  : 'bg-neutral-900 text-white'
                              }`}
                            >
                              {cand.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-neutral-900 truncate">
                                  {cand.name}
                                </span>
                                {cand.offeredPrice && (
                                  <span className="text-[10px] font-semibold text-amber-700 tabular-nums shrink-0">
                                    · Tawar Rp {cand.offeredPrice.toLocaleString('id-ID')}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                                {cand.lastMessage}
                              </p>
                            </div>
                          </div>

                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center border shrink-0 ${
                              isSelected
                                ? 'bg-amber-600 border-amber-600 text-white'
                                : 'border-neutral-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="px-5 py-4 border-t border-neutral-100 bg-neutral-50/70 flex flex-wrap items-center justify-between gap-2">
              {isAlreadyReserved && onUnreserve ? (
                <button
                  type="button"
                  onClick={() => {
                    onUnreserve(product);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-100 text-xs font-semibold text-neutral-700 cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Batalkan Reserved</span>
                </button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={!selectedCandidate}
                  onClick={() => {
                    if (!selectedCandidate) return;
                    onConfirmReserve(product, {
                      id: selectedCandidate.id,
                      name: selectedCandidate.name,
                    });
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Konfirmasi Reserved</span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
