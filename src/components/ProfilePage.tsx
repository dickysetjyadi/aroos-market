import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  User, Store, Package, Star, MapPin, Camera,
  Check, Save, Loader2, ArrowLeft, Search,
  Users, UserPlus, UserCheck, MessageSquare,
  Share2, Layers, Plus, Maximize2, X, Flag
} from 'lucide-react';
import { UserAccount, UserProfile, Product, Review } from '../types';
import { ReportTarget } from './ReportModal';
import { setCurrentUserAccount, getCurrentUserAccount } from '../utils/userDb';
import { saveUserToFirestore } from '../services/phoneAuthService';
import { isStoreOwnedByUser } from '../utils/ownership';
import {
  SellerDirectoryEntry,
  buildStoreShareUrl,
  copyTextToClipboard,
} from '../utils/marketplaceSocial';
import { useConfirm } from './ConfirmDialogContext';
import { ProductCard } from './ProductCard';

interface StoreTarget {
  brandName: string;
  sellerId?: string;
}

interface ProfilePageProps {
  userProfile: UserProfile;
  currentUserAccount: UserAccount | null;
  onProfileUpdated: (updatedAccount: UserAccount) => void;
  onGoHome: () => void;
  products: Product[];
  onSelectProduct: (product: Product) => void;
  wishlistIds?: string[];
  onToggleWishlist?: (product: Product, e: React.MouseEvent) => void;
  reviews: Review[];
  storeTarget?: StoreTarget | null;
  sellerEntry?: SellerDirectoryEntry | null;
  isFollowed?: boolean;
  followerCount?: number;
  followingCount?: number;
  onToggleFollow?: (brandName: string, sellerId?: string) => void;
  onOpenChat?: (brandName: string, sellerId?: string) => void;
  onShareStore?: (brandName: string, url: string) => void;
  onOpenFollowers?: (brandName: string, tab?: 'followers' | 'following', sellerId?: string) => void;
  onManageListings?: () => void;
  onAddReview?: (review: Omit<Review, 'id' | 'date' | 'helpfulCount'>) => void;
  onRequireAuthForReview?: () => void;
  onReportStore?: (target: ReportTarget) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  userProfile,
  currentUserAccount,
  onProfileUpdated,
  onGoHome,
  products,
  onSelectProduct,
  wishlistIds = [],
  onToggleWishlist,
  reviews,
  storeTarget = null,
  sellerEntry = null,
  isFollowed = false,
  followerCount = 0,
  followingCount = 0,
  onToggleFollow,
  onOpenChat,
  onShareStore,
  onOpenFollowers,
  onManageListings,
  onAddReview,
  onRequireAuthForReview,
  onReportStore,
}) => {
  const confirm = useConfirm();

  const isOwnStore =
    !storeTarget ||
    isStoreOwnedByUser(storeTarget.brandName, storeTarget.sellerId, userProfile);

  const [activeTab, setActiveTab] = useState<'listings' | 'testimonials' | 'edit'>('listings');
  const [listingSearch, setListingSearch] = useState('');
  const [copiedStoreLink, setCopiedStoreLink] = useState(false);

  // Testimonial filters & inline review creation (aligned with ProductDetailModal & reference UI)
  const [reviewFilter, setReviewFilter] = useState<'all' | 'with_photo' | '5_star' | '4_star'>('all');
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewProductId, setReviewProductId] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewCity, setReviewCity] = useState(userProfile.buyerProfile?.city || userProfile.brandCity || 'Jakarta');
  const [reviewPhotos, setReviewPhotos] = useState<string[]>([]);
  const [reviewPhotoError, setReviewPhotoError] = useState<string | null>(null);
  const reviewFileInputRef = useRef<HTMLInputElement>(null);
  const [activeLightbox, setActiveLightbox] = useState<{
    imageUrl: string;
    author: string;
    comment: string;
    rating: number;
  } | null>(null);

  // Edit profile states (own store only)
  const [name, setName] = useState(userProfile.name || '');
  const [brandName, setBrandName] = useState(userProfile.brandName || userProfile.name || '');
  const [phone, setPhone] = useState(currentUserAccount?.phone || userProfile.phone || '');
  const [city, setCity] = useState(
    currentUserAccount?.buyerProfile?.city ||
      userProfile.buyerProfile?.city ||
      userProfile.brandCity ||
      'Jakarta Selatan'
  );
  const [address, setAddress] = useState(
    currentUserAccount?.buyerProfile?.address || userProfile.buyerProfile?.address || ''
  );
  const [postalCode, setPostalCode] = useState(
    currentUserAccount?.buyerProfile?.postalCode || userProfile.buyerProfile?.postalCode || ''
  );
  const [avatarUrl, setAvatarUrl] = useState(currentUserAccount?.avatarUrl || userProfile.avatarUrl || '');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    setAvatarError(false);
    setListingSearch('');
    setReviewFilter('all');
    setShowReviewForm(false);
    if (!isOwnStore && activeTab === 'edit') {
      setActiveTab('listings');
    }
  }, [isOwnStore, storeTarget?.brandName, storeTarget?.sellerId]);

  useEffect(() => {
    setName(userProfile.name || '');
    setBrandName(userProfile.brandName || userProfile.name || '');
    setPhone(currentUserAccount?.phone || userProfile.phone || '');
    setCity(
      currentUserAccount?.buyerProfile?.city ||
        userProfile.buyerProfile?.city ||
        userProfile.brandCity ||
        'Jakarta Selatan'
    );
    setAddress(
      currentUserAccount?.buyerProfile?.address || userProfile.buyerProfile?.address || ''
    );
    setPostalCode(
      currentUserAccount?.buyerProfile?.postalCode || userProfile.buyerProfile?.postalCode || ''
    );
    setAvatarUrl(currentUserAccount?.avatarUrl || userProfile.avatarUrl || '');
  }, [userProfile, currentUserAccount]);

  const targetSellerId = isOwnStore
    ? userProfile.id
    : storeTarget?.sellerId || sellerEntry?.sellerId;

  const targetBrandName = isOwnStore
    ? userProfile.brandName || userProfile.name || 'Lapak Saya'
    : storeTarget?.brandName || sellerEntry?.brandName || 'Toko AROOS';

  const displayOwnerName = isOwnStore
    ? userProfile.name
    : sellerEntry?.ownerName;

  const displayCity = isOwnStore
    ? city || userProfile.brandCity || 'Indonesia'
    : sellerEntry?.city ||
      products.find(
        (p) =>
          p.isActive !== false &&
          ((targetSellerId && p.sellerId === targetSellerId) ||
            (p.sellerBrandName || p.brand || '').toLowerCase().trim() ===
              targetBrandName.toLowerCase().trim())
      )?.brandCity ||
      'Indonesia';

  const displayAvatarUrl = isOwnStore ? avatarUrl : sellerEntry?.avatarUrl || '';

  const storeListings = useMemo(() => {
    const normalizedTarget = targetBrandName.toLowerCase().trim();
    return products.filter((p) => {
      if (p.isActive === false) return false;
      if (targetSellerId && p.sellerId) {
        return p.sellerId === targetSellerId;
      }
      if (!targetSellerId) {
        const bName = (p.sellerBrandName || p.brand || '').toLowerCase().trim();
        return Boolean(normalizedTarget) && bName === normalizedTarget;
      }
      // If targetSellerId is known but product lacks sellerId, match by brand name only for legacy compatibility
      const bName = (p.sellerBrandName || p.brand || '').toLowerCase().trim();
      return Boolean(normalizedTarget) && bName === normalizedTarget;
    });
  }, [products, targetSellerId, targetBrandName]);

  const filteredListings = useMemo(() => {
    const q = listingSearch.trim().toLowerCase();
    if (!q) return storeListings;
    return storeListings.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.subCategory || '').toLowerCase().includes(q) ||
        (p.material || '').toLowerCase().includes(q)
    );
  }, [storeListings, listingSearch]);

  const storeProductById = useMemo(() => {
    const map = new Map<string, Product>();
    storeListings.forEach((p) => map.set(p.id, p));
    return map;
  }, [storeListings]);

  const storeTestimonials = useMemo(() => {
    return reviews.filter((r) => storeProductById.has(r.productId));
  }, [reviews, storeProductById]);

  const filteredTestimonials = useMemo(() => {
    if (reviewFilter === 'with_photo') {
      return storeTestimonials.filter((r) => r.images && r.images.length > 0);
    }
    if (reviewFilter === '5_star') {
      return storeTestimonials.filter((r) => r.rating === 5);
    }
    if (reviewFilter === '4_star') {
      return storeTestimonials.filter((r) => r.rating === 4);
    }
    return storeTestimonials;
  }, [storeTestimonials, reviewFilter]);

  const allBuyerPhotos = useMemo(() => {
    const list: { imageUrl: string; author: string; comment: string; rating: number }[] = [];
    storeTestimonials.forEach((r) => {
      (r.images || []).forEach((imgUrl) => {
        list.push({ imageUrl: imgUrl, author: r.author, comment: r.comment, rating: r.rating });
      });
    });
    return list;
  }, [storeTestimonials]);

  const averageRating = useMemo(() => {
    if (storeTestimonials.length > 0) {
      const avg =
        storeTestimonials.reduce((acc, r) => acc + r.rating, 0) / storeTestimonials.length;
      return avg.toFixed(1);
    }
    if (storeListings.length > 0) {
      const avg =
        storeListings.reduce((acc, p) => acc + (p.rating || 4.9), 0) / storeListings.length;
      return avg.toFixed(1);
    }
    return sellerEntry?.rating ? sellerEntry.rating.toFixed(1) : '4.9';
  }, [storeTestimonials, storeListings, sellerEntry]);

  useEffect(() => {
    if (storeListings.length > 0 && !storeProductById.has(reviewProductId)) {
      setReviewProductId(storeListings[0].id);
    }
  }, [storeListings, storeProductById, reviewProductId]);

  const handleCopyStoreLink = async () => {
    const shareUrl = buildStoreShareUrl(targetBrandName, targetSellerId);
    const copied = await copyTextToClipboard(shareUrl);
    if (copied) {
      setCopiedStoreLink(true);
      window.setTimeout(() => setCopiedStoreLink(false), 2200);
    }
    onShareStore?.(targetBrandName, shareUrl);
  };

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage('Ukuran foto maksimal 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarUrl(reader.result as string);
      setAvatarError(false);
      setErrorMessage('');
    };
    reader.readAsDataURL(file);
  };

  const handleReviewPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setReviewPhotoError(null);
    const remaining = Math.max(0, 3 - reviewPhotos.length);
    Array.from(files)
      .slice(0, remaining)
      .forEach((file) => {
        if (file.size > 2 * 1024 * 1024) {
          setReviewPhotoError('Ukuran foto ulasan maksimal 2MB.');
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
          setReviewPhotos((prev) => [...prev, reader.result as string].slice(0, 3));
        };
        reader.readAsDataURL(file);
      });
  };

  const handleSubmitStoreReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddReview || !reviewComment.trim()) return;
    const chosenProduct = storeProductById.get(reviewProductId) || storeListings[0];
    if (!chosenProduct) return;

    onAddReview({
      productId: chosenProduct.id,
      author: userProfile.name || 'Pembeli AROOS',
      city: reviewCity.trim() || userProfile.buyerProfile?.city || 'Indonesia',
      rating: reviewRating,
      comment: reviewComment.trim(),
      sizePurchased: chosenProduct.sizes?.[0] || 'Standar',
      fitFeedback: 'Pas',
      verifiedPurchase: true,
      images: reviewPhotos.length > 0 ? reviewPhotos : undefined,
    });

    setReviewComment('');
    setReviewPhotos([]);
    setReviewRating(5);
    setShowReviewForm(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!name.trim()) {
      setErrorMessage('Nama lengkap wajib diisi.');
      return;
    }
    if (!phone.trim()) {
      setErrorMessage('Nomor HP / WhatsApp wajib diisi.');
      return;
    }
    if (!city.trim()) {
      setErrorMessage('Kota / Kabupaten wajib dipilih.');
      return;
    }
    if (!address.trim()) {
      setErrorMessage('Alamat lengkap wajib diisi.');
      return;
    }
    if (!postalCode.trim()) {
      setErrorMessage('Kode pos wajib diisi.');
      return;
    }
    if (newPassword && newPassword.length < 4) {
      setErrorMessage('Kata sandi baru minimal 4 karakter.');
      return;
    }

    const ok = await confirm({
      title: 'Simpan Profil & Alamat',
      message: `Simpan perubahan profil untuk ${name.trim()}?`,
      confirmLabel: 'Simpan',
    });
    if (!ok) return;

    setIsSaving(true);
    try {
      const currentAcc = currentUserAccount || getCurrentUserAccount();
      if (!currentAcc) {
        throw new Error('Akun pengguna tidak ditemukan.');
      }

      const updatedAccount: UserAccount = {
        ...currentAcc,
        name: name.trim(),
        phone: phone.trim(),
        avatarUrl: avatarUrl.trim(),
        password: newPassword ? newPassword : currentAcc.password,
        roles: Array.from(new Set([...(currentAcc.roles || ['buyer']), 'seller'])),
        buyerProfile: {
          ...currentAcc.buyerProfile,
          address: address.trim(),
          city: city.trim(),
          postalCode: postalCode.trim(),
        },
        sellerProfile: {
          brandName: brandName.trim() || name.trim(),
          brandCity: city.trim() || currentAcc.sellerProfile?.brandCity || 'Bandung',
          planId: currentAcc.sellerProfile?.planId || 'starter',
          registeredAt: currentAcc.sellerProfile?.registeredAt || new Date().toISOString().split('T')[0],
          verifiedBrand: true,
        },
      };

      setCurrentUserAccount(updatedAccount);
      await saveUserToFirestore(updatedAccount);
      onProfileUpdated(updatedAccount);

      setSuccessMessage('Profil & Alamat berhasil diperbarui.');
      setNewPassword('');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: unknown) {
      console.error('Update profile error:', err);
      const msg = err instanceof Error ? err.message : '';
      setErrorMessage(msg || 'Gagal menyimpan profil.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] pb-24">
      <div className="bg-white border-b border-neutral-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onGoHome}
            className="inline-flex items-center gap-2 text-xs font-bold text-neutral-800 hover:text-neutral-950 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Beranda</span>
          </button>

          <button
            type="button"
            onClick={handleCopyStoreLink}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap ${
              copiedStoreLink
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border-neutral-200'
            }`}
          >
            {copiedStoreLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Link Disalin</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 shrink-0" />
                <span>Bagikan Toko</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6">
        {/* Profile / Storefront Header Card */}
        <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-sm p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden bg-neutral-900 text-white flex items-center justify-center text-3xl font-extrabold uppercase shrink-0 shadow-md border-4 border-white">
            {displayAvatarUrl && !avatarError ? (
              <img
                src={displayAvatarUrl}
                alt={targetBrandName}
                onError={() => setAvatarError(true)}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{targetBrandName ? targetBrandName.slice(0, 2).toUpperCase() : 'U'}</span>
            )}
          </div>

          <div className="flex-1 min-w-0 text-center sm:text-left space-y-3 w-full">
            <div className="flex flex-col sm:flex-row sm:items-start gap-3 justify-between">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-extrabold text-neutral-900 tracking-tight truncate">
                  {targetBrandName}
                </h1>
                {displayOwnerName &&
                  displayOwnerName.toLowerCase().trim() !== targetBrandName.toLowerCase().trim() && (
                    <p className="text-xs text-neutral-500 mt-0.5 truncate">
                      @{displayOwnerName}
                    </p>
                  )}
                {sellerEntry?.description && (
                  <p className="text-xs text-neutral-600 mt-1.5 max-w-2xl leading-relaxed">
                    {sellerEntry.description}
                  </p>
                )}
              </div>

              {/* Action Cluster */}
              {isOwnStore ? (
                <div className="flex items-center justify-center sm:justify-end gap-2 shrink-0">
                  {onManageListings && (
                    <button
                      type="button"
                      onClick={onManageListings}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-black text-white rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap"
                    >
                      <Layers className="w-3.5 h-3.5 shrink-0" />
                      <span>Kelola Lapak</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center sm:justify-end gap-2 shrink-0">
                  {onToggleFollow && (
                    <button
                      type="button"
                      onClick={() => onToggleFollow(targetBrandName, targetSellerId)}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all active:scale-95 cursor-pointer whitespace-nowrap border ${
                        isFollowed
                          ? 'bg-neutral-100 text-neutral-900 border-neutral-300 hover:bg-neutral-200/70'
                          : 'bg-red-600 hover:bg-red-700 text-white border-red-600 shadow-2xs'
                      }`}
                    >
                      {isFollowed ? (
                        <>
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Mengikuti</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5 shrink-0" />
                          <span>Ikuti</span>
                        </>
                      )}
                    </button>
                  )}
                  {onOpenChat && (
                    <button
                      type="button"
                      onClick={() => onOpenChat(targetBrandName, targetSellerId)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/75 hover:bg-white/90 text-neutral-900 shadow-[0_4px_20px_rgba(0,0,0,0.08)] backdrop-blur-xl border border-white/60 rounded-full text-xs font-semibold transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                    >
                      <MessageSquare className="w-3.5 h-3.5 shrink-0 text-neutral-800" />
                      <span>Chat</span>
                    </button>
                  )}
                  {onReportStore && (
                    <button
                      type="button"
                      onClick={() =>
                        onReportStore({
                          reportedUserId: targetSellerId || targetBrandName,
                          reportedUserName: targetBrandName,
                          source: 'storefront',
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-neutral-100 hover:bg-red-50 text-neutral-700 hover:text-red-600 border border-neutral-200 hover:border-red-200 rounded-full text-xs font-semibold transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                      title="Laporkan Toko"
                    >
                      <Flag className="w-3.5 h-3.5 shrink-0" />
                      <span>Laporkan</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1.5 pt-1 text-xs text-neutral-600 font-medium">
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                <span>{displayCity}</span>
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Package className="w-3.5 h-3.5 text-neutral-400" />
                <span>{storeListings.length} Listing Aktif</span>
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span>{averageRating} ({storeTestimonials.length} Ulasan)</span>
              </span>
              <span aria-hidden="true">·</span>
              {onOpenFollowers ? (
                <button
                  type="button"
                  onClick={() => onOpenFollowers(targetBrandName, 'followers', targetSellerId)}
                  className="inline-flex items-center gap-1 hover:text-neutral-950 hover:underline underline-offset-4 cursor-pointer tabular-nums"
                >
                  <Users className="w-3.5 h-3.5 text-neutral-400" />
                  <span>{followerCount} Pengikut</span>
                </button>
              ) : (
                <span className="tabular-nums">{followerCount} Pengikut</span>
              )}
              <span aria-hidden="true">·</span>
              {onOpenFollowers ? (
                <button
                  type="button"
                  onClick={() => onOpenFollowers(targetBrandName, 'following', targetSellerId)}
                  className="hover:text-neutral-950 hover:underline underline-offset-4 cursor-pointer tabular-nums"
                >
                  <span>{followingCount} Mengikuti</span>
                </button>
              ) : (
                <span className="tabular-nums">{followingCount} Mengikuti</span>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-neutral-200 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('listings')}
            className={`px-5 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer whitespace-nowrap flex items-center gap-2 tabular-nums ${
              activeTab === 'listings'
                ? 'border-neutral-900 text-neutral-950'
                : 'border-transparent text-neutral-400 hover:text-neutral-700'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>{isOwnStore ? `Listing Saya (${storeListings.length})` : `Listing (${storeListings.length})`}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('testimonials')}
            className={`px-5 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer whitespace-nowrap flex items-center gap-2 tabular-nums ${
              activeTab === 'testimonials'
                ? 'border-neutral-900 text-neutral-950'
                : 'border-transparent text-neutral-400 hover:text-neutral-700'
            }`}
          >
            <Star className="w-4 h-4" />
            <span>Testimoni &amp; Ulasan ({storeTestimonials.length})</span>
          </button>

          {isOwnStore && (
            <button
              type="button"
              onClick={() => setActiveTab('edit')}
              className={`px-5 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'edit'
                  ? 'border-neutral-900 text-neutral-950'
                  : 'border-transparent text-neutral-400 hover:text-neutral-700'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Edit Profil &amp; Alamat Wajib</span>
            </button>
          )}
        </div>

        {/* Tab 1: Listings */}
        {activeTab === 'listings' && (
          <div className="space-y-4">
            {storeListings.length > 0 && (
              <div className="relative max-w-md">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={listingSearch}
                  onChange={(e) => setListingSearch(e.target.value)}
                  placeholder={`Cari produk di ${isOwnStore ? 'lapak saya' : targetBrandName}...`}
                  className="w-full pl-10 pr-8 py-2 bg-white border border-neutral-200 rounded-full text-xs font-medium text-neutral-900 focus:outline-none focus:border-neutral-900 transition-colors"
                />
                {listingSearch && (
                  <button
                    type="button"
                    onClick={() => setListingSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                    aria-label="Hapus pencarian listing"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {filteredListings.length === 0 ? (
              <div className="bg-white rounded-3xl border border-neutral-200/90 p-12 text-center space-y-3">
                <Store className="w-10 h-10 text-neutral-300 mx-auto" />
                <h3 className="text-sm font-bold text-neutral-950">
                  {listingSearch ? 'Produk Tidak Ditemukan' : 'Belum Ada Listing'}
                </h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  {listingSearch
                    ? 'Coba ubah kata kunci pencarian Anda.'
                    : isOwnStore
                      ? 'Anda belum menambahkan produk ke lapak Anda. Mulai jual koleksi pre-loved atau baru Anda sekarang.'
                      : 'Toko ini belum memiliki produk aktif yang ditayangkan.'}
                </p>
                {listingSearch && (
                  <button
                    type="button"
                    onClick={() => setListingSearch('')}
                    className="px-4 py-2 bg-neutral-900 text-white text-xs font-semibold rounded-full hover:bg-black cursor-pointer"
                  >
                    Reset Pencarian
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredListings.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    onSelect={onSelectProduct}
                    isOwnProduct={isOwnStore}
                    isWishlisted={wishlistIds.includes(p.id)}
                    onToggleWishlist={isOwnStore ? undefined : onToggleWishlist}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Testimonials & Reviews (Aligned with ProductDetailModal & screenshot reference) */}
        {activeTab === 'testimonials' && (
          <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-neutral-900 flex items-center gap-2">
                  <span>Ulasan &amp; Penilaian Pembeli</span>
                  <span className="text-xs font-normal text-neutral-500 tabular-nums">
                    ({storeTestimonials.length} Ulasan)
                  </span>
                </h3>
              </div>

              {isOwnStore ? (
                <span className="text-xs font-medium text-neutral-500 self-start sm:self-auto">
                  Pemilik lapak
                </span>
              ) : onAddReview && storeListings.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!userProfile.isRegistered) {
                      onRequireAuthForReview?.();
                      return;
                    }
                    setShowReviewForm((prev) => !prev);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-full transition-all active:scale-[0.96] shadow-xs cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>{showReviewForm ? 'Tutup Form' : 'Tulis Ulasan & Foto'}</span>
                </button>
              ) : null}
            </div>

            {allBuyerPhotos.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold tracking-wider text-neutral-800 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-neutral-700" />
                    <span>Galeri Foto Pembeli ({allBuyerPhotos.length} Foto)</span>
                  </h4>
                  <span className="text-[11px] text-neutral-400">Ketuk foto untuk memperbesar</span>
                </div>
                <div className="flex gap-2.5 overflow-x-auto pb-2 no-scrollbar">
                  {allBuyerPhotos.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveLightbox(item)}
                      className="group relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shrink-0 border border-neutral-200/90 shadow-2xs hover:ring-2 hover:ring-neutral-900 transition-all cursor-pointer"
                    >
                      <img
                        src={item.imageUrl}
                        alt={`Foto Pembeli ${item.author}`}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Maximize2 className="w-2.5 h-2.5" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Review Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setReviewFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer tabular-nums ${
                  reviewFilter === 'all'
                    ? 'bg-neutral-900 text-white shadow-2xs'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                }`}
              >
                Semua ({storeTestimonials.length})
              </button>
              <button
                type="button"
                onClick={() => setReviewFilter('with_photo')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 tabular-nums ${
                  reviewFilter === 'with_photo'
                    ? 'bg-neutral-900 text-white shadow-2xs'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Dengan Foto ({storeTestimonials.filter((r) => r.images && r.images.length > 0).length})</span>
              </button>
              <button
                type="button"
                onClick={() => setReviewFilter('5_star')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 tabular-nums ${
                  reviewFilter === '5_star'
                    ? 'bg-neutral-900 text-white shadow-2xs'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                }`}
              >
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span>5 Bintang ({storeTestimonials.filter((r) => r.rating === 5).length})</span>
              </button>
              <button
                type="button"
                onClick={() => setReviewFilter('4_star')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 tabular-nums ${
                  reviewFilter === '4_star'
                    ? 'bg-neutral-900 text-white shadow-2xs'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                }`}
              >
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span>4 Bintang ({storeTestimonials.filter((r) => r.rating === 4).length})</span>
              </button>
            </div>

            {showReviewForm && !isOwnStore && storeListings.length > 0 && (
              <form
                onSubmit={handleSubmitStoreReview}
                className="p-5 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-4 text-xs"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-neutral-700 block mb-1">
                      Produk yang Diulas
                    </label>
                    <select
                      value={reviewProductId}
                      onChange={(e) => setReviewProductId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl text-neutral-900"
                    >
                      {storeListings.map((prod) => (
                        <option key={prod.id} value={prod.id}>
                          {prod.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-neutral-700 block mb-1">Kota Anda</label>
                    <input
                      type="text"
                      required
                      value={reviewCity}
                      onChange={(e) => setReviewCity(e.target.value)}
                      placeholder="Contoh: Jakarta Selatan"
                      className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl text-neutral-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">Rating</label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewRating(star)}
                        className="p-1 cursor-pointer"
                      >
                        <Star
                          className={`w-5 h-5 ${
                            star <= reviewRating ? 'text-amber-400 fill-amber-400' : 'text-neutral-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">Ulasan</label>
                  <textarea
                    rows={3}
                    required
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Bagikan pengalaman transaksi dan kualitas barang dari toko ini..."
                    className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl text-neutral-900"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={reviewFileInputRef}
                      onChange={handleReviewPhotoUpload}
                      accept="image/*"
                      multiple
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => reviewFileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-300 rounded-xl text-neutral-700 font-semibold hover:bg-neutral-100 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Tambah Foto ({reviewPhotos.length}/3)</span>
                    </button>
                    {reviewPhotoError && (
                      <span className="text-[11px] text-red-600">{reviewPhotoError}</span>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="px-5 py-2 bg-neutral-900 hover:bg-black text-white font-semibold rounded-full cursor-pointer"
                  >
                    Kirim Ulasan
                  </button>
                </div>
              </form>
            )}

            {filteredTestimonials.length === 0 ? (
              <div className="py-12 rounded-2xl border border-neutral-200/80 text-center text-xs text-neutral-400 space-y-1">
                <p>Belum ada ulasan untuk filter ini.</p>
              </div>
            ) : (
              <div className="space-y-4 divide-y divide-neutral-100">
                {filteredTestimonials.map((r) => {
                  const reviewedProd = storeProductById.get(r.productId);
                  return (
                    <div key={r.id} className="pt-4 first:pt-0 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-neutral-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {r.author[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-neutral-900 truncate">{r.author}</p>
                            <p className="text-[10px] text-neutral-400 truncate">
                              {r.city} · {r.date}
                              {reviewedProd ? ` · ${reviewedProd.name}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {Array.from({ length: r.rating }).map((_, i) => (
                            <Star key={i} className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-neutral-700 leading-relaxed pl-10">
                        &ldquo;{r.comment}&rdquo;
                      </p>
                      {r.images && r.images.length > 0 && (
                        <div className="flex items-center gap-2 pl-10 pt-1">
                          {r.images.map((imgUrl, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() =>
                                setActiveLightbox({
                                  imageUrl: imgUrl,
                                  author: r.author,
                                  comment: r.comment,
                                  rating: r.rating,
                                })
                              }
                              className="w-16 h-16 rounded-xl overflow-hidden border border-neutral-200 cursor-pointer"
                            >
                              <img
                                src={imgUrl}
                                alt=""
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Edit Profil & Alamat Wajib (Owner Only) */}
        {isOwnStore && activeTab === 'edit' && (
          <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-sm p-6 sm:p-8">
            <form onSubmit={handleSave} className="space-y-5 max-w-2xl">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 font-mono">
                  Pengaturan Profil &amp; Alamat Pengiriman Wajib
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Nomor HP, Kota/Kabupaten, Alamat Lengkap, dan Kode Pos wajib diisi secara lengkap untuk kelancaran transaksi langsung di chat.
                </p>
              </div>

              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-600 font-medium">
                  {errorMessage}
                </div>
              )}
              {successMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-700 font-medium flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              <div className="flex items-center gap-4 py-2">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-neutral-900 text-white flex items-center justify-center font-bold text-xl uppercase shrink-0 border border-neutral-200">
                  {avatarUrl && !avatarError ? (
                    <img src={avatarUrl} alt="" onError={() => setAvatarError(true)} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  ) : (
                    <span>{name ? name[0] : 'U'}</span>
                  )}
                </div>
                <div>
                  <label htmlFor="profile-avatar-upload" className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 rounded-xl text-xs font-bold text-neutral-800 transition-colors cursor-pointer">
                    <Camera className="w-3.5 h-3.5" />
                    <span>Ubah Foto Profil</span>
                  </label>
                  <input id="profile-avatar-upload" type="file" accept="image/*" onChange={handleAvatarFile} className="hidden" />
                  <p className="text-[11px] text-neutral-400 mt-1">Maksimal ukuran file 2MB.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">
                    Nama Lengkap <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nama Lengkap"
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400/40 font-medium"
                  />
                </div>

                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">
                    Email Akun
                  </label>
                  <input
                    type="email"
                    value={userProfile.email}
                    readOnly
                    disabled
                    className="w-full px-3.5 py-2.5 bg-neutral-100 border border-neutral-200 rounded-2xl text-neutral-500 font-medium cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">
                    Nomor HP / WhatsApp <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Contoh: 081298765432"
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400/40 font-medium"
                  />
                </div>

                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">
                    Kota / Kabupaten <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Contoh: Jakarta Selatan"
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400/40 font-medium"
                  />
                </div>
              </div>

              <div className="text-xs">
                <label className="font-semibold text-neutral-700 block mb-1">
                  Alamat Lengkap <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Contoh: Jl. Senopati No. 42, RT 01/RW 03, Kebayoran Baru"
                  className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400/40 font-medium resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">
                    Kode Pos <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="Contoh: 12110"
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400/40 font-medium"
                  />
                </div>

                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">
                    Nama Brand / Toko
                  </label>
                  <input
                    type="text"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="Nama Toko"
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400/40 font-medium"
                  />
                </div>
              </div>

              <div className="text-xs">
                <label className="font-semibold text-neutral-700 block mb-1">
                  Kata Sandi Baru (Opsional)
                </label>
                <div className="relative max-w-sm">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-3.5 pr-10 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-1 cursor-pointer"
                  >
                    {showPassword ? <Check className="w-3.5 h-3.5" /> : <Star className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-3 bg-neutral-900 hover:bg-black text-white font-semibold text-xs rounded-2xl shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan Perubahan...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Simpan Profil Wajib</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Buyer Photo Lightbox */}
      {activeLightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setActiveLightbox(null)}
        >
          <div
            className="max-w-lg w-full bg-white rounded-3xl overflow-hidden shadow-2xl border border-neutral-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-square bg-neutral-900">
              <img
                src={activeLightbox.imageUrl}
                alt={activeLightbox.author}
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />
              <button
                type="button"
                onClick={() => setActiveLightbox(null)}
                className="absolute top-3 right-3 p-2 bg-black/65 hover:bg-black text-white rounded-full cursor-pointer"
                aria-label="Tutup foto"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-neutral-900">{activeLightbox.author}</p>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: activeLightbox.rating }).map((_, idx) => (
                    <Star key={idx} className="w-3 h-3 text-amber-500 fill-amber-500" />
                  ))}
                </div>
              </div>
              <p className="text-xs text-neutral-600">{activeLightbox.comment}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
