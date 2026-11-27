import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Camera, Check, Eye, EyeOff, Loader2, MapPin
} from 'lucide-react';
import { UserAccount, UserProfile } from '../types';
import { setCurrentUserAccount, getCurrentUserAccount } from '../utils/userDb';
import { saveUserToFirestore } from '../services/phoneAuthService';
import { hashPassword } from '../utils/passwordHash';
import { compressImageForUpload } from '../utils/imageCompression';
import { useConfirm } from './ConfirmDialogContext';
import {
  AROOS_BACKDROP_TRANSITION,
  AROOS_MODAL_TRANSITION,
  AROOS_MODAL_VARIANTS,
} from '../utils/motionPresets';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  currentUserAccount: UserAccount | null;
  onProfileUpdated: (updatedAccount: UserAccount) => void;
  onOpenSellerUpgrade?: () => void;
}

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  currentUserAccount,
  onProfileUpdated,
}) => {
  const confirm = useConfirm();
  const [name, setName] = useState(userProfile.name || '');
  const [brandName, setBrandName] = useState(userProfile.brandName || userProfile.name || '');
  const [phone, setPhone] = useState(currentUserAccount?.phone || userProfile.phone || '');
  const [city, setCity] = useState(
    currentUserAccount?.buyerProfile?.city ||
      userProfile.buyerProfile?.city ||
      userProfile.brandCity ||
      ''
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
    if (!isOpen) return;
    setName(userProfile.name || '');
    setBrandName(userProfile.brandName || userProfile.name || '');
    setPhone(currentUserAccount?.phone || userProfile.phone || '');
    setCity(
      currentUserAccount?.buyerProfile?.city ||
        userProfile.buyerProfile?.city ||
        userProfile.brandCity ||
        ''
    );
    setAddress(
      currentUserAccount?.buyerProfile?.address || userProfile.buyerProfile?.address || ''
    );
    setPostalCode(
      currentUserAccount?.buyerProfile?.postalCode || userProfile.buyerProfile?.postalCode || ''
    );
    setAvatarUrl(currentUserAccount?.avatarUrl || userProfile.avatarUrl || '');
    setAvatarError(false);
    setNewPassword('');
    setErrorMessage('');
    setSuccessMessage('');
  }, [isOpen, userProfile, currentUserAccount]);

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setErrorMessage('Ukuran foto maksimal 25MB.');
      return;
    }

    try {
      const compressed = await compressImageForUpload(file, {
        maxDimension: 420,
        quality: 0.78,
        maxDataUrlLength: 350_000,
      });
      setAvatarUrl(compressed);
      setAvatarError(false);
      setErrorMessage('');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Gagal memproses foto profil.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!name.trim()) {
      setErrorMessage('Nama tidak boleh kosong.');
      return;
    }

    if (newPassword && newPassword.length < 4) {
      setErrorMessage('Kata sandi baru minimal 4 karakter.');
      return;
    }

    const ok = await confirm({
      title: 'Simpan Profil',
      message: `Simpan perubahan profil dan alamat untuk ${name.trim()}?`,
      confirmLabel: 'Simpan',
    });
    if (!ok) return;

    setIsSaving(true);
    try {
      const currentAcc = currentUserAccount || getCurrentUserAccount();
      if (!currentAcc) {
        throw new Error('Akun pengguna tidak ditemukan.');
      }

      const trimmedCity = (city.trim() || currentAcc.sellerProfile?.brandCity || 'Jakarta').slice(0, 80);
      const trimmedAddress = address.trim();
      const trimmedPostal = postalCode.trim();
      const existingSavedAddresses = currentAcc.buyerProfile?.savedAddresses || [];
      const nextSavedAddresses =
        trimmedAddress && !existingSavedAddresses.includes(trimmedAddress)
          ? [trimmedAddress, ...existingSavedAddresses].slice(0, 5)
          : existingSavedAddresses;

      const nextPassword = newPassword
        ? await hashPassword(newPassword)
        : currentAcc.password;

      const updatedAccount: UserAccount = {
        ...currentAcc,
        name: name.trim().slice(0, 80),
        phone: (phone.trim() || currentAcc.phone || '').slice(0, 30),
        avatarUrl: avatarUrl.trim(),
        password: nextPassword?.slice(0, 200),
        roles: Array.from(new Set([...(currentAcc.roles || ['buyer']), 'seller'])),
        buyerProfile: {
          ...currentAcc.buyerProfile,
          address: trimmedAddress,
          city: trimmedCity,
          postalCode: trimmedPostal,
          savedAddresses: nextSavedAddresses,
        },
        sellerProfile: {
          brandName: (brandName.trim() || name.trim()).slice(0, 80),
          brandCity: (trimmedCity || currentAcc.sellerProfile?.brandCity || 'Bandung').slice(0, 80),
          planId: currentAcc.sellerProfile?.planId || 'starter',
          registeredAt: currentAcc.sellerProfile?.registeredAt || new Date().toISOString().split('T')[0],
          verifiedBrand: true,
        },
      };

      const savedAccount = await saveUserToFirestore(updatedAccount);
      setCurrentUserAccount(savedAccount);
      onProfileUpdated(savedAccount);

      setSuccessMessage('Profil & alamat berhasil disimpan.');
      setNewPassword('');
      setTimeout(() => {
        setSuccessMessage('');
        onClose();
      }, 900);
    } catch (err: any) {
      console.error('Update profile error:', err);
      setErrorMessage(err?.message || 'Gagal menyimpan profil.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="profile-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={AROOS_BACKDROP_TRANSITION}
          className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 select-none"
          onClick={onClose}
        >
          <motion.div
            key="profile-dialog"
            variants={AROOS_MODAL_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={AROOS_MODAL_TRANSITION}
            className="relative w-full max-w-md max-h-[92dvh] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-neutral-200/80 p-5 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
            <h2 className="text-sm font-bold tracking-tight text-neutral-900 uppercase font-mono">
              Profil Akun
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-full transition-colors cursor-pointer"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Feedback alerts */}
          {errorMessage && (
            <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
              {errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Single Unified Clean Form */}
          <form onSubmit={handleSave} className="space-y-4 pt-4 text-xs">
            {/* Center Editorial Avatar */}
            <div className="flex flex-col items-center justify-center space-y-2 pb-1">
              <div className="relative group cursor-pointer">
                <div className="w-18 h-18 rounded-full overflow-hidden bg-neutral-900 text-white flex items-center justify-center text-xl font-bold border-2 border-neutral-100 shadow-sm">
                  {avatarUrl && !avatarError ? (
                    <img 
                      src={avatarUrl} 
                      alt={name} 
                      onError={() => setAvatarError(true)}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <span>{name ? name[0].toUpperCase() : 'U'}</span>
                  )}
                </div>

                <label 
                  htmlFor="avatar-upload" 
                  className="absolute inset-0 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer backdrop-blur-[1px]"
                >
                  <Camera className="w-4 h-4" />
                </label>
                <input 
                  id="avatar-upload" 
                  type="file" 
                  accept="image/*" 
                  onChange={handleAvatarFile} 
                  className="hidden" 
                />
              </div>

              <div className="flex items-center gap-2">
                <label 
                  htmlFor="avatar-upload" 
                  className="text-[11px] font-semibold text-neutral-900 hover:underline cursor-pointer"
                >
                  Ubah Foto
                </label>
                {avatarUrl && (
                  <>
                    <span className="text-neutral-300">·</span>
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'Hapus Foto Profil',
                          message: 'Hapus foto profil saat ini?',
                          confirmLabel: 'Hapus',
                          tone: 'danger',
                        });
                        if (ok) setAvatarUrl('');
                      }}
                      className="text-[11px] text-neutral-400 hover:text-red-600 cursor-pointer transition-colors"
                    >
                      Hapus
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Email Field (Read-Only Account Identity) */}
            {userProfile.email && (
              <div>
                <label className="font-semibold text-neutral-700 block mb-1">
                  Email Terdaftar
                </label>
                <input
                  type="email"
                  value={userProfile.email}
                  readOnly
                  disabled
                  className="w-full px-3.5 py-2.5 bg-neutral-100 border border-neutral-200/80 rounded-2xl text-neutral-500 cursor-not-allowed font-medium"
                />
              </div>
            )}

            {/* Name Field */}
            <div>
              <label className="font-semibold text-neutral-700 block mb-1">
                Nama Lengkap
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama Anda"
                className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400/40 transition-all font-medium"
              />
            </div>

            {/* Brand Name Field */}
            <div>
              <label className="font-semibold text-neutral-700 block mb-1">
                Nama Brand / Toko Anda
              </label>
              <input
                type="text"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Contoh: KALA Studio"
                className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400/40 transition-all font-medium"
              />
            </div>

            {/* Saved Address Section for One-Click Chat Sharing */}
            <div className="pt-3 border-t border-neutral-100 space-y-3">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-neutral-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-neutral-900 leading-snug">
                    Alamat Pengiriman
                  </h3>
                  <p className="text-[11px] text-neutral-500 leading-snug mt-0.5">
                    Digunakan untuk tombol Alamat Saya di chat
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">
                    Nomor HP / WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0812xxxxxxxx"
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400/40 transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">
                    Kota / Kabupaten
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Contoh: Jakarta Selatan"
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400/40 transition-all font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-neutral-700 block mb-1">
                  Alamat Lengkap (Jalan, No. Rumah, Kecamatan)
                </label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Jl. Senopati No. 42, RT 02/RW 04, Kebayoran Baru"
                  className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400/40 transition-all font-medium resize-none"
                />
              </div>

              <div>
                <label className="font-semibold text-neutral-700 block mb-1">
                  Kode Pos (Opsional)
                </label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="Contoh: 12190"
                  className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400/40 transition-all font-medium"
                />
              </div>
            </div>

            {/* New Password (Optional) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-neutral-700">
                  Kata Sandi Baru
                </label>
                <span className="text-[10px] text-neutral-400">Kosongkan jika tidak diubah</span>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-3.5 pr-10 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400/40 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-3 bg-neutral-900 hover:bg-black text-white font-semibold text-xs rounded-2xl shadow-xs transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <span>Simpan Perubahan</span>
                )}
              </button>
            </div>
          </form>
        </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
