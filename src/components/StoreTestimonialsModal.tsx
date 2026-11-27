import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Star, Check, Camera, Maximize2, ThumbsUp } from 'lucide-react';
import { Review } from '../types';
import {
  AROOS_BACKDROP_TRANSITION,
  AROOS_MODAL_TRANSITION,
  AROOS_MODAL_VARIANTS,
} from '../utils/motionPresets';

interface StoreTestimonialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeName: string;
  storeCity: string;
  testimonials: Review[];
  averageRating: string;
  onToggleHelpful?: (reviewId: string) => void;
  helpfulVotedIds?: string[];
}

export const StoreTestimonialsModal: React.FC<StoreTestimonialsModalProps> = ({
  isOpen,
  onClose,
  storeName,
  storeCity,
  testimonials,
  averageRating,
  onToggleHelpful,
  helpfulVotedIds = [],
}) => {
  const [filter, setFilter] = useState<'all' | 'with_photo' | '5_star' | '4_star'>('all');
  const [activeLightbox, setActiveLightbox] = useState<{
    imageUrl: string;
    author: string;
    comment: string;
    rating: number;
    userStats?: string;
  } | null>(null);

  const filtered = testimonials.filter((r) => {
    if (filter === 'with_photo') return r.images && r.images.length > 0;
    if (filter === '5_star') return r.rating === 5;
    if (filter === '4_star') return r.rating === 4;
    return true;
  });

  const allPhotos = testimonials.flatMap((r) =>
    (r.images || []).map((imgUrl) => ({
      imageUrl: imgUrl,
      author: r.author,
      comment: r.comment,
      rating: r.rating,
    }))
  );

  const starCounts = {
    5: testimonials.filter((r) => r.rating === 5).length,
    4: testimonials.filter((r) => r.rating === 4).length,
    3: testimonials.filter((r) => r.rating === 3).length,
    2: testimonials.filter((r) => r.rating === 2).length,
    1: testimonials.filter((r) => r.rating === 1).length,
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="store-testimonials-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={AROOS_BACKDROP_TRANSITION}
          className="fixed inset-0 z-[70] bg-neutral-950/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-6 select-none"
          onClick={onClose}
        >
          <motion.div
            key="store-testimonials-card"
            variants={AROOS_MODAL_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={AROOS_MODAL_TRANSITION}
            className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-neutral-200 overflow-hidden max-h-[92dvh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 sm:px-6 py-4 border-b border-neutral-100 flex items-center justify-between gap-3 shrink-0 bg-white">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-neutral-900 truncate">
                  Testimoni &amp; Ulasan Toko {storeName}
                </h3>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  {storeCity} · {testimonials.length} Ulasan Terverifikasi Pembeli
                </p>
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

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-[#fafafa]">
              {/* Rating Overview Card */}
              <div className="bg-white rounded-2xl border border-neutral-200/90 p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-6 shadow-2xs">
                <div className="text-center sm:text-left shrink-0">
                  <div className="flex items-center justify-center sm:justify-start gap-1.5">
                    <Star className="w-6 h-6 sm:w-7 sm:h-7 text-amber-500 fill-amber-400" />
                    <span className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tabular-nums">
                      {averageRating}
                    </span>
                    <span className="text-sm text-neutral-400 font-medium">/ 5.0</span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">
                    Berdasarkan {testimonials.length} ulasan transaksi selesai
                  </p>
                </div>

                <div className="flex-1 w-full space-y-1.5 border-t sm:border-t-0 sm:border-l border-neutral-100 sm:pl-6 pt-4 sm:pt-0">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = starCounts[star as keyof typeof starCounts];
                    const pct = testimonials.length > 0 ? (count / testimonials.length) * 100 : 0;
                    return (
                      <div key={star} className="flex items-center gap-2 text-[11px]">
                        <span className="font-semibold text-neutral-700 w-6 shrink-0 flex items-center gap-0.5">
                          {star} <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-400" />
                        </span>
                        <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-400 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-neutral-400 tabular-nums font-mono">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Photo Showcase Strip */}
              {allPhotos.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-800 flex items-center gap-1.5 font-mono">
                      <Camera className="w-3.5 h-3.5 text-neutral-700" />
                      <span>Galeri Foto Testimoni ({allPhotos.length})</span>
                    </h4>
                  </div>
                  <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
                    {allPhotos.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveLightbox(item)}
                        className="group relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden shrink-0 border border-neutral-200 shadow-2xs hover:ring-2 hover:ring-neutral-900 transition-all cursor-pointer"
                      >
                        <img
                          src={item.imageUrl}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <Maximize2 className="w-3.5 h-3.5" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {[
                  { id: 'all', label: `Semua (${testimonials.length})` },
                  { id: 'with_photo', label: `Dengan Foto (${testimonials.filter(r => r.images && r.images.length > 0).length})` },
                  { id: '5_star', label: `5 Bintang (${starCounts[5]})` },
                  { id: '4_star', label: `4 Bintang (${starCounts[4]})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilter(tab.id as typeof filter)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      filter === tab.id
                        ? 'bg-neutral-900 text-white shadow-2xs'
                        : 'bg-white text-neutral-600 hover:text-neutral-900 border border-neutral-200/80'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Testimonials List */}
              <div className="bg-white rounded-2xl border border-neutral-200/90 p-4 sm:p-5 space-y-4 divide-y divide-neutral-100 shadow-2xs">
                {filtered.length === 0 ? (
                  <div className="py-10 text-center text-xs text-neutral-400">
                    Belum ada ulasan untuk filter ini.
                  </div>
                ) : (
                  filtered.map((rev) => (
                    <div key={rev.id} className="pt-4 first:pt-0 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-neutral-900">{rev.author}</span>
                          <span className="text-neutral-400 text-[11px]">({rev.city})</span>
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium border border-emerald-200/60">
                            <Check className="w-2.5 h-2.5" /> Pembeli Terverifikasi
                          </span>
                        </div>
                        <span className="text-neutral-400 text-[11px] shrink-0">{rev.date}</span>
                      </div>

                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <div className="flex items-center">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3.5 h-3.5 ${
                                i < rev.rating ? 'text-amber-400 fill-amber-400' : 'text-neutral-200'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-neutral-300">·</span>
                        <span className="text-neutral-600 font-medium text-[11px]">
                          Ukuran: {rev.sizePurchased}
                        </span>
                        <span className="text-neutral-300">·</span>
                        <span className="text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded-full text-[11px] font-medium">
                          Fit: {rev.fitFeedback}
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed">
                        &ldquo;{rev.comment}&rdquo;
                      </p>

                      {rev.images && rev.images.length > 0 && (
                        <div className="flex gap-2 pt-1">
                          {rev.images.map((imgSrc, imgIdx) => (
                            <button
                              key={imgIdx}
                              type="button"
                              onClick={() =>
                                setActiveLightbox({
                                  imageUrl: imgSrc,
                                  author: rev.author,
                                  comment: rev.comment,
                                  rating: rev.rating,
                                  userStats: rev.userStats,
                                })
                              }
                              className="relative w-16 h-16 rounded-xl overflow-hidden border border-neutral-200 shrink-0 group cursor-pointer"
                            >
                              <img
                                src={imgSrc}
                                alt=""
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                referrerPolicy="no-referrer"
                              />
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="pt-1">
                        {(() => {
                          const isVoted = helpfulVotedIds.includes(rev.id);
                          return (
                            <button
                              type="button"
                              onClick={() => onToggleHelpful?.(rev.id)}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                                isVoted
                                  ? 'bg-neutral-900 text-white'
                                  : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
                              }`}
                            >
                              <ThumbsUp className={`w-3 h-3 ${isVoted ? 'fill-white' : ''}`} />
                              <span>Membantu ({rev.helpfulCount})</span>
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>

          {/* Lightbox Modal */}
          {activeLightbox && (
            <div
              className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
              onClick={() => setActiveLightbox(null)}
            >
              <div
                className="relative max-w-lg w-full bg-neutral-900 rounded-3xl overflow-hidden shadow-2xl border border-neutral-800 p-4 space-y-3 text-white"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold">{activeLightbox.author}</span>
                    <span className="text-[10px] text-neutral-400">({activeLightbox.rating} Bintang)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveLightbox(null)}
                    className="p-1.5 text-neutral-400 hover:text-white rounded-full bg-white/10"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="rounded-2xl overflow-hidden bg-black max-h-[60vh] flex items-center justify-center">
                  <img
                    src={activeLightbox.imageUrl}
                    alt=""
                    className="max-h-[60vh] object-contain w-full"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <p className="text-xs text-neutral-300 italic">&ldquo;{activeLightbox.comment}&rdquo;</p>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
