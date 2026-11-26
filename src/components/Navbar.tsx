import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Store, Bell, CheckCircle2, AlertTriangle, 
  RefreshCw, X, LogOut, ChevronDown, Settings, Package,
  ChevronRight, Plus, Heart, User, MessageSquare
} from 'lucide-react';
import { NotificationItem, UserProfile } from '../types';
import { useConfirm } from './ConfirmDialogContext';

interface NavbarProps {
  activeMode: 'shopper' | 'seller' | 'profile';
  setActiveMode: (mode: 'shopper' | 'seller' | 'profile') => void;
  notifications: NotificationItem[];
  markNotificationAsRead: (id: string) => void;
  onMarkAllNotificationsAsRead?: () => void;
  userProfile: UserProfile;
  onOpenAuthModal: (mode?: 'login' | 'register') => void;
  onOpenSell: () => void;
  onOpenProfile?: () => void;
  onOpenSettings?: () => void;
  onOpenOrders?: () => void;
  activeOrdersCount?: number;
  onOpenWishlist?: () => void;
  wishlistCount?: number;
  onLogout: () => void;
  onNavigateNotification?: (notification: NotificationItem) => void;
  onGoHome?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeMode,
  setActiveMode,
  notifications,
  markNotificationAsRead,
  onMarkAllNotificationsAsRead,
  userProfile,
  onOpenAuthModal,
  onOpenSell,
  onOpenProfile,
  onOpenSettings,
  onOpenOrders,
  activeOrdersCount = 0,
  onOpenWishlist,
  wishlistCount = 0,
  onLogout,
  onNavigateNotification,
  onGoHome,
}) => {
  const confirm = useConfirm();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    setAvatarError(false);
  }, [userProfile.avatarUrl]);

  const unreadNotifCount = notifications.filter(n => !n.read).length;

  return (
    <>
      {/* Full-viewport click-outside backdrop */}
      {(showProfileMenu || showNotifications) && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => {
            setShowProfileMenu(false);
            setShowNotifications(false);
          }}
        />
      )}

      <header className="sticky top-0 z-40 bg-[#fafafa]/90 backdrop-blur-md border-0 border-none shadow-none transition-all duration-300">
        {/* Main Top Header Bar */}
        <div className="w-full max-w-[1840px] mx-auto px-3.5 sm:px-6 lg:px-8 xl:px-10">
          <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-4">
            
            {/* Left Zone: AROOS Wordmark */}
            <div className="flex items-center gap-4 sm:gap-6">
              <button 
                type="button"
                onClick={() => {
                  setShowProfileMenu(false);
                  setShowNotifications(false);
                  if (onGoHome) {
                    onGoHome();
                  } else if (activeMode !== 'shopper') {
                    setActiveMode('shopper');
                  }
                }}
                className="group flex items-center gap-2 focus:outline-none active:scale-95 transition-transform shrink-0 cursor-pointer"
                aria-label="AROOS Homepage"
              >
                <span className="text-2xl sm:text-3xl font-black tracking-[-0.05em] uppercase text-[#6e6e6e] group-hover:text-neutral-900 transition-colors font-sans select-none leading-none">
                  AROOS
                </span>
              </button>
            </div>

            {/* Right Action Zone */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              
              {/* Direct Carousell-style Sell Button */}
              <button
                type="button"
                onClick={onOpenSell}
                className={`inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 active:scale-95 cursor-pointer whitespace-nowrap shrink-0 shadow-sm ${
                  activeMode === 'seller'
                    ? 'bg-red-700 text-white ring-2 ring-red-200'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                <Plus className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
                <span>Jual</span>
              </button>

              {/* User Account / Auth Modal Button */}
              <div className="relative">
                {userProfile.isRegistered ? (
                  <button
                    onClick={() => {
                      setShowNotifications(false);
                      setShowProfileMenu(prev => !prev);
                    }}
                    className="flex items-center gap-2 p-1 sm:pr-2.5 bg-neutral-100 hover:bg-neutral-200/70 border border-neutral-200/70 rounded-full text-xs font-semibold text-neutral-800 transition-all duration-200 active:scale-95 cursor-pointer"
                    aria-label="Menu Profil"
                  >
                    <div className="relative w-7 h-7 rounded-full bg-neutral-900 text-white flex items-center justify-center text-[10px] font-bold uppercase overflow-hidden shrink-0 ring-1 ring-black/5">
                      {userProfile.avatarUrl && !avatarError ? (
                        <img
                          src={userProfile.avatarUrl}
                          alt=""
                          onError={() => setAvatarError(true)}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{userProfile.name ? userProfile.name[0] : 'U'}</span>
                      )}
                    </div>
                    <span className="max-w-[90px] sm:max-w-[120px] truncate hidden sm:inline">
                      {userProfile.name}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-neutral-400 hidden sm:inline" />
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 sm:gap-2 text-xs font-semibold text-neutral-700">
                    <button
                      onClick={() => onOpenAuthModal('login')}
                      className="hover:text-neutral-900 px-2 py-1 transition-colors rounded-lg hover:bg-neutral-100 active:scale-95 cursor-pointer"
                    >
                      Masuk
                    </button>
                    <span className="text-neutral-300">|</span>
                    <button
                      onClick={() => onOpenAuthModal('register')}
                      className="hover:text-neutral-900 px-2 py-1 transition-colors rounded-lg hover:bg-neutral-100 active:scale-95 hidden sm:inline cursor-pointer"
                    >
                      Daftar
                    </button>
                  </div>
                )}

                {/* Profile Dropdown Menu */}
                <AnimatePresence>
                  {showProfileMenu && userProfile.isRegistered && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.92, y: -8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.94, y: -6 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="fixed sm:absolute top-15 sm:top-full left-3 right-3 sm:left-auto sm:right-0 mt-1 sm:mt-2 sm:w-64 max-w-sm mx-auto sm:mx-0 bg-white rounded-3xl sm:rounded-2xl shadow-2xl border border-neutral-200/90 p-2.5 sm:p-2 z-50 text-xs ring-1 ring-black/5"
                    >
                      <div className="p-2 border-b border-neutral-100">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs font-bold uppercase overflow-hidden shrink-0">
                            {userProfile.avatarUrl && !avatarError ? (
                              <img
                                src={userProfile.avatarUrl}
                                alt=""
                                onError={() => setAvatarError(true)}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span>{userProfile.name ? userProfile.name[0] : 'U'}</span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-neutral-900 truncate">{userProfile.name}</p>
                            <p className="text-[11px] text-neutral-500 truncate">{userProfile.email}</p>
                          </div>
                        </div>
                      </div>

                      <div className="py-1 space-y-0.5">
                        {/* Profil Saya (Tampilan Toko Publik) */}
                        {onOpenProfile && (
                          <button
                            onClick={() => {
                              setShowProfileMenu(false);
                              onOpenProfile();
                            }}
                            className="w-full text-left px-3 py-2 text-neutral-800 hover:bg-neutral-100 rounded-xl flex items-center gap-2.5 transition-colors font-medium cursor-pointer"
                          >
                            <User className="w-4 h-4 text-neutral-600 shrink-0" />
                            <span>Profil Saya</span>
                          </button>
                        )}

                        {/* Listing & Penjualan Saya */}
                        <button
                          onClick={() => {
                            setShowProfileMenu(false);
                            onOpenSell();
                          }}
                          className="w-full text-left px-3 py-2 text-neutral-800 hover:bg-neutral-100 rounded-xl flex items-center gap-2.5 transition-colors font-medium cursor-pointer"
                        >
                          <Store className="w-4 h-4 text-neutral-600 shrink-0" />
                          <span>Listing &amp; Penjualan Saya</span>
                        </button>

                        {/* Pesanan Saya */}
                        {onOpenOrders && (
                          <button
                            onClick={() => {
                              setShowProfileMenu(false);
                              onOpenOrders();
                            }}
                            className="w-full text-left px-3 py-2 text-neutral-800 hover:bg-neutral-100 rounded-xl flex items-center justify-between transition-colors font-medium cursor-pointer"
                          >
                            <span className="flex items-center gap-2.5">
                              <Package className="w-4 h-4 text-neutral-600 shrink-0" />
                              <span>Pesanan Saya</span>
                            </span>
                            {activeOrdersCount > 0 && (
                              <span className="px-1.5 py-0.5 bg-neutral-900 text-white text-[10px] font-mono font-semibold rounded-full">
                                {activeOrdersCount}
                              </span>
                            )}
                          </button>
                        )}

                        {/* Wishlist Saya */}
                        {onOpenWishlist && (
                          <button
                            onClick={() => {
                              setShowProfileMenu(false);
                              onOpenWishlist();
                            }}
                            className="w-full text-left px-3 py-2 text-neutral-800 hover:bg-neutral-100 rounded-xl flex items-center justify-between transition-colors font-medium cursor-pointer"
                          >
                            <span className="flex items-center gap-2.5">
                              <Heart className="w-4 h-4 text-neutral-600 shrink-0" />
                              <span>Wishlist Saya</span>
                            </span>
                            {wishlistCount > 0 && (
                              <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[10px] font-mono font-semibold rounded-full">
                                {wishlistCount}
                              </span>
                            )}
                          </button>
                        )}

                        {/* Pengaturan Profil */}
                        <button
                          onClick={() => {
                            setShowProfileMenu(false);
                            if (onOpenSettings) onOpenSettings();
                          }}
                          className="w-full text-left px-3 py-2 text-neutral-800 hover:bg-neutral-100 rounded-xl flex items-center gap-2.5 transition-colors font-medium cursor-pointer"
                        >
                          <Settings className="w-4 h-4 text-neutral-600 shrink-0" />
                          <span>Pengaturan Profil</span>
                        </button>

                        <button
                          onClick={async () => {
                            setShowProfileMenu(false);
                            const ok = await confirm({
                              title: 'Keluar Akun',
                              message: `Keluar dari akun ${userProfile.name || 'Anda'}?`,
                              confirmLabel: 'Keluar',
                              tone: 'danger',
                            });
                            if (ok) onLogout();
                          }}
                          className="w-full text-left px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl flex items-center gap-2.5 transition-colors font-medium cursor-pointer"
                        >
                          <LogOut className="w-4 h-4 text-rose-500 shrink-0" />
                          <span>Keluar Akun</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Notifications Button (For registered users) */}
              {userProfile.isRegistered && (
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      setShowNotifications(prev => !prev);
                    }}
                    className="relative p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-full transition-all duration-200 active:scale-95 focus:outline-none cursor-pointer"
                    aria-label="Notifikasi Realtime"
                  >
                    <Bell className="w-4 h-4" />
                    {unreadNotifCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
                    )}
                  </button>

                  <AnimatePresence>
                    {showNotifications && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.88, y: -12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -10 }}
                        transition={{ 
                          duration: 0.24, 
                          ease: [0.16, 1, 0.3, 1] 
                        }}
                        className="fixed sm:absolute top-15 sm:top-full left-3 right-3 sm:left-auto sm:right-0 mt-1 sm:mt-2 sm:w-92 max-w-md mx-auto sm:mx-0 bg-white rounded-3xl shadow-2xl border border-neutral-200/90 overflow-hidden z-50 ring-1 ring-black/5"
                      >
                        <div className="flex items-center justify-between px-4 py-3 bg-neutral-50/90 border-b border-neutral-100 gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-800 font-mono">
                              Pemberitahuan
                            </span>
                            {unreadNotifCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-bold shrink-0">
                                {unreadNotifCount} baru
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {unreadNotifCount > 0 && onMarkAllNotificationsAsRead && (
                              <button
                                type="button"
                                onClick={onMarkAllNotificationsAsRead}
                                className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-900 px-2 py-1 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer whitespace-nowrap"
                              >
                                Tandai dibaca
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setShowNotifications(false)}
                              aria-label="Tutup pemberitahuan"
                              className="text-neutral-400 hover:text-neutral-700 p-1 rounded-full hover:bg-neutral-100 transition-colors cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="max-h-80 overflow-y-auto divide-y divide-neutral-100 bg-white">
                          {notifications.length === 0 ? (
                            <div className="p-8 text-center text-xs text-neutral-400">
                              Tidak ada notifikasi baru
                            </div>
                          ) : (
                            notifications.map(n => (
                              <div
                                key={n.id}
                                onClick={() => {
                                  markNotificationAsRead(n.id);
                                  setShowNotifications(false);
                                  onNavigateNotification?.(n);
                                }}
                                className={`group p-3.5 active:scale-[0.99] cursor-pointer transition-all flex items-start gap-3 border-l-[3px] ${
                                  !n.read
                                    ? 'bg-rose-50/45 hover:bg-rose-50/75 border-l-rose-500'
                                    : 'bg-white hover:bg-neutral-50 border-l-transparent'
                                }`}
                              >
                                <div className={!n.read ? 'shrink-0 mt-0.5' : 'shrink-0 mt-0.5 opacity-55'}>
                                  {n.type === 'order' && (
                                    <div className="w-7 h-7 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                    </div>
                                  )}
                                  {n.type === 'low_stock' && (
                                    <div className="w-7 h-7 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                                      <AlertTriangle className="w-3.5 h-3.5" />
                                    </div>
                                  )}
                                  {n.type === 'social_sync' && (
                                    <div className="w-7 h-7 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-700">
                                      <RefreshCw className="w-3.5 h-3.5" />
                                    </div>
                                  )}
                                  {n.type === 'system' && (
                                    <div className="w-7 h-7 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-600">
                                      <Store className="w-3.5 h-3.5" />
                                    </div>
                                  )}
                                  {n.type === 'chat' && (
                                    <div className="w-7 h-7 rounded-full bg-neutral-900 text-white flex items-center justify-center">
                                      <MessageSquare className="w-3.5 h-3.5" />
                                    </div>
                                  )}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <p
                                        className={`text-xs truncate ${
                                          !n.read
                                            ? 'font-bold text-neutral-950'
                                            : 'font-medium text-neutral-600'
                                        }`}
                                      >
                                        {n.title}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {!n.read && (
                                        <span
                                          aria-label="Belum dibaca"
                                          title="Belum dibaca"
                                          className="w-2 h-2 rounded-full bg-rose-500 ring-2 ring-rose-100 shrink-0"
                                        />
                                      )}
                                      <ChevronRight className="w-3.5 h-3.5 text-neutral-300 group-hover:text-neutral-700 group-hover:translate-x-0.5 transition-all shrink-0" />
                                    </div>
                                  </div>
                                  <p
                                    className={`text-xs mt-0.5 line-clamp-2 leading-relaxed ${
                                      !n.read ? 'text-neutral-700 font-medium' : 'text-neutral-400'
                                    }`}
                                  >
                                    {n.message}
                                  </p>
                                  <span
                                    className={`text-[10px] mt-1 block ${
                                      !n.read ? 'text-rose-600 font-semibold' : 'text-neutral-400'
                                    }`}
                                  >
                                    {n.time}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

            </div>

          </div>
        </div>
      </header>
    </>
  );
};
