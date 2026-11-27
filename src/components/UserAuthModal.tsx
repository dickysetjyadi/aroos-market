import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, ArrowRight, LogIn,
  Eye, EyeOff, Check, Loader2,
} from 'lucide-react';
import { UserAccount } from '../types';
import {
  setCurrentUserAccount,
  normalizeEmail,
  isValidEmailFormat,
} from '../utils/userDb';
import {
  findUserInDatabase,
  isEmailRegistered,
  registerUserWithEmail,
  saveUserToFirestore,
} from '../services/phoneAuthService';
import {
  hashPassword,
  isHashedPassword,
  verifyPassword,
} from '../utils/passwordHash';
import { loginSuperadmin } from '../services/adminService';
import { recordAuthTelemetryLog } from '../services/telemetryService';
import { useConfirm } from './ConfirmDialogContext';
import {
  AROOS_BACKDROP_TRANSITION,
  AROOS_MODAL_TRANSITION,
  AROOS_MODAL_VARIANTS,
} from '../utils/motionPresets';

interface UserAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (account: UserAccount) => void;
  onAdminSuccess?: (session: { token: string; expiresAt: number; name: string }) => void;
  initialMode?: 'login' | 'register';
  onGoHome?: () => void;
}

const INDONESIAN_CITIES = [
  'Jakarta Selatan',
  'Jakarta Pusat',
  'Jakarta Barat',
  'Bandung',
  'Surabaya',
  'Medan',
  'Semarang',
  'Makassar',
  'Tangerang',
  'Bekasi',
  'Bogor',
  'Yogyakarta',
  'Solo (Surakarta)',
  'Denpasar',
  'Malang',
];

