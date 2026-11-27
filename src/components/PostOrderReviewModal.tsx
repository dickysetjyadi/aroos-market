import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { compressImageForUpload } from '../utils/imageCompression';
import { X, Star, Camera, CheckCircle2, Loader2 } from 'lucide-react';
import { Order, Review } from '../types';
import {
  AROOS_BACKDROP_TRANSITION,
  AROOS_MODAL_TRANSITION,
  AROOS_MODAL_VARIANTS,
} from '../utils/motionPresets';

interface PostOrderReviewModalProps {
  isOpen: boolean;
  order: Order | null;
  onClose: () => void;
  onSubmitReview: (review: Omit<Review, 'id' | 'date' | 'helpfulCount'>) => Promise<void> | void;
  reviewerName: string;
  reviewerCity: string;
  reviewedOrderItemKeys?: string[];
}

export const PostOrderReviewModal: React.FC<PostOrderReviewModalProps> = ({
  isOpen,
  order,
  onClose,
  onSubmitReview,
  reviewerName,
  reviewerCity,
  reviewedOrderItemKeys = [],
}) => {
  const [stage, setStage] = useState<'prompt' | 'form'>('prompt');
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const [rating, setRating] = useState(5);
  const [fitFeedback, setFitFeedback] = useState<'Pas' | 'Agak Kecil' | 'Agak Longgar'>('Pas');
  const [comment, setComment] = useState('');
  const [userStats, setUserStats] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const orderItems = order?.items || [];
      const firstUnreviewedIdx = order
        ? orderItems.findIndex(
            (item) => !reviewedOrderItemKeys.includes(`${order.id}__${item.productId}`)
          )
        : 0;
      setStage('prompt');
      setSelectedItemIndex(firstUnreviewedIdx >= 0 ? firstUnreviewedIdx : 0);
      setRating(5);
      setFitFeedback('Pas');
      setComment('');
      setUserStats('');
      setPhotos([]);
      setPhotoError(null);
      setFormError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, order?.id]);

  const items = order?.items || [];
  const targetItem = items[selectedItemIndex] || items[0] || null;
  const isTargetItemReviewed = Boolean(
    order && targetItem && reviewedOrderItemKeys.includes(`${order.id}__${targetItem.productId}`)
  );

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    setPhotoError(null);
    const remainingSlots = 4 - photos.length;
    if (remainingSlots <= 0) {
      setPhotoError('Maksimal 4 foto per ulasan.');
      return;
    }

    const toProcess = files.slice(0, remainingSlots);
    for (const file of toProcess) {
      if (file.size > 25 * 1024 * 1024) {
        setPhotoError('Ukuran foto maksimal 25MB.');
        continue;
      }
      try {
        const compressed = await compressImageForUpload(file, {
          maxDimension: 760,
          quality: 0.72,
          maxDataUrlLength: 200_000,
        });
        setPhotos((prev) => (prev.length < 4 ? [...prev, compressed] : prev));
      } catch (err) {
        setPhotoError(err instanceof Error ? err.message : 'Gagal memproses foto.');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetItem) return;
    if (isTargetItemReviewed) {
      setFormError('Barang ini sudah Anda ulas untuk pesanan ini.');
      return;
    }

    const cleanComment = comment.trim();
    if (!cleanComment) {
      setFormError('Tulis sedikit ulasan tentang barang ini.');
      return;
    }

    setFormError(null);
    setIsSubmitting(true);
    try {
      await onSubmitReview({
        productId: targetItem.productId,
        author: (reviewerName || order?.customerName || 'Pembeli AROOS').trim(),
        city: (reviewerCity || order?.customerCity || 'Indonesia').trim(),
        rating,
        comment: cleanComment,
        sizePurchased: targetItem.size || 'Standar',
        fitFeedback,
        verifiedPurchase: true,
        images: photos.length > 0 ? photos : undefined,
        userStats: userStats.trim() || undefined,
      });
      onClose();
    } catch {
      setFormError('Gagal mengirim ulasan. Coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && order && targetItem && (
        <motion.div
          key="post-order-review-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={AROOS_BACKDROP_TRANSITION}
          className="fixed inset-0 z-[70] bg-neutral-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 select-none"
          onClick={onClose}
        >
          <motion.div
            key="post-order-review-card"
            variants={AROOS_MODAL_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={AROOS_MODAL_TRANSITION}
            className="w-full sm:max-w-md bg-white border border-neutral-200 text-neutral-900 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 sm:px-6 py-4 border-b border-neutral-100 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <h3 className="text-sm sm:text-base font-bold text-neutral-900 truncate">
                  {stage === 'prompt' ? 'Beri Ulasan Yuk' : 'Tulis Ulasan Barang'}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 rounded-full transition-colors cursor-pointer shrink-0"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {stage === 'prompt' ? (
              <div className="p-4 sm:p-6 space-y-5 overflow-y-auto">
                <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-2xl border border-neutral-200/80">
                  <div className="w-14 h-16 rounded-xl overflow-hidden bg-neutral-200 border border-neutral-200 shrink-0">
                    <img
                      src={targetItem.image}
                      alt={targetItem.productName}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-emerald-700">
                      Pesanan #{order.orderNumber} Selesai
                    </p>
                    <p className="text-xs sm:text-sm font-bold text-neutral-900 truncate mt-0.5">
                      {targetItem.productName}
                    </p>
                    <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                      {order.sellerBrandName || targetItem.brand}
                      {items.length > 1 ? ` · +${items.length - 1} barang lainnya` : ''}
                    </p>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                  Pesananmu sudah diterima. Bagikan penilaian kondisinya untuk membantu pembeli lain.
                </p>

                <div className="flex flex-col sm:flex-row gap-2.5 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
                  <button
                    type="button"
                    onClick={() => setStage('form')}
                    className="w-full sm:flex-1 min-h-[44px] px-4 py-2.5 bg-neutral-900 hover:bg-black text-white text-xs sm:text-sm font-bold rounded-2xl transition-all active:scale-[0.98] cursor-pointer inline-flex items-center justify-center gap-2 shadow-xs"
                  >
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span>Beri Ulasan</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-2xl transition-colors cursor-pointer"
                  >
                    Nanti Saja
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
                {items.length > 1 && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-neutral-600 block">
                      Pilih Barang yang Diulas
                    </label>
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
                      {items.map((item, idx) => {
                        const alreadyDone = Boolean(
                          order && reviewedOrderItemKeys.includes(`${order.id}__${item.productId}`)
                        );
                        return (
                          <button
                            key={`${item.productId}-${idx}`}
                            type="button"
                            disabled={alreadyDone}
                            onClick={() => setSelectedItemIndex(idx)}
                            className={`px-3 py-2 rounded-xl border text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
                              alreadyDone
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 opacity-75 cursor-not-allowed'
                                : selectedItemIndex === idx
                                ? 'bg-neutral-900 text-white border-neutral-900 cursor-pointer'
                                : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:border-neutral-400 cursor-pointer'
                            }`}
                          >
                            {item.productName}{alreadyDone ? ' · Sudah Diulas' : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-2xl border border-neutral-200/80">
                  <img
                    src={targetItem.image}
                    alt={targetItem.productName}
                    className="w-12 h-14 rounded-xl object-cover border border-neutral-200 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-neutral-900 truncate">{targetItem.productName}</p>
                    <p className="text-[11px] text-neutral-500 mt-0.5 truncate">
                      Ukuran: {targetItem.size || 'Standar'} · {order.sellerBrandName || targetItem.brand}
                    </p>
                  </div>
                </div>

                {/* Star Rating */}
                <div>
                  <label className="text-xs font-semibold text-neutral-700 block mb-1.5">
                    Penilaian Bintang
                  </label>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className="w-10 h-10 rounded-xl bg-neutral-50 hover:bg-amber-50 border border-neutral-200 flex items-center justify-center cursor-pointer active:scale-90 transition-all"
                        aria-label={`${star} Bintang`}
                      >
                        <Star
                          className={`w-5 h-5 ${
                            star <= rating
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-neutral-300'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="text-xs font-bold text-neutral-700 ml-2 tabular-nums">
                      {rating}/5
                    </span>
                  </div>
                </div>

                {/* Fit Feedback */}
                <div>
                  <label className="text-xs font-semibold text-neutral-700 block mb-1.5">
                    Kesesuaian Ukuran / Kondisi
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Pas', 'Agak Kecil', 'Agak Longgar'] as const).map((fit) => (
                      <button
                        key={fit}
                        type="button"
                        onClick={() => setFitFeedback(fit)}
                        className={`min-h-[40px] px-2.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                          fitFeedback === fit
                            ? 'bg-neutral-900 text-white border-neutral-900'
                            : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400'
                        }`}
                      >
                        {fit}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Comment */}
                <div>
                  <label className="text-xs font-semibold text-neutral-700 block mb-1">
                    Ulasan Kamu <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Ceritakan kondisi barang, bahan, atau kecepatan penjual..."
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs sm:text-sm text-neutral-900 focus:bg-white focus:border-neutral-900 focus:outline-none resize-none"
                  />
                </div>

                {/* Optional stats + photo */}
                <div className="space-y-2">
                  <input
                    type="text"
                    value={userStats}
                    onChange={(e) => setUserStats(e.target.value)}
                    placeholder="Opsional: TB/BB, misal 170cm / 64kg"
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:bg-white focus:border-neutral-900 focus:outline-none"
                  />

                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="min-h-[40px] px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Tambah Foto ({photos.length}/4)</span>
                    </button>

                    {photos.map((src, idx) => (
                      <div key={idx} className="relative w-11 h-11 rounded-xl overflow-hidden border border-neutral-200 shrink-0">
                        <img src={src} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/75 text-white rounded-full flex items-center justify-center cursor-pointer"
                          aria-label="Hapus foto"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {photoError && <p className="text-[11px] text-red-600">{photoError}</p>}
                </div>

                {formError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    {formError}
                  </p>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    className="min-h-[44px] px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-2xl cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || isTargetItemReviewed}
                    className="flex-1 min-h-[44px] px-4 py-2.5 bg-neutral-900 hover:bg-black disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-2xl cursor-pointer inline-flex items-center justify-center gap-2"
                  >
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>
                      {isTargetItemReviewed
                        ? 'Sudah Diulas'
                        : isSubmitting
                        ? 'Mengirim...'
                        : 'Kirim Ulasan'}
                    </span>
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
