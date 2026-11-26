import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Flag, Loader2 } from 'lucide-react';
import { UserReport } from '../types';
import { submitUserReport } from '../services/reportService';
import {
  AROOS_BACKDROP_TRANSITION,
  AROOS_MODAL_TRANSITION,
  AROOS_MODAL_VARIANTS,
} from '../utils/motionPresets';

export interface ReportTarget {
  reportedUserId: string;
  reportedUserName: string;
  source: 'chat' | 'storefront' | 'product';
  targetProductId?: string;
  targetProductName?: string;
}

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: ReportTarget | null;
  reporterUserId: string;
  reporterUserName: string;
  onSubmitted?: (report: UserReport) => void;
}

const REPORT_REASONS = [
  'Penipuan / Transaksi Mencurigakan',
  'Barang Palsu / Tidak Sesuai Deskripsi',
  'Bahasa Kasar / Pelecehan',
  'Spam / Promosi Ilegal',
  'Lainnya',
];

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  target,
  reporterUserId,
  reporterUserName,
  onSubmitted,
}) => {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason(REPORT_REASONS[0]);
      setDetails('');
      setErrorMsg('');
      setIsSubmitting(false);
    }
  }, [isOpen, target?.reportedUserId, target?.targetProductId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target || !reporterUserId) return;

    if (!reason.trim()) {
      setErrorMsg('Pilih alasan laporan.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const created = await submitUserReport({
        reportedUserId: target.reportedUserId,
        reportedUserName: target.reportedUserName,
        reporterUserId,
        reporterUserName,
        source: target.source,
        targetProductId: target.targetProductId,
        targetProductName: target.targetProductName,
        reason,
        details: details.trim(),
      });
      onSubmitted?.(created);
      onClose();
    } catch {
      setErrorMsg('Gagal mengirim laporan. Coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && target && (
        <motion.div
          key="report-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={AROOS_BACKDROP_TRANSITION}
          className="fixed inset-0 z-[75] bg-neutral-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 select-none"
          onClick={onClose}
        >
          <motion.div
            key="report-modal-card"
            variants={AROOS_MODAL_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={AROOS_MODAL_TRANSITION}
            className="w-full sm:max-w-md bg-white border border-neutral-200 text-neutral-900 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 sm:px-6 py-4 border-b border-neutral-100 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Flag className="w-4 h-4 text-red-600 shrink-0" />
                <h3 className="text-sm sm:text-base font-bold text-neutral-900 truncate">
                  Laporkan Akun
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 rounded-full transition-colors cursor-pointer"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="p-4 sm:p-6 space-y-4 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]"
            >
              <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200/80 text-xs space-y-0.5">
                <p className="text-neutral-500">Akun yang dilaporkan</p>
                <p className="font-bold text-neutral-900 truncate">{target.reportedUserName}</p>
                {target.targetProductName && (
                  <p className="text-neutral-600 truncate">Item: {target.targetProductName}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 block">
                  Alasan Laporan
                </label>
                <div className="space-y-1.5">
                  {REPORT_REASONS.map((item) => (
                    <label
                      key={item}
                      className={`flex items-center gap-2.5 min-h-[42px] px-3 py-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                        reason === item
                          ? 'bg-red-50/70 border-red-300 text-neutral-900 font-semibold'
                          : 'bg-white border-neutral-200 text-neutral-700 hover:border-neutral-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="report-reason"
                        value={item}
                        checked={reason === item}
                        onChange={() => setReason(item)}
                        className="accent-red-600 shrink-0"
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 block mb-1">
                  Detail Tambahan (Opsional)
                </label>
                <textarea
                  rows={3}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Jelaskan kronologi singkat..."
                  className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs sm:text-sm text-neutral-900 focus:bg-white focus:border-neutral-900 focus:outline-none resize-none"
                />
              </div>

              {errorMsg && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  {errorMsg}
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
                  disabled={isSubmitting}
                  className="flex-1 min-h-[44px] px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-2xl cursor-pointer inline-flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{isSubmitting ? 'Mengirim...' : 'Kirim Laporan'}</span>
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
