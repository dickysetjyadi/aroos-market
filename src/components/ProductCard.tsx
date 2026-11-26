import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Product } from '../types';
import { getCategorySpec } from '../data/categorySpecs';

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
  isWishlisted?: boolean;
  isOwnProduct?: boolean;
  onToggleWishlist?: (product: Product, e: React.MouseEvent) => void;
  onOpenStore?: (brandName: string, sellerId?: string) => void;
}

function formatRelativeTime(isoDate?: string): string {
  if (!isoDate) return 'Baru saja';
  const parsed = Date.parse(isoDate);
  if (Number.isNaN(parsed)) return 'Baru saja';

  const diffMs = Math.max(0, Date.now() - parsed);
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Baru saja';
  if (diffMins < 60) return `${diffMins} mnt lalu`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} jam lalu`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} hari lalu`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `${diffWeeks} mgg lalu`;

  const diffMonths = Math.floor(diffDays / 30);
  return `${Math.max(1, diffMonths)} bln lalu`;
}

function formatCompactSizes(sizes: string[]): string {
  if (!sizes || sizes.length === 0) return 'All Size';
  if (sizes.length === 1) {
    const single = sizes[0].trim();
    if (/all size/i.test(single)) return 'All Size';
    if (/one size/i.test(single)) return 'One Size';
    return single;
  }

  const joined = sizes.join(', ');
  if (sizes.length <= 4 && joined.length <= 16) {
    return joined;
  }

  return `${sizes[0]}–${sizes[sizes.length - 1]}`;
}

function getSellerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'AR';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

const HeartWithCountIcon: React.FC<{
  count: number;
  filled: boolean;
}> = ({ count, filled }) => {
  const displayCount = count > 999 ? '999+' : count >= 1 ? String(count) : '';
  const textSizeClass = count > 99 ? 'text-[6px]' : count >= 10 ? 'text-[7.5px]' : 'text-[8.5px]';

  return (
    <div className="relative w-6 h-6 flex items-center justify-center">
      <svg
        viewBox="0 0 24 24"
        className={`w-[22px] h-[22px] transition-transform duration-150 ${
          filled
            ? 'fill-rose-500 text-rose-500 scale-105'
            : 'fill-transparent text-neutral-600 group-hover/heart:text-neutral-900'
        }`}
        stroke="currentColor"
        strokeWidth={1.85}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
      {displayCount && (
        <span
          className={`absolute inset-0 flex items-center justify-center pb-[1px] font-bold tabular-nums leading-none pointer-events-none ${textSizeClass} ${
            filled ? 'text-white' : 'text-neutral-800'
          }`}
        >
          {displayCount}
        </span>
      )}
    </div>
  );
};

