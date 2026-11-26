import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X, ArrowRight, AlertCircle } from 'lucide-react';

export interface AiSearchResult {
  query: string;
  summary: string;
  matchedProductIds: string[];
}

interface HeroBannerProps {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmitSearch: (overrideQuery?: string) => void;
  onClearSearch: () => void;
  isSearching: boolean;
  error: string | null;
  result: AiSearchResult | null;
  matchedCount: number;
}

const AI_LOADING_STEPS = [
  'Memahami kriteria pencarian...',
  'Menyaring ukuran, harga & lokasi...',
  'Menyusun rekomendasi terbaik...',
];

export const HeroBanner: React.FC<HeroBannerProps> = ({
  query,
  onQueryChange,
  onSubmitSearch,
  onClearSearch,
  isSearching,
  error,
  result,
  matchedCount,
}) => {
  const [statusStepIndex, setStatusStepIndex] = useState(0);

  useEffect(() => {
    if (!isSearching) {
      setStatusStepIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setStatusStepIndex((prev) => (prev + 1) % AI_LOADING_STEPS.length);
    }, 1450);

    return () => window.clearInterval(timer);
  }, [isSearching]);

  return (
    <section className="bg-transparent">
      <div className="w-full max-w-[1840px] mx-auto px-3.5 sm:px-6 lg:px-8 xl:px-10 pt-3 sm:pt-7 pb-1">
        <div className="max-w-3xl lg:max-w-4xl mx-auto space-y-2.5 sm:space-y-3">
          <div className="space-y-0.5">
            <h1 className="text-lg sm:text-2xl font-semibold tracking-tight text-neutral-900">
              Cari dengan AI
            </h1>
          </div>

          <div className="relative group">
            {/* Soft ambient liquid silver sheen */}
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute -inset-0.5 rounded-2xl overflow-hidden blur-md transition-opacity duration-300 ${
                isSearching
                  ? 'opacity-55'
                  : 'opacity-20 group-hover:opacity-35 group-focus-within:opacity-45'
              }`}
            >
              <div className={`ai-led-conic ${isSearching ? 'ai-led-conic-fast' : ''}`} />
            </div>

            {/* Crisp 2px running silver metallic liquid border */}
            <div className="relative p-[2px] rounded-2xl overflow-hidden shadow-2xs">
              <div
                aria-hidden="true"
                className={`ai-led-conic ${isSearching ? 'ai-led-conic-fast' : ''}`}
              />

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (query.trim() && !isSearching) {
                    onSubmitSearch();
                  }
                }}
                className="relative flex items-center gap-2 sm:gap-3 bg-white rounded-[14px] px-3.5 sm:px-4 py-2 sm:py-2.5 overflow-hidden"
              >
                {/* In-field Liquid Silver-Pearl Flow Layer */}
                <AnimatePresence>
                  {isSearching && (
                    <motion.div
                      key="ai-liquid-field-layer"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 overflow-hidden bg-gradient-to-r from-neutral-50/90 via-white to-neutral-100/80"
                    >
                      <div className="absolute -top-6 left-0 w-44 h-24 rounded-full blur-md ai-liquid-orb-a" />
                      <div className="absolute -bottom-6 right-10 w-52 h-24 rounded-full blur-md ai-liquid-orb-b" />
                      <div className="absolute inset-0 ai-liquid-sweep" />
                      <div className="absolute inset-0 ai-liquid-sweep-secondary" />
                      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neutral-200 to-transparent opacity-80" />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Leading Search Icon / Liquid Silver Orbital Ring */}
                <div className="relative z-10 w-5 h-5 flex items-center justify-center shrink-0">
                  {isSearching ? (
                    <span
                      aria-hidden="true"
                      className="relative w-4 h-4 sm:w-[18px] sm:h-[18px] flex items-center justify-center"
                    >
                      <span className="absolute inset-0 rounded-full border-[1.75px] border-neutral-200 border-t-neutral-700 border-r-neutral-400 ai-orbital-ring" />
                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-700" />
                    </span>
                  ) : (
                    <Search className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-400 transition-colors" />
                  )}
                </div>

                {/* Input Field + Breathing Status Label Overlay */}
                <div className="relative z-10 flex-1 min-w-0 flex items-center">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => onQueryChange(e.target.value)}
                    readOnly={isSearching}
                    placeholder="Contoh: sepatu size 44 under 1jt"
                    aria-label="Cari produk dengan AI"
                    className={`w-full bg-transparent text-sm sm:text-base text-neutral-900 placeholder:text-neutral-400 focus:outline-none py-1.5 transition-opacity duration-150 ${
                      isSearching ? 'opacity-0 pointer-events-none select-none' : 'opacity-100'
                    }`}
                  />

                  <AnimatePresence>
                    {isSearching && (
                      <motion.div
                        key="ai-status-overlay"
                        initial={{ opacity: 0, y: 3 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -3 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        aria-live="polite"
                        className="pointer-events-none absolute inset-0 flex items-center gap-2 min-w-0 pr-1"
                      >
                        <AnimatePresence mode="wait">
                          <motion.span
                            key={statusStepIndex}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                            className="text-sm sm:text-[15px] font-medium text-neutral-800 truncate ai-status-breathe"
                          >
                            {AI_LOADING_STEPS[statusStepIndex]}
                          </motion.span>
                        </AnimatePresence>

                        {query.trim() && (
                          <span className="hidden sm:inline-block text-xs text-neutral-400 truncate shrink min-w-0">
                            · &ldquo;{query.trim()}&rdquo;
                          </span>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Clear / Abort Button */}
                {(query || result || isSearching) && (
                  <button
                    type="button"
                    onClick={onClearSearch}
                    className="relative z-10 p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100/80 transition-colors shrink-0 cursor-pointer"
                    aria-label={isSearching ? 'Batalkan pencarian AI' : 'Hapus pencarian'}
                    title={isSearching ? 'Batalkan pencarian' : 'Hapus pencarian'}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                {/* Submit / Active Liquid Action Button */}
                <button
                  type="submit"
                  disabled={!query.trim() || isSearching}
                  className={`relative z-10 overflow-hidden inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all active:scale-[0.98] shrink-0 ${
                    isSearching
                      ? 'bg-neutral-900 text-white cursor-wait shadow-2xs'
                      : 'bg-neutral-900 hover:bg-black text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer'
                  }`}
                >
                  {isSearching ? (
                    <>
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 opacity-25 ai-liquid-sweep"
                      />
                      <span className="relative inline-flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded-full border-[1.75px] border-white/30 border-t-white ai-orbital-ring shrink-0" />
                        <span className="hidden sm:inline">Mencari</span>
                      </span>
                    </>
                  ) : (
                    <>
                      <span>Cari</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Harmonized Silver-Pearl Shimmer Preview Card */}
          <AnimatePresence mode="wait">
            {isSearching && (
              <motion.div
                key="ai-preview-shimmer"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -2 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="relative overflow-hidden bg-white border border-neutral-200/90 rounded-2xl p-4 space-y-2.5 shadow-2xs"
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 ai-liquid-shimmer-card"
                />
                <div className="relative flex items-center justify-between gap-3">
                  <div className="h-3 w-32 rounded-md bg-neutral-100" />
                  <div className="h-3 w-20 rounded-md bg-neutral-100/80" />
                </div>
                <div className="relative space-y-1.5">
                  <div className="h-3.5 w-full rounded-md bg-neutral-100/90" />
                  <div className="h-3.5 w-3/4 rounded-md bg-neutral-100/75" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!isSearching && error && (
            <div className="bg-rose-50/80 border border-rose-200 rounded-2xl p-3.5 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 text-rose-800 min-w-0">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm leading-relaxed min-w-0">
                  <p className="font-medium">Pencarian AI gagal diproses</p>
                  <p className="text-rose-700 mt-0.5 break-words">
                    {error.includes('"UNAVAILABLE"') || error.toLowerCase().includes('high demand')
                      ? 'Layanan AI sedang sangat sibuk karena lonjakan permintaan. Silakan coba lagi beberapa detik lagi.'
                      : error}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {query.trim() && (
                  <button
                    type="button"
                    onClick={() => onSubmitSearch()}
                    className="text-xs font-semibold text-rose-800 hover:text-rose-950 underline underline-offset-2 cursor-pointer"
                  >
                    Coba Lagi
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClearSearch}
                  className="text-xs font-medium text-rose-700 hover:text-rose-900 underline underline-offset-2 cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          )}

          {!isSearching && !error && result && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white border border-neutral-200/90 rounded-2xl p-3.5 sm:p-4 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs font-bold text-neutral-900 whitespace-nowrap">
                    Ringkasan AI
                  </span>
                  <span className="text-neutral-300" aria-hidden="true">·</span>
                  <span className="text-xs text-neutral-500 tabular-nums whitespace-nowrap">
                    {matchedCount} hasil
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onClearSearch}
                  className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 underline underline-offset-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Tampilkan semua
                </button>
              </div>
              <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed">
                {result.summary}
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
};
