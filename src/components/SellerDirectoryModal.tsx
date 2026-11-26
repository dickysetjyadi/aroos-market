import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Search, MapPin, Star, Package, UserPlus, UserCheck,
  Store, Users, ShieldCheck, ArrowRight
} from 'lucide-react';
import {
  SellerDirectoryEntry,
  getStoreFollowerCount,
  isStoreFollowed,
} from '../utils/marketplaceSocial';
import {
  AROOS_BACKDROP_TRANSITION,
  AROOS_MODAL_TRANSITION,
  AROOS_MODAL_VARIANTS,
} from '../utils/motionPresets';

interface SellerDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  sellers: SellerDirectoryEntry[];
  initialQuery?: string;
  followingStores: string[];
  followerDeltas: Record<string, number>;
  onToggleFollow: (brandName: string, sellerId?: string) => void;
  onSelectStore: (brandName: string, sellerId?: string) => void;
}

export const SellerDirectoryModal: React.FC<SellerDirectoryModalProps> = ({
  isOpen,
  onClose,
  sellers,
  initialQuery = '',
  followingStores,
  followerDeltas,
  onToggleFollow,
  onSelectStore,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<'all' | 'following'>('all');
  const [failedAvatars, setFailedAvatars] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery);
      setFailedAvatars({});
    }
  }, [isOpen, initialQuery]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const followedSellersCount = useMemo(
    () =>
      sellers.filter((s) =>
        isStoreFollowed(followingStores, s.brandName, s.sellerId)
      ).length,
    [sellers, followingStores]
  );

  const filteredSellers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sellers.filter((seller) => {
      if (
        activeTab === 'following' &&
        !isStoreFollowed(followingStores, seller.brandName, seller.sellerId)
      ) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        seller.brandName,
        seller.ownerName || '',
        seller.city,
        seller.description || '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [sellers, activeTab, followingStores, query]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="seller-directory-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={AROOS_BACKDROP_TRANSITION}
          className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-6 select-none"
          onClick={onClose}
        >
          <motion.div
            key="seller-directory-modal"
            variants={AROOS_MODAL_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={AROOS_MODAL_TRANSITION}
            role="dialog"
            aria-label="Cari Pengguna dan Toko"
            className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92dvh] sm:max-h-[88vh] flex flex-col border border-neutral-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-neutral-100 bg-white shrink-0 space-y-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-2xl bg-neutral-900 text-white flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-bold text-neutral-900 truncate">
                      Cari Pengguna &amp; Toko
                    </h2>
                    <p className="text-xs text-neutral-500 truncate">
                      Temukan lapak lokal, lihat koleksi, dan ikuti penjual favorit
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 rounded-full transition-colors cursor-pointer shrink-0"
                  aria-label="Tutup Cari Pengguna dan Toko"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search & Tabs */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Cari nama user, nama toko, atau kota..."
                    className="w-full min-h-[40px] pl-10 pr-8 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:border-neutral-900 transition-colors"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      aria-label="Hapus pencarian"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-1 p-1 bg-neutral-100 rounded-xl border border-neutral-200/60 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveTab('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap tabular-nums ${
                      activeTab === 'all'
                        ? 'bg-white text-neutral-900 shadow-2xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    Semua ({sellers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('following')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap tabular-nums ${
                      activeTab === 'following'
                        ? 'bg-white text-neutral-900 shadow-2xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    Diikuti ({followedSellersCount})
                  </button>
                </div>
              </div>
            </div>

            {/* Body List */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-[#fafafa] space-y-3">
              {filteredSellers.length === 0 ? (
                <div className="p-10 text-center bg-white rounded-2xl border border-neutral-200/80 space-y-3">
                  <Store className="w-9 h-9 text-neutral-300 mx-auto" />
                  <p className="text-sm font-semibold text-neutral-800">
                    {activeTab === 'following'
                      ? 'Anda belum mengikuti lapak atau pengguna mana pun'
                      : 'Pengguna atau toko tidak ditemukan'}
                  </p>
                  <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                    {activeTab === 'following'
                      ? 'Ketuk tombol Ikuti pada toko atau halaman barang untuk mendapatkan update lapak favorit Anda.'
                      : 'Coba kata kunci nama user, nama toko, atau kota yang berbeda.'}
                  </p>
                  {activeTab === 'following' ? (
                    <button
                      type="button"
                      onClick={() => setActiveTab('all')}
                      className="px-4 py-2 bg-neutral-900 text-white text-xs font-semibold rounded-full hover:bg-black transition-all cursor-pointer"
                    >
                      Jelajahi Semua Toko
                    </button>
                  ) : query ? (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="px-4 py-2 bg-neutral-900 text-white text-xs font-semibold rounded-full hover:bg-black transition-all cursor-pointer"
                    >
                      Reset Pencarian
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredSellers.map((seller) => {
                    const isFollowed = isStoreFollowed(
                      followingStores,
                      seller.brandName,
                      seller.sellerId
                    );
                    const followerCount = getStoreFollowerCount(
                      seller.brandName,
                      followingStores,
                      followerDeltas,
                      seller.isCurrentUser,
                      seller.sellerId
                    );

                    return (
                      <div
                        key={seller.key}
                        onClick={() => {
                          onClose();
                          onSelectStore(seller.brandName, seller.sellerId);
                        }}
                        className="group bg-white border border-neutral-200/80 hover:border-neutral-400 rounded-2xl p-4 flex flex-col justify-between gap-3.5 transition-all cursor-pointer shadow-2xs hover:shadow-sm"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {seller.avatarUrl && !failedAvatars[seller.key] ? (
                                <img
                                  src={seller.avatarUrl}
                                  alt={seller.brandName}
                                  loading="lazy"
                                  decoding="async"
                                  onError={() =>
                                    setFailedAvatars((prev) => ({ ...prev, [seller.key]: true }))
                                  }
                                  className="w-11 h-11 rounded-2xl object-cover border border-neutral-200 shrink-0"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-11 h-11 rounded-2xl bg-neutral-900 text-white flex items-center justify-center font-mono font-bold text-sm uppercase shrink-0">
                                  {seller.brandName.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <h3 className="text-sm font-bold text-neutral-900 truncate">
                                    {seller.brandName}
                                  </h3>
                                  {seller.verified && (
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  )}
                                </div>
                                {seller.ownerName && (
                                  <p className="text-[11px] text-neutral-500 truncate">
                                    @{seller.ownerName}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-0.5 flex-wrap">
                                  <span className="inline-flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-neutral-400" />
                                    {seller.city}
                                  </span>
                                  <span>·</span>
                                  <span className="tabular-nums font-medium text-neutral-700">
                                    {followerCount} Pengikut
                                  </span>
                                </div>
                              </div>
                            </div>

                            {seller.isCurrentUser ? (
                              <span className="px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-600 text-[10px] font-semibold whitespace-nowrap shrink-0">
                                Lapak Saya
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleFollow(seller.brandName, seller.sellerId);
                                }}
                                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all active:scale-95 cursor-pointer whitespace-nowrap shrink-0 ${
                                  isFollowed
                                    ? 'bg-neutral-100 text-neutral-900 border border-neutral-300 hover:bg-neutral-200/70'
                                    : 'bg-neutral-900 text-white hover:bg-black shadow-2xs'
                                }`}
                              >
                                {isFollowed ? (
                                  <>
                                    <UserCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                                    <span>Mengikuti</span>
                                  </>
                                ) : (
                                  <>
                                    <UserPlus className="w-3 h-3 shrink-0" />
                                    <span>Ikuti</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>

                          {/* Preview thumbnails */}
                          {seller.previewImages.length > 0 && (
                            <div className="grid grid-cols-3 gap-1.5">
                              {seller.previewImages.map((img, idx) => (
                                <div
                                  key={idx}
                                  className="aspect-square rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200/60"
                                >
                                  <img
                                    src={img}
                                    alt=""
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Footer Stats */}
                        <div className="pt-2.5 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500">
                          <div className="flex items-center gap-2.5">
                            <span className="inline-flex items-center gap-1 font-medium text-neutral-700 tabular-nums">
                              <Package className="w-3 h-3 text-neutral-400" />
                              {seller.activeListingsCount} Barang
                            </span>
                            {seller.activeListingsCount > 0 && (
                              <span className="inline-flex items-center gap-1 font-semibold text-amber-600 tabular-nums">
                                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                {seller.rating.toFixed(1)}
                              </span>
                            )}
                          </div>
                          <span className="inline-flex items-center gap-1 font-semibold text-neutral-800 group-hover:translate-x-0.5 transition-transform">
                            <span>Buka Lapak</span>
                            <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
