import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Search, Users, MapPin, ShieldCheck, UserPlus, UserCheck, Store
} from 'lucide-react';
import { StoreFollower, isStoreFollowed } from '../utils/marketplaceSocial';
import {
  AROOS_BACKDROP_TRANSITION,
  AROOS_MODAL_TRANSITION,
  AROOS_MODAL_VARIANTS,
} from '../utils/motionPresets';

interface FollowersModalProps {
  isOpen: boolean;
  onClose: () => void;
  brandName: string | null;
  initialTab?: 'followers' | 'following';
  followers: StoreFollower[];
  followingList: StoreFollower[];
  isOwnStore?: boolean;
  followingStores: string[];
  onToggleFollow: (brandName: string, sellerId?: string) => void;
  onSelectStore: (brandName: string, sellerId?: string) => void;
}

export const FollowersModal: React.FC<FollowersModalProps> = ({
  isOpen,
  onClose,
  brandName,
  initialTab = 'followers',
  followers,
  followingList,
  isOwnStore = false,
  followingStores,
  onToggleFollow,
  onSelectStore,
}) => {
  const [activeTab, setActiveTab] = useState<'followers' | 'following'>(initialTab);
  const [query, setQuery] = useState('');
  const [failedAvatars, setFailedAvatars] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setQuery('');
      setFailedAvatars({});
    }
  }, [isOpen, brandName, initialTab]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const activeList = activeTab === 'followers' ? followers : followingList;

  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeList;
    return activeList.filter((item) =>
      `${item.displayName} ${item.handle} ${item.city} ${item.storeName || ''}`
        .toLowerCase()
        .includes(q)
    );
  }, [activeList, query]);

  return (
    <AnimatePresence>
      {isOpen && brandName && (
        <motion.div
          key="followers-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={AROOS_BACKDROP_TRANSITION}
          className="fixed inset-0 z-[60] overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-6 select-none"
          onClick={onClose}
        >
          <motion.div
            key="followers-dialog"
            variants={AROOS_MODAL_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={AROOS_MODAL_TRANSITION}
            role="dialog"
            aria-label={`Koneksi ${brandName}`}
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[90dvh] sm:max-h-[82vh] flex flex-col border border-neutral-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-neutral-100 bg-white shrink-0 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-2xl bg-neutral-900 text-white flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-base font-bold text-neutral-900 truncate">
                      {isOwnStore ? 'Lapak Saya' : brandName}
                    </h2>
                    <p className="text-[11px] text-neutral-500 truncate">
                      {activeTab === 'followers'
                        ? isOwnStore
                          ? 'Pengguna yang mengikuti lapak Anda'
                          : `Pengguna yang mengikuti ${brandName}`
                        : isOwnStore
                          ? 'Lapak & penjual yang Anda ikuti'
                          : `Lapak yang diikuti oleh ${brandName}`}
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

              {/* Pengikut / Mengikuti 2-Tab Segmented Switch */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-neutral-100 rounded-xl border border-neutral-200/70">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('followers');
                    setQuery('');
                  }}
                  className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer tabular-nums whitespace-nowrap ${
                    activeTab === 'followers'
                      ? 'bg-white text-neutral-900 shadow-2xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  Pengikut ({followers.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('following');
                    setQuery('');
                  }}
                  className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer tabular-nums whitespace-nowrap ${
                    activeTab === 'following'
                      ? 'bg-white text-neutral-900 shadow-2xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  Mengikuti ({followingList.length})
                </button>
              </div>

              {activeList.length > 0 && (
                <div className="relative">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={
                      activeTab === 'followers'
                        ? 'Cari nama, username, atau kota pengikut...'
                        : 'Cari nama toko, user, atau kota...'
                    }
                    className="w-full min-h-[38px] pl-10 pr-8 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:border-neutral-900 transition-colors"
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
              )}
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto bg-[#fafafa] divide-y divide-neutral-100">
              {activeList.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <Users className="w-9 h-9 text-neutral-300 mx-auto" />
                  <p className="text-sm font-semibold text-neutral-800">
                    {activeTab === 'followers' ? 'Belum ada pengikut' : 'Belum mengikuti lapak mana pun'}
                  </p>
                  <p className="text-xs text-neutral-500 max-w-xs mx-auto">
                    {activeTab === 'followers'
                      ? isOwnStore
                        ? 'Bagikan link lapak Anda agar pengguna lain bisa mengikuti pembaruan barang terbaru.'
                        : 'Jadilah yang pertama mengikuti lapak ini.'
                      : isOwnStore
                        ? 'Ketuk tombol Ikuti pada toko atau halaman barang untuk memantau lapak favorit Anda.'
                        : `${brandName} belum mengikuti lapak lain saat ini.`}
                  </p>
                </div>
              ) : filteredList.length === 0 ? (
                <div className="p-10 text-center space-y-2.5">
                  <Search className="w-8 h-8 text-neutral-300 mx-auto" />
                  <p className="text-sm font-semibold text-neutral-800">
                    Tidak ditemukan hasil yang cocok
                  </p>
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="px-4 py-1.5 bg-neutral-900 text-white text-xs font-semibold rounded-full hover:bg-black transition-all cursor-pointer"
                  >
                    Reset Pencarian
                  </button>
                </div>
              ) : (
                filteredList.map((person) => {
                  const targetStoreName = person.storeName;
                  const canOpenProfile = Boolean(targetStoreName);
                  const isFollowed = targetStoreName
                    ? isStoreFollowed(followingStores, targetStoreName, person.sellerId)
                    : false;

                  return (
                    <div
                      key={`${activeTab}-${person.id}`}
                      onClick={() => {
                        if (targetStoreName) {
                          onClose();
                          onSelectStore(targetStoreName, person.sellerId);
                        }
                      }}
                      className={`px-5 py-3.5 bg-white flex items-center justify-between gap-3 transition-colors ${
                        canOpenProfile ? 'hover:bg-neutral-50 cursor-pointer' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {person.avatarUrl && !failedAvatars[person.id] ? (
                          <img
                            src={person.avatarUrl}
                            alt={person.displayName}
                            loading="lazy"
                            decoding="async"
                            onError={() =>
                              setFailedAvatars((prev) => ({ ...prev, [person.id]: true }))
                            }
                            className="w-10 h-10 rounded-full object-cover border border-neutral-200 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-neutral-900 text-white flex items-center justify-center font-mono font-bold text-xs uppercase shrink-0">
                            {person.displayName.slice(0, 2).toUpperCase()}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs sm:text-sm font-bold text-neutral-900 truncate">
                              {person.displayName}
                            </p>
                            {person.isVerified && (
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            )}
                            {person.isCurrentUser && (
                              <span className="text-[10px] font-semibold text-neutral-500">
                                · Anda
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 truncate">
                            <span className="truncate">{person.handle}</span>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-0.5 shrink-0">
                              <MapPin className="w-2.5 h-2.5 text-neutral-400" />
                              {person.city}
                            </span>
                            {person.followedAtLabel && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="shrink-0">{person.followedAtLabel}</span>
                              </>
                            )}
                          </div>

                          {targetStoreName &&
                            targetStoreName.toLowerCase() !== person.displayName.toLowerCase() && (
                              <p className="text-[10px] text-neutral-500 mt-0.5 inline-flex items-center gap-1 truncate max-w-full">
                                <Store className="w-2.5 h-2.5 text-neutral-400 shrink-0" />
                                <span className="truncate">Lapak: {targetStoreName}</span>
                              </p>
                            )}
                        </div>
                      </div>

                      {!person.isCurrentUser && targetStoreName && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFollow(targetStoreName, person.sellerId);
                          }}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all active:scale-95 cursor-pointer whitespace-nowrap shrink-0 ${
                            isFollowed
                              ? 'bg-neutral-100 text-neutral-900 border border-neutral-300 hover:bg-neutral-200/70'
                              : 'bg-red-600 text-white hover:bg-red-700 shadow-2xs'
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
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