export const UserAuthModal: React.FC<UserAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onAdminSuccess,
  initialMode = 'login',
  onGoHome,
}) => {
  const confirm = useConfirm();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [successState, setSuccessState] = useState<'idle' | 'processing' | 'success'>('idle');
  const [pendingAccount, setPendingAccount] = useState<UserAccount | null>(null);

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isCheckingLogin, setIsCheckingLogin] = useState(false);

  // Register form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registerError, setRegisterError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync mode when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setSuccessState('idle');
      setPendingAccount(null);
      setLoginError('');
      setRegisterError('');
      setName('');
      setEmail('');
      setPhone('');
      setRegisterPassword('');
      setConfirmPassword('');
    } else {
      setSuccessState('idle');
      setPendingAccount(null);
    }
  }, [isOpen, initialMode]);

  const startSuccessTransition = (account: UserAccount) => {
    setPendingAccount(account);
    setSuccessState('processing');

    setTimeout(() => {
      setSuccessState('success');

      setTimeout(() => {
        onSuccess(account);
        setSuccessState('idle');
        onClose();
      }, 900);
    }, 700);
  };

  // Handle Login with Email or Full Name
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const trimmedInput = loginIdentifier.trim();
    if (!trimmedInput) {
      setLoginError('Silakan masukkan email atau nama lengkap Anda.');
      return;
    }

    if (!loginPassword.trim()) {
      setLoginError('Silakan masukkan kata sandi Anda.');
      return;
    }

    setIsCheckingLogin(true);
    try {
      // Server-side verified Superadmin login (never stores secret in client)
      if (trimmedInput.toLowerCase() === 'admin' && onAdminSuccess) {
        const session = await loginSuperadmin(trimmedInput, loginPassword);
        setIsCheckingLogin(false);
        onAdminSuccess({
          token: session.token,
          expiresAt: session.expiresAt,
          name: session.admin?.name || 'Superadmin AROOS',
        });
        onClose();
        return;
      }

      const existingUser = await findUserInDatabase(trimmedInput, loginPassword);

      if (existingUser) {
        if (existingUser.password) {
          const passwordMatches = await verifyPassword(loginPassword, existingUser.password);
          if (!passwordMatches) {
            setLoginError('Kata sandi yang Anda masukkan salah.');
            setIsCheckingLogin(false);
            return;
          }
        }
        if (existingUser.accountStatus === 'blocked') {
          setLoginError(
            `Akun Anda diblokir oleh admin${
              existingUser.statusReason ? `: ${existingUser.statusReason}` : '.'
            }`
          );
          setIsCheckingLogin(false);
          return;
        }
        if (existingUser.accountStatus === 'banned') {
          setLoginError(
            `Akun Anda dibanned permanen${
              existingUser.statusReason ? `: ${existingUser.statusReason}` : '.'
            }`
          );
          setIsCheckingLogin(false);
          return;
        }
        let loggedInAccount = existingUser;
        if (!existingUser.password || !isHashedPassword(existingUser.password)) {
          const hashed = await hashPassword(loginPassword);
          loggedInAccount = { ...existingUser, password: hashed };
          void saveUserToFirestore(loggedInAccount).catch(() => {});
        }
        setCurrentUserAccount(loggedInAccount);
        void recordAuthTelemetryLog({
          userId: loggedInAccount.id,
          userName: loggedInAccount.name,
          userEmail: loggedInAccount.email,
          action: 'login',
          fallbackCity:
            loggedInAccount.buyerProfile?.city ||
            loggedInAccount.sellerProfile?.brandCity ||
            'Indonesia',
        });
        startSuccessTransition(loggedInAccount);
      } else {
        setLoginError(
          `Akun "${trimmedInput}" tidak ditemukan. Periksa kembali email/nama atau pilih Daftar Sekarang.`
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      setLoginError(msg || 'Terjadi kesalahan saat memeriksa akun. Silakan coba lagi.');
    } finally {
      setIsCheckingLogin(false);
    }
  };

  // Handle Registration with Required Fields
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError('');

    const effectiveName = name.trim();
    const normalizedEmail = normalizeEmail(email);
    const effectivePhone = phone.trim();

    if (!effectiveName) {
      setRegisterError('Nama lengkap wajib diisi.');
      return;
    }

    if (!normalizedEmail) {
      setRegisterError('Alamat email wajib diisi.');
      return;
    }

    if (!isValidEmailFormat(normalizedEmail)) {
      setRegisterError('Format email tidak valid. Contoh: nama@domain.com');
      return;
    }

    if (!effectivePhone) {
      setRegisterError('Nomor HP / WhatsApp wajib diisi.');
      return;
    }

    if (!registerPassword || registerPassword.length < 4) {
      setRegisterError('Kata sandi wajib diisi (minimal 4 karakter).');
      return;
    }

    if (registerPassword !== confirmPassword) {
      setRegisterError('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    setIsSubmitting(true);
    try {
      const emailTaken = await isEmailRegistered(normalizedEmail);
      if (emailTaken) {
        setRegisterError(
          `Email "${normalizedEmail}" sudah terdaftar. Gunakan alamat email lain.`
        );
        setIsSubmitting(false);
        return;
      }

      const ok = await confirm({
        title: 'Daftar Akun Baru',
        message: `Buat akun untuk ${effectiveName} (${normalizedEmail})?`,
        confirmLabel: 'Daftar',
      });
      if (!ok) {
        setIsSubmitting(false);
        return;
      }

      const userId = `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const today = new Date().toISOString().split('T')[0];

      const hashedPassword = await hashPassword(registerPassword);

      const accountDraft: UserAccount = {
        id: userId,
        name: effectiveName.slice(0, 80),
        email: normalizedEmail.slice(0, 120),
        phone: effectivePhone.slice(0, 30),
        password: hashedPassword,
        roles: ['buyer', 'seller'],
        activeRole: 'buyer',
        buyerProfile: {
          city: 'Jakarta Selatan',
          address: '',
          postalCode: '',
          totalOrdersCount: 0,
        },
        sellerProfile: {
          brandName: effectiveName,
          brandCity: 'Jakarta Selatan',
          planId: 'starter',
          registeredAt: today,
          verifiedBrand: true,
        },
        createdAt: today,
      };

      const registeredAccount = await registerUserWithEmail(accountDraft);
      setCurrentUserAccount(registeredAccount);
      void recordAuthTelemetryLog({
        userId: registeredAccount.id,
        userName: registeredAccount.name,
        userEmail: registeredAccount.email,
        action: 'register',
        fallbackCity: 'Jakarta Selatan',
      });

      setName('');
      setEmail('');
      setPhone('');
      setRegisterPassword('');
      setConfirmPassword('');

      startSuccessTransition(registeredAccount);
    } catch (err: unknown) {
      console.error('Registration error:', err);
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Gagal mendaftar. Silakan coba lagi.';
      setRegisterError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="auth-modal-root"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={AROOS_BACKDROP_TRANSITION}
          className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-2.5 sm:p-6"
          onClick={successState === 'idle' ? onClose : undefined}
        >
          {/* Smooth Dark Backdrop */}
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs -z-10" />

          <AnimatePresence mode="wait">
            {successState !== 'idle' ? (
              <motion.div
                key="success-screen"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/92 backdrop-blur-2xl overflow-hidden select-none"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Luminous atmospheric aurora */}
                <motion.div
                  initial={{ opacity: 0, y: 70, scale: 0.95 }}
                  animate={
                    successState === 'processing'
                      ? {
                          opacity: [0, 0.9, 0.85, 0.75],
                          y: [80, 25, -30],
                          scale: [0.95, 1.05, 1.15],
                        }
                      : {
                          opacity: [0.75, 0],
                          y: -40,
                          transition: { duration: 0.5, ease: 'easeOut' },
                        }
                  }
                  transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-[34rem] sm:w-[44rem] h-80 sm:h-96 pointer-events-none rounded-full blur-3xl"
                  style={{
                    background:
                      'radial-gradient(ellipse at center bottom, rgba(251, 146, 60, 0.45) 0%, rgba(236, 72, 153, 0.4) 35%, rgba(147, 51, 234, 0.35) 60%, rgba(79, 70, 229, 0.2) 80%, transparent 95%)',
                  }}
                />

                {/* Content Box */}
                <div className="relative z-10 max-w-sm w-full text-center space-y-6">
                  {successState === 'processing' ? (
                    <motion.div
                      key="proc-box"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-4"
                    >
                      <div className="w-16 h-16 mx-auto rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white tracking-tight">
                          Menyiapkan Akun Anda
                        </h3>
                        <p className="text-xs text-neutral-400 mt-1">
                          Menghubungkan ke katalog karya busana lokal AROOS...
                        </p>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="succ-box"
                      initial={{ opacity: 0, scale: 0.92, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      className="space-y-4"
                    >
                      <motion.div
                        initial={{ scale: 0.5, rotate: -30 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', damping: 14, stiffness: 200 }}
                        className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-400/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20"
                      >
                        <Check className="w-8 h-8 stroke-[2.5]" />
                      </motion.div>
                      <div>
                        <h3 className="text-xl font-bold text-white tracking-tight">
                          Selamat Datang di AROOS
                        </h3>
                        <p className="text-sm font-medium text-neutral-300 mt-1">
                          {pendingAccount?.name}
                        </p>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          Akun Anda aktif untuk belanja dan berjualan di AROOS.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ) : (
              /* MAIN AUTH CARD */
              <motion.div
                key="auth-dialog-card"
                variants={AROOS_MODAL_VARIANTS}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={AROOS_MODAL_TRANSITION}
                className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-neutral-200/80 p-4 sm:p-7 max-h-[92dvh] overflow-y-auto select-none"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header Wordmark & Close Button */}
                <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (onGoHome) onGoHome();
                        else onClose();
                      }}
                      className="font-extrabold tracking-tighter text-lg text-neutral-900 hover:opacity-75 transition-opacity cursor-pointer"
                      aria-label="AROOS Homepage"
                    >
                      AROOS
                    </button>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/40 rounded-full transition-colors cursor-pointer"
                    aria-label="Tutup"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* LOGIN VIEW */}
                {mode === 'login' ? (
                  <div className="space-y-4 pt-4">
                    <div>
                      <h3 className="text-base font-bold text-neutral-900 tracking-tight">
                        Masuk ke Akun
                      </h3>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Masukkan email atau nama lengkap dan kata sandi Anda.
                      </p>
                    </div>

                    {loginError && (
                      <div className="p-2.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-600">
                        {loginError}
                      </div>
                    )}

                    <form onSubmit={handleLoginSubmit} className="space-y-3.5 text-xs">
                      <div>
                        <label className="font-semibold text-neutral-700 block mb-1">
                          Email atau Nama Lengkap
                        </label>
                        <input
                          type="text"
                          required
                          autoComplete="username"
                          placeholder="Contoh: anindya@gmail.com atau Anindya Putri"
                          value={loginIdentifier}
                          onChange={(e) => setLoginIdentifier(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-neutral-900 placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400/40 transition-all"
                          autoFocus
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-neutral-700 block mb-1">
                          Kata Sandi
                        </label>
                        <div className="relative">
                          <input
                            type={showLoginPassword ? 'text' : 'password'}
                            required
                            autoComplete="current-password"
                            placeholder="••••••••"
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            className="w-full pl-3.5 pr-10 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400/40 transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowLoginPassword(!showLoginPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-1 cursor-pointer"
                            aria-label="Tampilkan atau sembunyikan kata sandi"
                          >
                            {showLoginPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="pt-1">
                        <button
                          type="submit"
                          disabled={isCheckingLogin}
                          className="w-full py-3 bg-neutral-900 hover:bg-black text-white font-semibold text-xs rounded-2xl shadow-xs transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                        >
                          {isCheckingLogin ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <LogIn className="w-4 h-4" />
                          )}
                          <span>{isCheckingLogin ? 'Memeriksa...' : 'Masuk Langsung'}</span>
                        </button>
                      </div>
                    </form>

                    {/* Switch to Register */}
                    <div className="text-center pt-1 text-xs text-neutral-600">
                      <span>Belum memiliki akun AROOS? </span>
                      <button
                        type="button"
                        onClick={() => {
                          setLoginError('');
                          setRegisterError('');
                          setMode('register');
                        }}
                        className="font-bold text-neutral-900 hover:underline inline-block cursor-pointer"
                      >
                        Daftar Sekarang
                      </button>
                    </div>
                  </div>
                ) : (
                  /* REGISTRATION VIEW (NAME + REQUIRED UNIQUE EMAIL + CITY + PASSWORD + CONFIRM) */
                  <div className="space-y-4 pt-4">
                    <div>
                      <h3 className="text-base font-bold text-neutral-900 tracking-tight">
                        Pendaftaran Akun Baru
                      </h3>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Lengkapi nama, email aktif, dan kata sandi Anda.
                      </p>
                    </div>

                    {registerError && (
                      <div className="p-2.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-600">
                        {registerError}
                      </div>
                    )}

                    {/* Registration Input Form */}
                    <form onSubmit={handleRegisterSubmit} className="space-y-3 text-xs">
                      <div>
                        <label className="font-semibold text-neutral-700 block mb-1">
                          Nama Lengkap
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={80}
                          autoComplete="name"
                          placeholder="Contoh: Anindya Putri"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400/40 transition-all font-medium"
                          autoFocus
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-neutral-700 block mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          required
                          maxLength={120}
                          autoComplete="email"
                          placeholder="Contoh: anindya@gmail.com"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (registerError) setRegisterError('');
                          }}
                          className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400/40 transition-all font-medium"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-neutral-700 block mb-1">
                          Nomor HP / WhatsApp <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="tel"
                          required
                          maxLength={30}
                          autoComplete="tel"
                          placeholder="Contoh: 081298765432"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400/40 transition-all font-medium"
                        />
                      </div>



                      <div>
                        <label className="font-semibold text-neutral-700 block mb-1">
                          Kata Sandi
                        </label>
                        <div className="relative">
                          <input
                            type={showRegisterPassword ? 'text' : 'password'}
                            required
                            autoComplete="new-password"
                            placeholder="Minimal 4 karakter"
                            value={registerPassword}
                            onChange={(e) => setRegisterPassword(e.target.value)}
                            className="w-full pl-3.5 pr-10 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400/40 transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-1 cursor-pointer"
                            aria-label="Tampilkan atau sembunyikan kata sandi"
                          >
                            {showRegisterPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="font-semibold text-neutral-700 block mb-1">
                          Konfirmasi Kata Sandi
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            required
                            autoComplete="new-password"
                            placeholder="Ulangi kata sandi"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full pl-3.5 pr-10 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400/40 transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-1 cursor-pointer"
                            aria-label="Tampilkan atau sembunyikan konfirmasi kata sandi"
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full py-3 bg-neutral-900 hover:bg-black text-white font-semibold text-xs rounded-2xl shadow-xs transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Memeriksa &amp; Mendaftar...</span>
                            </>
                          ) : (
                            <>
                              <span>Daftar Sekarang</span>
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      </div>
                    </form>

                    {/* Switch to Login */}
                    <div className="text-center pt-1 text-xs text-neutral-600">
                      <span>Sudah memiliki akun? </span>
                      <button
                        type="button"
                        onClick={() => {
                          setLoginError('');
                          setRegisterError('');
                          setMode('login');
                        }}
                        className="font-bold text-neutral-900 hover:underline inline-block cursor-pointer"
                      >
                        Masuk di Sini
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