export const ProductCard: React.FC<ProductCardProps> = React.memo(({
  product,
  onSelect,
  isWishlisted = false,
  isOwnProduct = false,
  onToggleWishlist,
  onOpenStore,
}) => {
  const galleryImages = useMemo(
    () => Array.from(new Set([product.image, ...(product.images || [])].filter(Boolean))),
    [product.image, product.images]
  );

  const [slideIndex, setSlideIndex] = useState(0);
  const [failedSlides, setFailedSlides] = useState<Record<number, boolean>>({});
  const [avatarError, setAvatarError] = useState(false);

  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const didSwipeRef = useRef(false);

  useEffect(() => {
    setSlideIndex(0);
    setFailedSlides({});
  }, [product.id, product.image]);

  useEffect(() => {
    setAvatarError(false);
  }, [product.sellerAvatar]);

  const isSoldOut = product.listingStatus === 'sold' || product.stock <= 0;
  const isReserved = !isSoldOut && product.listingStatus === 'reserved';
  const sellerName = product.sellerBrandName || product.brand || 'Penjual';
  const relativeTime = formatRelativeTime(product.createdAt);
  const spec = getCategorySpec(product.category);
  const showSizeInfo = spec.supportsSize && product.sizes && product.sizes.length > 0;
  const compactSize = formatCompactSizes(product.sizes);
  const conditionLabel = product.condition || 'Baru';
  const likesCount = Math.max(0, product.likesCount ?? 0);
  const hasMultipleImages = galleryImages.length > 1;

  const handleHeartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleWishlist) {
      onToggleWishlist(product, e);
    }
  };

  const handleSellerClick = (e: React.MouseEvent) => {
    if (onOpenStore) {
      e.stopPropagation();
      onOpenStore(sellerName, product.sellerId);
    }
  };

  const handlePrevSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSlideIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
  };

  const handleNextSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSlideIndex((prev) => (prev + 1) % galleryImages.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!hasMultipleImages || e.touches.length !== 1) return;
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    didSwipeRef.current = false;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!hasMultipleImages || touchStartXRef.current === null || touchStartYRef.current === null) {
      return;
    }
    const touch = e.changedTouches[0];
    if (!touch) return;

    const dx = touch.clientX - touchStartXRef.current;
    const dy = touch.clientY - touchStartYRef.current;
    touchStartXRef.current = null;
    touchStartYRef.current = null;

    if (Math.abs(dx) > 32 && Math.abs(dx) > Math.abs(dy) * 1.15) {
      didSwipeRef.current = true;
      if (dx < 0) {
        setSlideIndex((prev) => Math.min(galleryImages.length - 1, prev + 1));
      } else {
        setSlideIndex((prev) => Math.max(0, prev - 1));
      }
    }
  };

  const handleCardClick = () => {
    if (didSwipeRef.current) {
      didSwipeRef.current = false;
      return;
    }
    onSelect(product);
  };

  const SellerHeaderContent = (
    <>
      {product.sellerAvatar && !avatarError ? (
        <img
          src={product.sellerAvatar}
          alt={sellerName}
          onError={() => setAvatarError(true)}
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          className="w-6 h-6 sm:w-8 sm:h-8 rounded-full object-cover border border-neutral-200/80 shrink-0"
        />
      ) : (
        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-neutral-100 border border-neutral-200/80 flex items-center justify-center text-[9px] sm:text-[11px] font-semibold text-neutral-700 shrink-0">
          {getSellerInitials(sellerName)}
        </div>
      )}
      <div className="min-w-0 flex-1 text-left">
        <p className="text-[11px] sm:text-[13px] font-semibold text-neutral-900 truncate leading-tight">
          {sellerName}
        </p>
        <p className="text-[10px] sm:text-[11px] text-neutral-400 truncate leading-tight mt-0.5">
          {relativeTime}
        </p>
      </div>
    </>
  );

  return (
    <article
      onClick={handleCardClick}
      className="group cursor-pointer flex flex-col w-full text-left select-none transition-transform duration-150 active:scale-[0.99]"
    >
      {/* Top Seller Header Row */}
      {onOpenStore ? (
        <button
          type="button"
          onClick={handleSellerClick}
          className="flex items-center gap-2 sm:gap-2.5 mb-1.5 sm:mb-2 min-w-0 w-full rounded-lg py-0.5 hover:opacity-80 transition-opacity cursor-pointer"
          title={`Lihat lapak ${sellerName}`}
        >
          {SellerHeaderContent}
        </button>
      ) : (
        <div className="flex items-center gap-2 sm:gap-2.5 mb-1.5 sm:mb-2 min-w-0 w-full py-0.5">
          {SellerHeaderContent}
        </div>
      )}

      {/* Clean Light-Mode Product Photo Frame with Inline Slider */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative aspect-[4/5] w-full bg-neutral-100 rounded-xl sm:rounded-2xl overflow-hidden border border-neutral-200/70 mb-2 sm:mb-2.5 touch-pan-y"
      >
        {galleryImages.length > 0 ? (
          <div
            className="flex w-full h-full transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${slideIndex * 100}%)` }}
          >
            {galleryImages.map((imgUrl, idx) => (
              <div key={`${product.id}-slide-${idx}`} className="w-full h-full shrink-0">
                {!failedSlides[idx] ? (
                  <img
                    src={imgUrl}
                    alt={idx === 0 ? product.name : `${product.name} (${idx + 1})`}
                    onError={() =>
                      setFailedSlides((prev) => ({ ...prev, [idx]: true }))
                    }
                    className={`w-full h-full object-cover object-center transition-transform duration-500 ease-out ${
                      !hasMultipleImages ? 'group-hover:scale-[1.03]' : ''
                    } ${isSoldOut ? 'opacity-55 grayscale-[35%]' : ''}`}
                    referrerPolicy="no-referrer"
                    loading={idx === 0 ? 'lazy' : 'eager'}
                    decoding="async"
                    draggable={false}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-b from-neutral-100 to-neutral-200/70 text-neutral-400 text-center">
                    <div className="w-11 h-11 rounded-full border border-neutral-300 flex items-center justify-center mb-2 text-neutral-500 text-xs font-semibold">
                      {getSellerInitials(sellerName)}
                    </div>
                    <span className="text-[11px] font-medium text-neutral-500 line-clamp-2">
                      {product.name}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-b from-neutral-100 to-neutral-200/70 text-neutral-400 text-center">
            <div className="w-11 h-11 rounded-full border border-neutral-300 flex items-center justify-center mb-2 text-neutral-500 text-xs font-semibold">
              {getSellerInitials(sellerName)}
            </div>
            <span className="text-[11px] font-medium text-neutral-500 line-clamp-2">
              {product.name}
            </span>
          </div>
        )}

        {/* Desktop Prev / Next Controls on Hover */}
        {hasMultipleImages && (
          <>
            <button
              type="button"
              onClick={handlePrevSlide}
              aria-label="Foto sebelumnya"
              className="hidden sm:flex items-center justify-center absolute left-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white/85 hover:bg-white text-neutral-800 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextSlide}
              aria-label="Foto berikutnya"
              className="hidden sm:flex items-center justify-center absolute right-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white/85 hover:bg-white text-neutral-800 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Pagination Dots */}
        {hasMultipleImages && (
          <div
            className={`absolute left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 px-2 py-1 rounded-full bg-black/30 backdrop-blur-xs pointer-events-none ${
              isSoldOut || isReserved ? 'bottom-8' : 'bottom-2.5'
            }`}
          >
            {galleryImages.slice(0, 6).map((_, idx) => (
              <span
                key={`dot-${idx}`}
                className={`rounded-full transition-all duration-200 ${
                  slideIndex === idx ? 'w-3 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/55'
                }`}
              />
            ))}
          </div>
        )}

        {/* Minimal Status Overlay Only for Sold / Reserved */}
        {isSoldOut ? (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-3 py-2.5 pointer-events-none">
            <span className="text-[11px] font-semibold text-white tracking-wide">
              Terjual
            </span>
          </div>
        ) : isReserved ? (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/35 to-transparent px-3 py-2.5 pointer-events-none">
            <span className="text-[11px] font-semibold text-amber-200 tracking-wide">
              Reserved
            </span>
          </div>
        ) : null}
      </div>

      {/* Bottom Informative Details: Name + Heart -> Bold Price -> Size · Condition */}
      <div className="space-y-1 px-0.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[13px] sm:text-sm font-medium text-neutral-900 leading-snug line-clamp-2 min-h-[2.25rem] sm:min-h-[2.5rem] flex-1 min-w-0 group-hover:text-black transition-colors">
            {product.name}
          </h3>
          {!isOwnProduct && onToggleWishlist ? (
            <button
              type="button"
              onClick={handleHeartClick}
              className="group/heart shrink-0 inline-flex items-center justify-center p-0 bg-transparent border-0 transition-transform duration-150 active:scale-75 cursor-pointer"
              title={
                likesCount > 0
                  ? `${likesCount} menyukai · ${isWishlisted ? 'Hapus dari Wishlist' : 'Simpan ke Wishlist'}`
                  : isWishlisted
                  ? 'Hapus dari Wishlist'
                  : 'Simpan ke Wishlist'
              }
              aria-label={
                isWishlisted
                  ? `Hapus ${product.name} dari wishlist`
                  : `Simpan ${product.name} ke wishlist`
              }
            >
              <HeartWithCountIcon count={likesCount} filled={isWishlisted} />
            </button>
          ) : isOwnProduct && likesCount >= 1 ? (
            <div
              className="shrink-0 inline-flex items-center justify-center pointer-events-none"
              title={`${likesCount} pengguna menyukai barang ini`}
            >
              <HeartWithCountIcon count={likesCount} filled={false} />
            </div>
          ) : null}
        </div>
        <p className="text-[15px] sm:text-base font-bold text-neutral-900 tabular-nums tracking-tight leading-snug">
          Rp {product.price.toLocaleString('id-ID')}
        </p>
        <p className="text-xs text-neutral-500 leading-snug truncate">
          {showSizeInfo ? `Size: ${compactSize}` : (product.subCategory || spec.label)}{' '}
          <span aria-hidden="true">·</span> {conditionLabel}
        </p>
      </div>
    </article>
  );
});

ProductCard.displayName = 'ProductCard';
