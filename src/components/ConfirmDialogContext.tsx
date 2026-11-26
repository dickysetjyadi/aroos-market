import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger' | 'warning';
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export const useConfirm = (): ConfirmFn => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return ctx;
};

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeOptions, setActiveOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((result: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setActiveOptions(null);
    if (resolve) resolve(result);
  }, []);

  const confirm = useCallback<ConfirmFn>((options) => {
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }

    setActiveOptions(options);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  useEffect(() => {
    if (!activeOptions) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        settle(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeOptions, settle]);

  const tone = activeOptions?.tone || 'default';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      <AnimatePresence>
        {activeOptions && (
          <div
            className="fixed inset-0 z-[120] overflow-y-auto flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="aroos-confirm-title"
            onClick={() => settle(false)}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs -z-10"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 6 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-xs bg-white rounded-3xl border border-neutral-200/90 shadow-2xl p-5 sm:p-6 space-y-4"
            >
              <div className="space-y-1">
                <h3
                  id="aroos-confirm-title"
                  className="text-base font-bold text-neutral-900 leading-snug"
                >
                  {activeOptions.title}
                </h3>
                {activeOptions.message && (
                  <p className="text-xs text-neutral-500 leading-relaxed">
                    {activeOptions.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => settle(false)}
                  className="min-h-[40px] px-4 py-2 rounded-full text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {activeOptions.cancelLabel || 'Batal'}
                </button>
                <button
                  type="button"
                  autoFocus
                  onClick={() => settle(true)}
                  className={`min-h-[40px] px-4 py-2 rounded-full text-xs font-semibold text-white transition-all active:scale-[0.98] cursor-pointer whitespace-nowrap ${
                    tone === 'danger'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-neutral-900 hover:bg-black'
                  }`}
                >
                  {activeOptions.confirmLabel || 'Lanjutkan'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
};
