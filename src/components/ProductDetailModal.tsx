import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Star, Check,
  ThumbsUp, Plus, ChevronDown, ChevronLeft, ChevronRight,
  MessageSquare, Camera, Maximize2, Sparkles, MapPin, Search,
  Share2, UserPlus, UserCheck, Heart, Flag
} from 'lucide-react';
import { Product, Review, ChatProductContext } from '../types';
import { ReportTarget } from './ReportModal';
import { getCategorySpec } from '../data/categorySpecs';
import { buildProductShareUrl, copyTextToClipboard } from '../utils/marketplaceSocial';
import { useConfirm } from './ConfirmDialogContext';
import { compressImageForUpload } from '../utils/imageCompression';
import { PRODUCT_ASSETS } from '../assets/productAssets';
import {
  AROOS_BACKDROP_TRANSITION,
  AROOS_MODAL_TRANSITION,
  AROOS_MODAL_VARIANTS,
} from '../utils/motionPresets';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  reviews: Review[];
  onAddReview: (review: Omit<Review, 'id' | 'date' | 'helpfulCount'>) => Promise<void> | void;
  onOpenStore?: (brandName: string, sellerId?: string) => void;
  onOpenChat?: (brandName: string, productContext?: ChatProductContext) => void;
  isRegistered?: boolean;
  isOwnProduct?: boolean;
  canWriteReview?: boolean;
  alreadyReviewed?: boolean;
  hasPendingPurchase?: boolean;
  helpfulVotedIds?: string[];
  onToggleHelpfulReview?: (reviewId: string) => void;
  currentUserName?: string;
  currentUserCity?: string;
  onRequireAuthForReview?: () => void;
  onFindSimilar?: (product: Product) => void;
  isSellerFollowed?: boolean;
  sellerFollowerCount?: number;
  onToggleFollowSeller?: (brandName: string, sellerId?: string) => void;
  onShareProduct?: (product: Product, shareUrl: string) => void;
  onOpenFollowers?: (brandName: string, sellerId?: string) => void;
  onReport?: (target: ReportTarget) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  reviews,
  onAddReview,
  onOpenStore,
  onOpenChat,
  isRegistered = false,
  isOwnProduct = false,
  canWriteReview = false,
  alreadyReviewed = false,
  hasPendingPurchase = false,
  helpfulVotedIds = [],
  onToggleHelpfulReview,
  currentUserName = '',
  currentUserCity = 'Jakarta',
  onRequireAuthForReview,
  onFindSimilar,
  isSellerFollowed = false,
  sellerFollowerCount = 0,
  onToggleFollowSeller,
  onShareProduct,
  onOpenFollowers,
  onReport,
}) => {
  const confirm = useConfirm();

  const rawGalleryImages = product
    ? product.images && product.images.length > 0
      ? product.images
      : [product.image]
    : [];
  const galleryImages = Array.from(new Set(rawGalleryImages.filter(Boolean)));
  const categorySpec = getCategorySpec(product?.category || 'Atasan');
  const hasSizes = Boolean(product && categorySpec.supportsSize && product.sizes && product.sizes.length > 0);

  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [selectedSize, setSelectedSize] = useState<string>(hasSizes && product ? product.sizes[0] : 'Standar');
  const [selectedColor, setSelectedColor] = useState<string>(product?.colors[0] || 'Default');
  const [showReviewForm, setShowReviewForm] = useState<boolean>(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState<boolean>(false);
  const [failedImageIndices, setFailedImageIndices] = useState<Record<number, boolean>>({});
  const [sellerAvatarError, setSellerAvatarError] = useState<boolean>(false);

  // Review form states with Photo Attachment support
  const [newRating, setNewRating] = useState<number>(5);
  const [newAuthor, setNewAuthor] = useState<string>(currentUserName || '');
  const [newCity, setNewCity] = useState<string>(currentUserCity || 'Jakarta');
  const [newComment, setNewComment] = useState<string>('');
  const [newUserStats, setNewUserStats] = useState<string>('');
  const [newFitFeedback, setNewFitFeedback] = useState<'Pas' | 'Agak Kecil' | 'Agak Longgar'>('Pas');
  const [attachedPhotos, setAttachedPhotos] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);
  const [reviewSubmitError, setReviewSubmitError] = useState<string | null>(null);
  
  // Review filter & Lightbox states
  const [reviewFilter, setReviewFilter] = useState<'all' | 'with_photo' | '5_star' | '4_star'>('all');
  const [activeLightbox, setActiveLightbox] = useState<{
    imageUrl: string;
    author: string;
    comment: string;
    rating: number;
    userStats?: string;
  } | null>(null);

  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const reviewFileInputRef = useRef<HTMLInputElement>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  useEffect(() => {
    setActiveImageIndex(0);
    setFailedImageIndices({});
    setSellerAvatarError(false);
    setShowReviewForm(false);
    setIsDescriptionExpanded(false);
    if (product) {
      const spec = getCategorySpec(product.category);
      const supportsSize = spec.supportsSize && product.sizes && product.sizes.length > 0;
      setSelectedSize(supportsSize ? product.sizes[0] : 'Standar');
      setSelectedColor(product.colors[0] || 'Default');
    }
  }, [product?.id]);

  useEffect(() => {
    if (!canWriteReview || isOwnProduct) {
      setShowReviewForm(false);
    }
  }, [canWriteReview, isOwnProduct]);

  useEffect(() => {
    if (!product || activeLightbox || galleryImages.length <= 1) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setActiveImageIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setActiveImageIndex((prev) => (prev + 1) % galleryImages.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [product?.id, activeLightbox, galleryImages.length]);

  if (!product) return null;

  const isSoldOut = product.listingStatus === 'sold' || product.stock <= 0;
  const isReserved = !isSoldOut && product.listingStatus === 'reserved';

  const goToPrevImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (galleryImages.length <= 1) return;
    setActiveImageIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
  };

  const goToNextImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (galleryImages.length <= 1) return;
    setActiveImageIndex((prev) => (prev + 1) % galleryImages.length);
  };

  const handleCopyProductLink = async () => {
    const shareUrl = buildProductShareUrl(product.id);
    const copied = await copyTextToClipboard(shareUrl);
    if (copied) {
      setCopiedShareLink(true);
      window.setTimeout(() => setCopiedShareLink(false), 2200);
    }
    onShareProduct?.(product, shareUrl);
  };

  const productReviews = reviews.filter(r => r.productId === product.id);
  const fitPasCount = productReviews.filter(r => r.fitFeedback === 'Pas').length;
  const fitSmallCount = productReviews.filter(r => r.fitFeedback === 'Agak Kecil').length;
  const fitLooseCount = productReviews.filter(r => r.fitFeedback === 'Agak Longgar').length;
  const totalFitVotes = fitPasCount + fitSmallCount + fitLooseCount;
  const fitPercentage = totalFitVotes > 0
    ? Math.round((fitPasCount / totalFitVotes) * 100)
    : null;

  // Filtered reviews
  const filteredReviews = productReviews.filter(r => {
    if (reviewFilter === 'with_photo') return r.images && r.images.length > 0;
    if (reviewFilter === '5_star') return r.rating === 5;
    if (reviewFilter === '4_star') return r.rating === 4;
    return true;
  });

  // Collect all photos from all reviews for this product
  const allBuyerPhotos = productReviews.flatMap(r => 
    (r.images || []).map(img => ({
      imageUrl: img,
      author: r.author,
      comment: r.comment,
      rating: r.rating,
      userStats: r.userStats,
    }))
  );


  // Handle Photo Attachment by User
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    e.target.value = '';
    if (!files || files.length === 0) return;

    const remainingSlots = Math.max(0, 4 - attachedPhotos.length);
    if (remainingSlots <= 0 || files.length > remainingSlots) {
      setPhotoError('Maksimal 4 foto per ulasan.');
      if (remainingSlots <= 0) return;
    }

    setPhotoError(null);
    for (const file of Array.from(files).slice(0, remainingSlots)) {
      if (file.size > 25 * 1024 * 1024) {
        setPhotoError('Ukuran setiap foto maksimal 25MB.');
        continue;
      }
      try {
        const compressed = await compressImageForUpload(file, {
          maxDimension: 760,
          quality: 0.72,
          maxDataUrlLength: 200_000,
        });
        setAttachedPhotos((prev) => [...prev, compressed].slice(0, 4));
      } catch (err) {
        setPhotoError(
          err instanceof Error ? err.message : 'Gagal memproses foto ulasan.'
        );
      }
    }
  };

  const handleRemovePhoto = async (index: number) => {
    const ok = await confirm({
      title: 'Hapus Foto',
      message: 'Hapus foto ulasan ini?',
      confirmLabel: 'Hapus',
      tone: 'danger',
    });
    if (ok) {
      setAttachedPhotos(prev => prev.filter((_, i) => i !== index));
    }
  };

  // Quick preset photos for easy testing
  const handleAddPresetPhoto = () => {
    const presets = [
      product.image,
      PRODUCT_ASSETS.heroLocalFashion,
      PRODUCT_ASSETS.productDenimJacket,
    ];
    const nextPhoto = presets[attachedPhotos.length % presets.length];
    if (attachedPhotos.length < 4) {
      setAttachedPhotos(prev => [...prev, nextPhoto]);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWriteReview || isOwnProduct) return;
    if (!newAuthor.trim() || !newComment.trim() || isSubmittingReview) return;
    setReviewSubmitError(null);

    const ok = await confirm({
      title: 'Kirim Ulasan',
      message: `Kirim ulasan ${newRating}/5 untuk "${product.name}"?`,
      confirmLabel: 'Kirim',
    });
    if (!ok) return;

    setIsSubmittingReview(true);
    try {
      await onAddReview({
        productId: product.id,
        author: newAuthor.trim(),
        city: newCity,
        rating: newRating,
        comment: newComment.trim(),
        sizePurchased: selectedSize,
        fitFeedback: newFitFeedback,
        verifiedPurchase: true,
        images: attachedPhotos.length > 0 ? attachedPhotos : undefined,
        userStats: newUserStats.trim() || undefined,
      });

      setNewAuthor('');
      setNewComment('');
      setNewUserStats('');
      setAttachedPhotos([]);
      setShowReviewForm(false);
    } catch (err) {
      setReviewSubmitError(
        err instanceof Error ? err.message : 'Gagal menyimpan ulasan ke server. Silakan coba lagi.'
      );
    } finally {
      setIsSubmittingReview(false);
    }
  };


  return (
    <motion.div
      key="product-detail-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={AROOS_BACKDROP_TRANSITION}
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-6"
      onClick={onClose}
    >
      <motion.div
        key="product-detail-modal"
        variants={AROOS_MODAL_VARIANTS}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={AROOS_MODAL_TRANSITION}
        className="relative bg-white rounded-3xl max-w-5xl w-full shadow-2xl overflow-hidden border border-neutral-200 max-h-[94dvh] sm:max-h-[90vh] flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar — Unified Seller Identity & Actions */}
        <div className="px-3.5 py-2.5 sm:px-6 sm:py-3.5 border-b border-neutral-100 bg-white sticky top-0 z-10 shrink-0">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2.5 md:gap-4">
            {/* Row 1: Seller Avatar, Single Name, Location/Followers + Mobile Share/Close */}
            <div className="flex items-center justify-between gap-2 min-w-0 flex-1">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {product.sellerAvatar && !sellerAvatarError ? (
                  <img
                    src={product.sellerAvatar}
                    alt={product.sellerBrandName || product.brand}
                    onError={() => setSellerAvatarError(true)}
                    className="w-9 h-9 rounded-xl object-cover border border-neutral-200 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-neutral-900 text-white flex items-center justify-center font-mono font-bold text-xs uppercase overflow-hidden shrink-0">
                    {(product.sellerBrandName || product.brand).slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {onOpenStore ? (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenStore(product.sellerBrandName || product.brand, product.sellerId);
                      }}
                      className="text-xs sm:text-sm font-bold text-neutral-900 hover:underline underline-offset-2 truncate leading-tight block text-left cursor-pointer"
                    >
                      {product.sellerBrandName || product.brand}
                    </button>
                  ) : (
                    <p className="text-xs sm:text-sm font-bold text-neutral-900 truncate leading-tight">
                      {product.sellerBrandName || product.brand}
                    </p>
                  )}
                  <p className="text-[11px] text-neutral-500 truncate tabular-nums flex items-center gap-1.5 mt-0.5">
                    <span className="truncate">{product.brandCity || 'Indonesia'}</span>
                    <span aria-hidden="true">·</span>
                    {onOpenFollowers ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenFollowers(product.sellerBrandName || product.brand, product.sellerId);
                        }}
                        className="font-semibold text-neutral-700 hover:text-neutral-900 hover:underline underline-offset-2 cursor-pointer transition-colors shrink-0"
                      >
                        {sellerFollowerCount} Pengikut
                      </button>
                    ) : (
                      <span className="shrink-0">{sellerFollowerCount} Pengikut</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Mobile Share & Close (plus Toko on own product) */}
              <div className="flex md:hidden items-center gap-1.5 shrink-0">
                {isOwnProduct && onOpenStore && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenStore(product.sellerBrandName || product.brand, product.sellerId);
                    }}
                    className="h-8 px-2.5 bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-200 rounded-full text-[11px] font-semibold transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                  >
                    Toko
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCopyProductLink}
                  className={`inline-flex items-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-full text-[11px] font-semibold border transition-all active:scale-95 cursor-pointer whitespace-nowrap ${
                    copiedShareLink
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border-neutral-200/80'
                  }`}
                  aria-label="Bagikan link produk"
                >
                  {copiedShareLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Disalin</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Bagikan</span>
                    </>
                  )}
                </button>
                {!isOwnProduct && onReport && (
                  <button
                    type="button"
                    onClick={() => {
                      onReport({
                        reportedUserId: product.sellerId || product.sellerBrandName || product.brand,
                        reportedUserName: product.sellerBrandName || product.brand,
                        source: 'product',
                        targetProductId: product.id,
                        targetProductName: product.name,
                      });
                    }}
                    className="p-1.5 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors shrink-0 cursor-pointer"
                    aria-label="Laporkan produk atau penjual"
                    title="Laporkan"
                  >
                    <Flag className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 rounded-full transition-colors shrink-0 cursor-pointer"
                  aria-label="Tutup"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Row 2 (Mobile) / Right Cluster (Desktop): Ikuti, Chat, Toko + Desktop Bagikan & Close */}
            <div className="flex items-center gap-1.5 shrink-0">
              {((onToggleFollowSeller && !isOwnProduct) ||
                (onOpenChat && !isOwnProduct) ||
                onOpenStore) && (
                <div
                  className={`flex items-center gap-1.5 flex-1 md:flex-none ${
                    isOwnProduct ? 'hidden md:flex' : ''
                  }`}
                >
                  {onToggleFollowSeller && !isOwnProduct && (
                    <button
                      type="button"
                      onClick={() =>
                        onToggleFollowSeller(product.sellerBrandName || product.brand, product.sellerId)
                      }
                      className={`flex-1 md:flex-none justify-center h-8 px-3 rounded-xl text-[11px] font-semibold transition-all active:scale-95 cursor-pointer inline-flex items-center gap-1 whitespace-nowrap shrink-0 border ${
                        isSellerFollowed
                          ? 'bg-white text-neutral-800 border-neutral-300 hover:bg-neutral-100'
                          : 'bg-red-600 hover:bg-red-700 text-white border-red-600 shadow-2xs'
                      }`}
                    >
                      {isSellerFollowed ? (
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
                  {onOpenChat && !isOwnProduct && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenChat(product.sellerBrandName || product.brand, {
                          id: product.id,
                          name: product.name,
                          price: product.price,
                          image: product.image,
                          brand: product.sellerBrandName || product.brand,
                          sellerId: product.sellerId,
                          status: isSoldOut ? 'Sold Out' : 'Tersedia',
                        });
                      }}
                      className="flex-1 md:flex-none justify-center h-8 px-3 bg-neutral-900 hover:bg-black text-white rounded-xl text-[11px] font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                      <MessageSquare className="w-3 h-3 shrink-0" />
                      <span>Chat</span>
                    </button>
                  )}
                  {onOpenStore && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenStore(product.sellerBrandName || product.brand, product.sellerId);
                      }}
                      className="flex-1 md:flex-none justify-center h-8 px-3 bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-200 rounded-xl text-[11px] font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer inline-flex items-center whitespace-nowrap shrink-0"
                    >
                      <span>Toko</span>
                    </button>
                  )}
                </div>
              )}

              {/* Desktop Share & Close */}
              <div className="hidden md:flex items-center gap-1.5 pl-1.5 border-l border-neutral-200/80 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyProductLink}
                  className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-semibold border transition-all active:scale-95 cursor-pointer whitespace-nowrap ${
                    copiedShareLink
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border-neutral-200/80'
                  }`}
                  aria-label="Bagikan link produk"
                >
                  {copiedShareLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Link Disalin</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Bagikan</span>
                    </>
                  )}
                </button>
                {!isOwnProduct && onReport && (
                  <button
                    type="button"
                    onClick={() => {
                      onReport({
                        reportedUserId: product.sellerId || product.sellerBrandName || product.brand,
                        reportedUserName: product.sellerBrandName || product.brand,
                        source: 'product',
                        targetProductId: product.id,
                        targetProductName: product.name,
                      });
                    }}
                    className="inline-flex items-center gap-1 h-8 px-2.5 rounded-full text-[11px] font-semibold border border-neutral-200/80 bg-neutral-50 hover:bg-red-50 text-neutral-600 hover:text-red-600 hover:border-red-200 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                    aria-label="Laporkan produk atau penjual"
                    title="Laporkan"
                  >
                    <Flag className="w-3.5 h-3.5 shrink-0" />
                    <span>Laporkan</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 rounded-full transition-colors shrink-0 cursor-pointer"
                  aria-label="Tutup"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto p-3.5 sm:p-7 space-y-5 sm:space-y-8 flex-1 touch-pan-y">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-10 items-start">
            
            {/* Left: Product Media Gallery - Seamless Multi-Photo Carousel */}
            <div className="md:col-span-7 space-y-2.5 sm:space-y-4">
              <div
                className="relative aspect-[4/3] sm:aspect-[4/5] w-full rounded-2xl sm:rounded-3xl overflow-hidden bg-[#f0f0f0] border border-neutral-200/90 shadow-sm group"
                onTouchStart={(e) => {
                  if (galleryImages.length <= 1) return;
                  touchStartXRef.current = e.touches[0].clientX;
                  touchStartYRef.current = e.touches[0].clientY;
                }}
                onTouchEnd={(e) => {
                  if (galleryImages.length <= 1 || touchStartXRef.current === null || touchStartYRef.current === null) {
                    touchStartXRef.current = null;
                    touchStartYRef.current = null;
                    return;
                  }
                  const dx = e.changedTouches[0].clientX - touchStartXRef.current;
                  const dy = e.changedTouches[0].clientY - touchStartYRef.current;
                  touchStartXRef.current = null;
                  touchStartYRef.current = null;
                  if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
                    if (dx < 0) goToNextImage();
                    else goToPrevImage();
                  }
                }}
              >
                <motion.div
                  className="flex w-full h-full"
                  animate={{ x: `-${activeImageIndex * 100}%` }}
                  transition={{ type: 'spring', stiffness: 360, damping: 36, mass: 0.85 }}
                >
                  {galleryImages.map((imgUrl, idx) => (
                    <div key={`${imgUrl}-${idx}`} className="w-full h-full shrink-0 relative">
                      {!failedImageIndices[idx] ? (
                        <img
                          src={imgUrl}
                          alt={`${product.name} - foto ${idx + 1}`}
                          onError={() => setFailedImageIndices((prev) => ({ ...prev, [idx]: true }))}
                          draggable={false}
                          decoding="async"
                          className={`w-full h-full object-cover object-center select-none group-hover:scale-[1.015] transition-transform duration-700 ease-out ${
                            isSoldOut ? 'opacity-60 grayscale-[35%]' : ''
                          }`}
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-b from-[#f5f5f5] to-[#ebebeb] text-neutral-400 font-mono text-center">
                          <span className="text-2xl font-bold tracking-widest uppercase text-neutral-500 mb-1">
                            {product.brand}
                          </span>
                          <span className="text-xs uppercase tracking-wider text-neutral-400">
                            {product.category}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </motion.div>

                {isSoldOut && (
                  <div className="absolute top-3 left-3 z-10 px-3 py-1 bg-neutral-900/90 text-white rounded-full font-mono text-[11px] font-semibold uppercase tracking-wider">
                    TERJUAL / HABIS
                  </div>
                )}
                {isReserved && (
                  <div className="absolute top-3 left-3 z-10 px-3 py-1 bg-amber-500/95 text-white rounded-full font-mono text-[11px] font-semibold tracking-wide">
                    {product.reservedByUserName ? `RESERVED · ${product.reservedByUserName}` : 'RESERVED'}
                  </div>
                )}

                {/* Seamless Left / Right Slide Buttons & Pagination Indicator */}
                {galleryImages.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={goToPrevImage}
                      aria-label="Foto sebelumnya"
                      className="absolute left-2.5 sm:left-3.5 top-1/2 -translate-y-1/2 z-10 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/90 hover:bg-white text-neutral-900 shadow-md border border-black/10 backdrop-blur-md flex items-center justify-center transition-all duration-150 active:scale-90 cursor-pointer"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={goToNextImage}
                      aria-label="Foto berikutnya"
                      className="absolute right-2.5 sm:right-3.5 top-1/2 -translate-y-1/2 z-10 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/90 hover:bg-white text-neutral-900 shadow-md border border-black/10 backdrop-blur-md flex items-center justify-center transition-all duration-150 active:scale-90 cursor-pointer"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>

                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md text-white">
                      <div className="flex items-center gap-1.5">
                        {galleryImages.map((_, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveImageIndex(idx);
                            }}
                            aria-label={`Lihat foto ${idx + 1}`}
                            className={`h-1.5 rounded-full transition-all duration-200 cursor-pointer ${
                              activeImageIndex === idx
                                ? 'w-4 bg-white'
                                : 'w-1.5 bg-white/50 hover:bg-white/80'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] font-medium tabular-nums text-white/90 pl-1 border-l border-white/25">
                        {activeImageIndex + 1}/{galleryImages.length}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {galleryImages.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {galleryImages.map((imgUrl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveImageIndex(idx)}
                      className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                        activeImageIndex === idx
                          ? 'border-neutral-900 opacity-100'
                          : 'border-neutral-200 opacity-65 hover:opacity-100'
                      }`}
                    >
                      <img src={imgUrl} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Product Specification & Purchase Controls */}
            <div className="md:col-span-5 space-y-3.5 sm:space-y-4">
              {/* Title & Price */}
              <div className="space-y-1.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 leading-snug break-words">
                  {product.name}
                </h1>
                <div className="flex items-baseline justify-between gap-2.5 flex-wrap">
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-xl sm:text-2xl font-extrabold text-neutral-900 tabular-nums">
                      Rp {product.price.toLocaleString('id-ID')}
                    </span>
                    {product.originalPrice && (
                      <span className="text-xs sm:text-sm text-neutral-400 line-through tabular-nums">
                        Rp {product.originalPrice.toLocaleString('id-ID')}
                      </span>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 tabular-nums">
                    <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500/20 shrink-0" />
                    <span>{Math.max(0, product.likesCount ?? 0)} disukai</span>
                  </span>
                </div>
                {isReserved && product.reservedByUserName && (
                  <p className="text-xs font-semibold text-amber-700 pt-0.5">
                    Dipesan / Reserved oleh {product.reservedByUserName}
                  </p>
                )}
              </div>

              {/* Inline Structured Specifications (Moved directly into Product Detail Modal) */}
              <div className="p-3.5 bg-neutral-50/90 rounded-2xl border border-neutral-200/80 space-y-2 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-neutral-500 shrink-0">Kategori</span>
                  <span className="font-semibold text-neutral-900 text-right">
                    {categorySpec.label}
                    {product.subCategory ? ` · ${product.subCategory}` : ''}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-neutral-500 shrink-0">Kondisi</span>
                  <span className="font-semibold text-neutral-900 text-right">
                    {product.condition || 'Baru'}
                  </span>
                </div>
                {categorySpec.supportsGender && product.gender && (
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-neutral-500 shrink-0">Gender</span>
                    <span className="font-semibold text-neutral-900 text-right">
                      {product.gender}
                    </span>
                  </div>
                )}
                {categorySpec.supportsFit && product.fit && (
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-neutral-500 shrink-0">Potongan / Fit</span>
                    <span className="font-semibold text-neutral-900 text-right">
                      {product.fit}
                    </span>
                  </div>
                )}
                {product.itemBrand && (
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-neutral-500 shrink-0">Merek Item</span>
                    <span className="font-semibold text-neutral-900 text-right">
                      {product.itemBrand}
                    </span>
                  </div>
                )}
                {product.material && product.material.trim() !== '-' && (
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-neutral-500 shrink-0">Material</span>
                    <span className="font-semibold text-neutral-900 text-right">
                      {product.material}
                    </span>
                  </div>
                )}
                <div className="flex items-start justify-between gap-3">
                  <span className="text-neutral-500 shrink-0">Stok Tersedia</span>
                  <span className="font-semibold text-neutral-900 text-right tabular-nums">
                    {product.stock} pcs
                  </span>
                </div>
                {(product.allowMeetup || product.brandCity) && (
                  <div className="flex items-start justify-between gap-3 pt-1.5 border-t border-neutral-200/70">
                    <span className="text-neutral-500 shrink-0 flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span>Lokasi / COD</span>
                    </span>
                    <span className="font-medium text-neutral-800 text-right">
                      {product.allowMeetup
                        ? product.meetupArea || `COD ${product.brandCity}`
                        : product.brandCity}
                    </span>
                  </div>
                )}
              </div>

              {/* Collapsible Product Description Section */}
              {product.description && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 font-mono block">
                    Deskripsi Produk
                  </span>
                  <div className="relative">
                    <p 
                      className={`text-xs sm:text-sm text-neutral-600 leading-relaxed transition-all duration-300 ${
                        !isDescriptionExpanded ? 'line-clamp-3 sm:line-clamp-4' : ''
                      }`}
                    >
                      {product.description}
                    </p>
                    
                    {/* Subtle fade-out gradient when collapsed */}
                    {!isDescriptionExpanded && (product.description?.length > 120) && (
                      <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                    )}
                  </div>

                  {/* 'Read More' / 'Read Less' Toggle */}
                  {(product.description?.length > 100) && (
                    <button
                      type="button"
                      onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-900 hover:text-black underline underline-offset-4 decoration-neutral-300 hover:decoration-neutral-900 transition-colors cursor-pointer pt-0.5"
                      aria-expanded={isDescriptionExpanded}
                    >
                      <span>{isDescriptionExpanded ? 'Read Less' : 'Read More'}</span>
                      <ChevronDown 
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                          isDescriptionExpanded ? 'rotate-180' : ''
                        }`} 
                      />
                    </button>
                  )}
                </div>
              )}

              {/* Color Selector */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-neutral-500">Pilihan Warna:</span>
                  <span className="font-semibold text-neutral-900">{selectedColor}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.colors.map(color => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-all duration-150 active:scale-95 ${
                        selectedColor === color
                          ? 'bg-neutral-900 text-white shadow-xs'
                          : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200/80'
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>

              {/* Size Selector & Find Similar (Adaptive: hidden for non-fashion items) */}
              {hasSizes ? (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-neutral-500">Pilihan Ukuran:</span>
                      <span className="font-semibold text-neutral-900">{selectedSize}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {product.sizes.map(size => (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        className={`min-w-10 h-9 px-3 text-xs font-semibold rounded-xl transition-all duration-150 active:scale-95 flex items-center justify-center ${
                          selectedSize === size
                            ? 'bg-neutral-900 text-white shadow-xs'
                            : 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200/80'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                  {onFindSimilar && !isOwnProduct && (
                    <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-500">
                      <span>
                        {isSoldOut
                          ? 'Stok item ini habis.'
                          : 'Ingin ukuran atau opsi lain?'}
                      </span>
                      <button
                        type="button"
                        onClick={() => onFindSimilar(product)}
                        className="inline-flex items-center gap-1 font-semibold text-neutral-900 hover:text-black underline underline-offset-4 decoration-neutral-300 hover:decoration-neutral-900 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Search className="w-3 h-3 shrink-0" />
                        <span>Cari yang Serupa</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                onFindSimilar && !isOwnProduct && (
                  <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-500">
                    <span>
                      {isSoldOut
                        ? 'Stok item ini habis.'
                        : 'Ingin lihat alternatif serupa?'}
                    </span>
                    <button
                      type="button"
                      onClick={() => onFindSimilar(product)}
                      className="inline-flex items-center gap-1 font-semibold text-neutral-900 hover:text-black underline underline-offset-4 decoration-neutral-300 hover:decoration-neutral-900 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Search className="w-3 h-3 shrink-0" />
                      <span>Cari yang Serupa</span>
                    </button>
                  </div>
                )
              )}

              {/* Optional Garment Measurements Display */}
              {product.measurements &&
                Object.values(product.measurements).some((v) => typeof v === 'number' && v > 0) && (
                  <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-2">
                    <span className="text-[11px] font-semibold text-neutral-600 block">
                      Detail Ukuran Aktual (cm)
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {product.measurements.panjangBaju !== undefined && (
                        <div className="bg-white rounded-xl px-2.5 py-1.5 border border-neutral-200/70">
                          <span className="text-[10px] text-neutral-400 block">Panjang Baju</span>
                          <span className="text-xs font-bold text-neutral-900 tabular-nums">
                            {product.measurements.panjangBaju} cm
                          </span>
                        </div>
                      )}
                      {product.measurements.lebarDada !== undefined && (
                        <div className="bg-white rounded-xl px-2.5 py-1.5 border border-neutral-200/70">
                          <span className="text-[10px] text-neutral-400 block">Lebar Dada</span>
                          <span className="text-xs font-bold text-neutral-900 tabular-nums">
                            {product.measurements.lebarDada} cm
                          </span>
                        </div>
                      )}
                      {product.measurements.lebarBahu !== undefined && (
                        <div className="bg-white rounded-xl px-2.5 py-1.5 border border-neutral-200/70">
                          <span className="text-[10px] text-neutral-400 block">Lebar Bahu</span>
                          <span className="text-xs font-bold text-neutral-900 tabular-nums">
                            {product.measurements.lebarBahu} cm
                          </span>
                        </div>
                      )}
                      {product.measurements.panjangCelana !== undefined && (
                        <div className="bg-white rounded-xl px-2.5 py-1.5 border border-neutral-200/70">
                          <span className="text-[10px] text-neutral-400 block">Panjang Celana</span>
                          <span className="text-xs font-bold text-neutral-900 tabular-nums">
                            {product.measurements.panjangCelana} cm
                          </span>
                        </div>
                      )}
                      {product.measurements.lebarPinggang !== undefined && (
                        <div className="bg-white rounded-xl px-2.5 py-1.5 border border-neutral-200/70">
                          <span className="text-[10px] text-neutral-400 block">Lebar Pinggang</span>
                          <span className="text-xs font-bold text-neutral-900 tabular-nums">
                            {product.measurements.lebarPinggang} cm
                          </span>
                        </div>
                      )}
                      {product.measurements.openLeg !== undefined && (
                        <div className="bg-white rounded-xl px-2.5 py-1.5 border border-neutral-200/70">
                          <span className="text-[10px] text-neutral-400 block">Open Leg</span>
                          <span className="text-xs font-bold text-neutral-900 tabular-nums">
                            {product.measurements.openLeg} cm
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

            </div>
          </div>

          {/* Verified Review System Section with Photo Reviews */}
          <div className="pt-8 border-t border-neutral-200 space-y-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                  <span>Ulasan & Penilaian Pembeli</span>
                  <span className="text-xs font-normal text-neutral-500">({productReviews.length} Ulasan)</span>
                </h3>
              </div>

              {isOwnProduct ? (
                <span className="text-xs font-medium text-neutral-500 self-start sm:self-auto">
                  Anda pemilik listing ini
                </span>
              ) : canWriteReview ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!isRegistered) {
                      onRequireAuthForReview?.();
                      return;
                    }
                    if (!newAuthor && currentUserName) setNewAuthor(currentUserName);
                    if (currentUserCity) setNewCity(currentUserCity);
                    setShowReviewForm(!showReviewForm);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-full transition-all duration-200 active:scale-[0.96] shadow-xs cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>{showReviewForm ? 'Tutup Form' : 'Tulis Ulasan & Foto'}</span>
                </button>
              ) : alreadyReviewed ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/70 text-xs font-semibold text-emerald-700 self-start sm:self-auto">
                  <Check className="w-3.5 h-3.5" />
                  <span>Ulasan Anda sudah terkirim</span>
                </span>
              ) : hasPendingPurchase ? (
                <span className="text-xs font-medium text-neutral-500 self-start sm:self-auto">
                  Selesaikan pesanan Anda di Pesanan Saya untuk menulis ulasan
                </span>
              ) : null}
            </div>

            {/* Sizing Accuracy Trust Metric (Only shown when real buyer reviews exist) */}
            {fitPercentage !== null && (
              <div className="bg-neutral-50 border border-neutral-200/80 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-xl text-neutral-900 border border-neutral-200 shadow-2xs shrink-0">
                    <Check className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                  </div>
                  <div>
                    <span className="font-bold text-neutral-900 block text-xs sm:text-sm tabular-nums">
                      {fitPercentage}% Pembeli Menyatakan Ukuran "Pas"
                    </span>
                    <span className="text-neutral-500 text-[11px] sm:text-xs">
                      Dihitung dari {totalFitVotes} ulasan pembeli yang sudah memakai produk ini.
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 font-medium text-neutral-600 shrink-0 text-[11px] tabular-nums">
                  <span className="text-emerald-700 font-semibold">Pas: {fitPasCount}</span>
                  <span aria-hidden="true" className="text-neutral-300">·</span>
                  <span className="text-amber-700 font-semibold">Kecil: {fitSmallCount}</span>
                  <span aria-hidden="true" className="text-neutral-300">·</span>
                  <span className="text-sky-700 font-semibold">Longgar: {fitLooseCount}</span>
                </div>
              </div>
            )}

            {/* Galeri Foto Pembeli (Photo Showcase Strip) */}
            {allBuyerPhotos.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-800 flex items-center gap-1.5 font-mono">
                    <Camera className="w-3.5 h-3.5 text-neutral-700" />
                    <span>Galeri Foto Pembeli ({allBuyerPhotos.length} Foto)</span>
                  </h4>
                  <span className="text-[11px] text-neutral-400">Ketuk foto untuk memperbesar</span>
                </div>

                <div className="flex gap-2.5 overflow-x-auto pb-2 no-scrollbar">
                  {allBuyerPhotos.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveLightbox(item)}
                      className="group relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shrink-0 border border-neutral-200/90 shadow-2xs hover:ring-2 hover:ring-neutral-900 transition-all cursor-pointer"
                    >
                      <img 
                        src={item.imageUrl} 
                        alt={`Foto Pembeli ${item.author}`} 
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-300" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5">
                        <span className="text-[9px] text-white font-medium truncate">{item.author}</span>
                      </div>
                      <div className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Maximize2 className="w-2.5 h-2.5" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Review Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
              <button
                onClick={() => setReviewFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  reviewFilter === 'all'
                    ? 'bg-neutral-900 text-white shadow-2xs'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                }`}
              >
                Semua ({productReviews.length})
              </button>
              <button
                onClick={() => setReviewFilter('with_photo')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  reviewFilter === 'with_photo'
                    ? 'bg-neutral-900 text-white shadow-2xs'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Dengan Foto ({productReviews.filter(r => r.images && r.images.length > 0).length})</span>
              </button>
              <button
                onClick={() => setReviewFilter('5_star')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                  reviewFilter === '5_star'
                    ? 'bg-neutral-900 text-white shadow-2xs'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                }`}
              >
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span>5 Bintang ({productReviews.filter(r => r.rating === 5).length})</span>
              </button>
              <button
                onClick={() => setReviewFilter('4_star')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                  reviewFilter === '4_star'
                    ? 'bg-neutral-900 text-white shadow-2xs'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                }`}
              >
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span>4 Bintang ({productReviews.filter(r => r.rating === 4).length})</span>
              </button>
            </div>

            {/* Interactive Write Review Form with Photo Attachment */}
            {showReviewForm && canWriteReview && !isOwnProduct && (
              <form onSubmit={handleSubmitReview} className="p-5 sm:p-6 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-800 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-neutral-700" />
                    <span>Tulis Ulasan & Unggah Foto Pembeli</span>
                  </h4>
                  <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                    Verified Buyer
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-neutral-700 block mb-1">Nama Pembeli:</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Raden Satria"
                      value={newAuthor}
                      onChange={(e) => setNewAuthor(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-neutral-300 rounded-xl text-xs text-neutral-900 focus:ring-1 focus:ring-neutral-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-neutral-700 block mb-1">Kota Asal:</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Bandung"
                      value={newCity}
                      onChange={(e) => setNewCity(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-neutral-300 rounded-xl text-xs text-neutral-900 focus:ring-1 focus:ring-neutral-900 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-neutral-700 block mb-1">Rating Produk:</label>
                    <div className="flex items-center gap-1 pt-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          type="button"
                          key={star}
                          onClick={() => setNewRating(star)}
                          className="p-1 focus:outline-none cursor-pointer"
                        >
                          <Star className={`w-5 h-5 ${star <= newRating ? 'text-amber-400 fill-amber-400' : 'text-neutral-300'}`} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-neutral-700 block mb-1">Postur Tubuh (Opsional):</label>
                    <input
                      type="text"
                      placeholder="Contoh: TB 175cm · BB 68kg"
                      value={newUserStats}
                      onChange={(e) => setNewUserStats(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white border border-neutral-300 rounded-xl text-xs text-neutral-900 focus:ring-1 focus:ring-neutral-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-neutral-700 block mb-1">Kesesuaian Ukuran (Fit):</label>
                    <div className="grid grid-cols-3 gap-1 p-1 bg-neutral-100 rounded-xl border border-neutral-200/80">
                      {([
                        { value: 'Pas', label: 'Pas' },
                        { value: 'Agak Kecil', label: 'Agak Kecil' },
                        { value: 'Agak Longgar', label: 'Agak Longgar' },
                      ] as const).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setNewFitFeedback(opt.value)}
                          className={`py-1.5 px-1 sm:px-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-all cursor-pointer whitespace-nowrap truncate ${
                            newFitFeedback === opt.value
                              ? 'bg-white text-neutral-900 shadow-2xs'
                              : 'text-neutral-600 hover:text-neutral-900'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-700 block mb-1">Ulasan & Kualitas Bahan:</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Ceritakan pengalaman memakai pakaian ini, kualitas bahan, kenyamanan, dan tampilan fitting di badan..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-neutral-300 rounded-xl text-xs text-neutral-900 focus:ring-1 focus:ring-neutral-900 focus:outline-none"
                  />
                </div>

                {/* Photo Attachment Section */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-neutral-800" />
                      <span>Lampirkan Foto Pembeli (Maksimal 4 Foto):</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleAddPresetPhoto}
                      className="text-[11px] text-neutral-600 hover:text-neutral-900 font-medium underline cursor-pointer"
                    >
                      Gunakan Foto Demo OOTD
                    </button>
                  </div>

                  <input
                    type="file"
                    ref={reviewFileInputRef}
                    onChange={handlePhotoUpload}
                    accept="image/*"
                    multiple
                    className="hidden"
                  />

                  {/* Thumbnail Previews & Upload Button */}
                  <div className="flex flex-wrap items-center gap-3">
                    {attachedPhotos.map((photo, i) => (
                      <div key={i} className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-neutral-300 group shadow-2xs">
                        <img src={photo} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(i)}
                          className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-rose-600 text-white rounded-full transition-colors cursor-pointer"
                          aria-label="Hapus Foto"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}

                    {attachedPhotos.length < 4 && (
                      <button
                        type="button"
                        onClick={() => reviewFileInputRef.current?.click()}
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border-2 border-dashed border-neutral-300 hover:border-neutral-900 bg-white hover:bg-neutral-50 flex flex-col items-center justify-center gap-1 text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
                      >
                        <Camera className="w-5 h-5" />
                        <span className="text-[10px] font-semibold">+ Foto</span>
                      </button>
                    )}
                  </div>

                  {photoError && (
                    <p className="text-[11px] text-rose-600 font-medium">{photoError}</p>
                  )}
                </div>

                  {reviewSubmitError && (
                    <p className="text-[11px] text-rose-600 font-medium bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                      {reviewSubmitError}
                    </p>
                  )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    disabled={isSubmittingReview}
                    onClick={() => setShowReviewForm(false)}
                    className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 cursor-pointer disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReview}
                    className="px-5 py-2 bg-neutral-900 hover:bg-black disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    {isSubmittingReview ? 'Mengirim...' : 'Publikasikan Ulasan'}
                  </button>
                </div>
              </form>
            )}

            {/* List of Verified Reviews */}
            <div className="space-y-4 divide-y divide-neutral-100">
              {filteredReviews.length === 0 ? (
                <div className="p-8 text-center text-xs text-neutral-400 bg-neutral-50 rounded-2xl border border-neutral-200/60">
                  {reviewFilter === 'with_photo' 
                    ? 'Belum ada ulasan dengan foto pada filter ini. Jadilah yang pertama melampirkan foto!'
                    : 'Belum ada ulasan untuk filter ini.'}
                </div>
              ) : (
                filteredReviews.map(review => (
                  <div key={review.id} className="pt-5 first:pt-0 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-neutral-900">{review.author}</span>
                        <span className="text-neutral-500 text-[11px]">({review.city})</span>
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium border border-emerald-200/60">
                          <Check className="w-2.5 h-2.5" /> Pembeli Terverifikasi
                        </span>
                      </div>
                      <span className="text-neutral-400 text-[11px] shrink-0">{review.date}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 ${
                              i < review.rating ? 'text-amber-400 fill-amber-400' : 'text-neutral-200'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-neutral-300">·</span>
                      <span className="text-neutral-600 font-medium text-[11px]">
                        Ukuran: {review.sizePurchased}
                      </span>
                      <span className="text-neutral-300">·</span>
                      <span className="text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded-full text-[11px] font-medium">
                        Fit: {review.fitFeedback}
                      </span>
                      {review.userStats && (
                        <>
                          <span className="text-neutral-300">·</span>
                          <span className="text-neutral-500 text-[11px]">
                            {review.userStats}
                          </span>
                        </>
                      )}
                    </div>

                    <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed">
                      "{review.comment}"
                    </p>

                    {/* Attached Customer Photos Grid */}
                    {review.images && review.images.length > 0 && (
                      <div className="flex flex-wrap gap-2.5 pt-1">
                        {review.images.map((img, imgIdx) => (
                          <button
                            key={imgIdx}
                            type="button"
                            onClick={() => setActiveLightbox({
                              imageUrl: img,
                              author: review.author,
                              comment: review.comment,
                              rating: review.rating,
                              userStats: review.userStats,
                            })}
                            className="group relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border border-neutral-200 shadow-2xs hover:ring-2 hover:ring-neutral-900 transition-all cursor-pointer"
                          >
                            <img src={img} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-300" />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <Maximize2 className="w-4 h-4" />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-1 pt-1">
                      {(() => {
                        const isHelpfulVoted = helpfulVotedIds.includes(review.id);
                        return (
                          <button
                            type="button"
                            onClick={() => onToggleHelpfulReview?.(review.id)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                              isHelpfulVoted
                                ? 'bg-neutral-900 text-white'
                                : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
                            }`}
                          >
                            <ThumbsUp className={`w-3 h-3 ${isHelpfulVoted ? 'fill-white' : ''}`} />
                            <span>Membantu ({review.helpfulCount})</span>
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>

        </div>

        {/* Sticky Modal Bottom Action Bar (Hidden cleanly for own product; direct Chat Penjual for buyers) */}
        {!isOwnProduct && (
          <div className="bg-white/95 backdrop-blur-md border-t border-neutral-200/80 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 z-20 shrink-0 shadow-lg flex items-center gap-2">
            {isSoldOut && onFindSimilar ? (
              <button
                type="button"
                onClick={() => onFindSimilar(product)}
                className="flex-1 h-11 sm:h-12 px-4 bg-neutral-900 hover:bg-black text-white font-semibold text-xs sm:text-sm rounded-2xl shadow-sm transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap min-w-0"
              >
                <Search className="w-4 h-4 shrink-0" />
                <span className="truncate">Stok Habis · Cari yang Serupa</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isSoldOut || !onOpenChat}
                onClick={() => {
                  if (!onOpenChat || isSoldOut) return;
                  onClose();
                  onOpenChat(product.sellerBrandName || product.brand, {
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    image: product.image,
                    brand: product.sellerBrandName || product.brand,
                    sellerId: product.sellerId,
                    status: isSoldOut ? 'Sold Out' : 'Tersedia',
                  });
                }}
                className="flex-1 h-11 sm:h-12 px-4 bg-neutral-900 hover:bg-black disabled:bg-neutral-300 disabled:text-neutral-500 text-white font-semibold text-xs sm:text-sm rounded-2xl shadow-sm transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap min-w-0"
              >
                <MessageSquare className="w-4 h-4 shrink-0" />
                <span className="truncate tabular-nums">
                  {isSoldOut
                    ? 'Item Sudah Terjual'
                    : `Chat Penjual · Rp ${product.price.toLocaleString('id-ID')}`}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Customer Photo Lightbox Viewer Modal */}
        <AnimatePresence>
          {activeLightbox && (
            <div 
              className="fixed inset-0 z-70 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6"
              onClick={() => setActiveLightbox(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className="relative max-w-2xl w-full bg-neutral-950 text-white rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-3 sm:p-4 bg-black/60 flex items-center justify-between border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold">{activeLightbox.author}</span>
                    <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      Verified OOTD
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveLightbox(null)}
                    className="p-1.5 text-white/70 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-hidden bg-black flex items-center justify-center max-h-[60vh]">
                  <img 
                    src={activeLightbox.imageUrl} 
                    alt="" 
                    className="w-full h-full object-contain" 
                  />
                </div>

                <div className="p-4 bg-neutral-900 border-t border-white/10 space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${
                          i < activeLightbox.rating ? 'text-amber-400 fill-amber-400' : 'text-neutral-600'
                        }`}
                      />
                    ))}
                    {activeLightbox.userStats && (
                      <span className="text-neutral-400 text-[11px] ml-2">
                        {activeLightbox.userStats}
                      </span>
                    )}
                  </div>
                  <p className="text-neutral-200 leading-relaxed text-xs">
                    "{activeLightbox.comment}"
                  </p>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>


      </motion.div>
    </motion.div>
  );
};
