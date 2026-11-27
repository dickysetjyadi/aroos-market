import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Layers, Heart, MessageSquare } from 'lucide-react';

interface MobileNavProps {
  activeMode: 'shopper' | 'seller' | 'profile';
  setActiveMode: (mode: 'shopper' | 'seller' | 'profile') => void;
  isRegistered?: boolean;
  wishlistCount?: number;
  isWishlistActive?: boolean;
  onToggleWishlistView?: () => void;
  onOpenChat?: () => void;
  unreadChatCount?: number;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeMode,
  setActiveMode,
  isRegistered = false,
  wishlistCount = 0,
  isWishlistActive = false,
  onToggleWishlistView,
  onOpenChat,
  unreadChatCount = 0,
}) => {
  const handleHomeClick = () => {
    if (activeMode !== 'shopper') {
      setActiveMode('shopper');
    }
    if (isWishlistActive && onToggleWishlistView) {
      onToggleWishlistView();
    }
  };

  const handleWishlistClick = () => {
    if (activeMode !== 'shopper') {
      setActiveMode('shopper');
    }
    if (onToggleWishlistView) {
      onToggleWishlistView();
    }
  };

  return (
    <div className="fixed bottom-[max(0.875rem,env(safe-area-inset-bottom))] left-0 right-0 flex justify-center z-40 md:hidden pointer-events-none px-3 select-none">
      <nav
        aria-label="Floating Mobile Navigation"
        className="pointer-events-auto relative flex items-center p-1 gap-0.5 rounded-full
          bg-white/85 backdrop-blur-xl
          border border-white/60 shadow-[0_8px_24px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.04)]
          transition-all max-w-full"
      >
        {/* Tab 1: Home */}
        <button
          type="button"
          onClick={handleHomeClick}
          className={`relative z-10 flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-full transition-colors duration-200 cursor-pointer whitespace-nowrap ${
            activeMode === 'shopper' && !isWishlistActive
              ? 'text-white font-semibold'
              : 'text-neutral-700 hover:text-neutral-900 active:scale-95 font-medium'
          }`}
        >
          {activeMode === 'shopper' && !isWishlistActive && (
            <motion.div
              layoutId="active-liquid-pill"
              transition={{
                type: 'spring',
                stiffness: 500,
                damping: 36,
                mass: 0.6,
              }}
              className="absolute inset-0 rounded-full bg-neutral-900 shadow-[0_2px_8px_rgba(0,0,0,0.2)] -z-10"
            />
          )}
          <Layers className="w-3.5 h-3.5 shrink-0 stroke-[2]" />
          <span className="text-[11px] tracking-tight leading-none">
            Home
          </span>
        </button>

        {/* Tab 2: Wishlist (Hanya tampil jika sudah login) */}
        {isRegistered && (
          <button
            type="button"
            onClick={handleWishlistClick}
            className={`relative z-10 flex items-center gap-1.5 px-3 py-2 rounded-full transition-colors duration-200 cursor-pointer whitespace-nowrap ${
              isWishlistActive && activeMode === 'shopper'
                ? 'text-white font-semibold'
                : 'text-neutral-700 hover:text-neutral-900 active:scale-95 font-medium'
            }`}
          >
            {isWishlistActive && activeMode === 'shopper' && (
              <motion.div
                layoutId="active-liquid-pill"
                transition={{
                  type: 'spring',
                  stiffness: 500,
                  damping: 36,
                  mass: 0.6,
                }}
                className="absolute inset-0 rounded-full bg-neutral-900 shadow-[0_2px_8px_rgba(0,0,0,0.2)] -z-10"
              />
            )}
            <div className="relative flex items-center">
              <Heart
                className={`w-3.5 h-3.5 shrink-0 stroke-[2] ${
                  isWishlistActive && activeMode === 'shopper' ? 'fill-white text-white' : ''
                }`}
              />
              {wishlistCount > 0 && !(isWishlistActive && activeMode === 'shopper') && (
                <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[8px] font-mono font-bold w-3 h-3 rounded-full flex items-center justify-center ring-1 ring-white">
                  {wishlistCount}
                </span>
              )}
            </div>
            <span className="text-[11px] tracking-tight leading-none">
              Wishlist
            </span>
          </button>
        )}

        {/* Tab 3: Chat */}
        {onOpenChat && (() => {
          const hasUnreadAlert = Boolean(isRegistered && unreadChatCount > 0);
          return (
            <button
              type="button"
              onClick={onOpenChat}
              aria-label={
                hasUnreadAlert
                  ? `Chat (${unreadChatCount} pesan belum dibaca)`
                  : 'Chat'
              }
              className={`relative z-10 flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-full transition-colors duration-200 cursor-pointer active:scale-95 whitespace-nowrap ${
                hasUnreadAlert
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-sm aroos-chat-shake font-semibold'
                  : 'text-neutral-700 hover:text-neutral-900 font-medium'
              }`}
            >
              <div className="relative flex items-center">
                <MessageSquare className="w-3.5 h-3.5 shrink-0 stroke-[2]" />
                <AnimatePresence>
                  {hasUnreadAlert && (
                    <motion.span
                      key="mobile-chat-unread-badge"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 520, damping: 28 }}
                      className="ml-1 bg-white text-red-600 text-[9px] font-bold tabular-nums min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center shadow-2xs"
                    >
                      {unreadChatCount > 99 ? '99+' : unreadChatCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <span className="text-[11px] tracking-tight leading-none">
                Chat
              </span>
            </button>
          );
        })()}
      </nav>
    </div>
  );
};
