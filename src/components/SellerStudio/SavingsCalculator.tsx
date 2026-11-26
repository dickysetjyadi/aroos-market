import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Calculator, X } from 'lucide-react';

export const SavingsCalculator: React.FC<{
  onSelectPlan?: () => void;
  onClose?: () => void;
}> = ({ onSelectPlan, onClose }) => {
  const [monthlyGMV, setMonthlyGMV] = useState<number>(35000000); // Rp 35.000.000 default
  const competitorFeeRate = 0.085; // 8.5%
  const nuraProSubscription = 99000; // Rp 99.000/bln

  const competitorCut = Math.round(monthlyGMV * competitorFeeRate);
  const nuraCost = nuraProSubscription;
  const netSavedMonthly = Math.max(0, competitorCut - nuraCost);
  const netSavedYearly = netSavedMonthly * 12;

  // Percentage for smooth progress bar track
  const progressPercent = Math.min(
    100,
    Math.max(0, ((monthlyGMV - 5000000) / (150000000 - 5000000)) * 100)
  );

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 8 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="bg-white text-neutral-900 rounded-2xl p-4 sm:p-6 shadow-xl border border-neutral-200/90 max-w-lg w-full mx-auto select-none font-sans"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-neutral-100 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-purple-50 text-[#522D60] flex items-center justify-center shrink-0 border border-purple-100">
            <Calculator className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-neutral-900 leading-snug">
              Kalkulator Hemat Admin
            </h3>
            <p className="text-xs text-neutral-500">Hitung estimasi penghematan toko Anda di AROOS</p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors shrink-0"
            aria-label="Tutup Kalkulator"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="mt-4 space-y-4">
        {/* Omzet Slider Box with Animated Custom Bar */}
        <div className="bg-neutral-50 border border-neutral-200/80 rounded-xl p-3.5 sm:p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs sm:text-sm">
            <span className="text-neutral-600 font-medium">Estimasi Omzet Bulanan:</span>
            <AnimatePresence mode="wait">
              <motion.span 
                key={monthlyGMV}
                initial={{ opacity: 0.6, y: -2 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className="text-base sm:text-lg font-extrabold text-neutral-900 tabular-nums"
              >
                Rp {monthlyGMV.toLocaleString('id-ID')}
              </motion.span>
            </AnimatePresence>
          </div>

          <div className="relative flex items-center">
            {/* Range Track Overlay */}
            <div className="absolute inset-x-0 h-2 bg-neutral-200 rounded-lg overflow-hidden pointer-events-none">
              <motion.div 
                className="h-full bg-neutral-900"
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
            <input
              type="range"
              min={5000000}
              max={150000000}
              step={2500000}
              value={monthlyGMV}
              onChange={(e) => setMonthlyGMV(Number(e.target.value))}
              className="relative w-full accent-neutral-900 h-2 bg-transparent opacity-0 cursor-pointer z-10"
            />
          </div>

          <div className="flex justify-between text-[11px] text-neutral-400 font-medium pt-0.5">
            <span>Rp 5 Juta</span>
            <span>Rp 75 Juta</span>
            <span>Rp 150 Juta</span>
          </div>
        </div>

        {/* Comparison Cards with Motion Feedback */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Marketplace Lain */}
          <motion.div 
            whileHover={{ y: -1 }}
            className="p-3.5 bg-rose-50/70 border border-rose-200/80 rounded-xl space-y-1 transition-all"
          >
            <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wide block">
              E-Commerce Lain (8.5%)
            </span>
            <p className="text-base sm:text-lg font-black text-rose-900 tabular-nums">
              -Rp {competitorCut.toLocaleString('id-ID')}
            </p>
            <span className="text-[11px] text-rose-600 block">Potongan per bulan</span>
          </motion.div>

          {/* AROOS Studio */}
          <motion.div 
            whileHover={{ y: -1 }}
            className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl space-y-1 transition-all"
          >
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide block">
              AROOS Studio
            </span>
            <p className="text-base sm:text-lg font-black text-emerald-900 tabular-nums">
              Rp {nuraCost.toLocaleString('id-ID')}
            </p>
            <span className="text-[11px] text-emerald-700 block">Biaya flat per bulan</span>
          </motion.div>
        </div>

        {/* Net Savings Box */}
        <motion.div 
          animate={{ scale: [0.99, 1] }}
          transition={{ duration: 0.2 }}
          className="bg-purple-50/80 border border-purple-200/80 rounded-xl p-4 text-center space-y-1"
        >
          <span className="text-xs font-semibold text-neutral-600 uppercase tracking-wide block">
            Penghematan Bersih Toko Anda
          </span>
          <div className="text-2xl sm:text-3xl font-black text-[#522D60] tabular-nums">
            Rp {netSavedMonthly.toLocaleString('id-ID')}
            <span className="text-xs font-normal text-neutral-500 ml-1">/ bulan</span>
          </div>
          <p className="text-xs text-emerald-700 font-semibold pt-0.5">
            Atau hemat Rp {netSavedYearly.toLocaleString('id-ID')} per tahun
          </p>
        </motion.div>

        {/* CTA Button */}
        {onSelectPlan && (
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={onSelectPlan}
            className="w-full py-3 px-4 bg-[#522D60] hover:bg-[#40234c] text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all duration-200 flex items-center justify-center gap-2 mt-2"
          >
            <span>Mulai Jualan Sekarang</span>
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        )}
      </div>

    </motion.div>
  );
};
