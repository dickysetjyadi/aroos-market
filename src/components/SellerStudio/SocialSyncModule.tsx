import React, { useState } from 'react';
import { 
  RefreshCw, CheckCircle2, Instagram, MessageCircle, 
  ExternalLink, ShieldCheck, ArrowRight 
} from 'lucide-react';
import { SocialSyncConfig } from '../../types';

interface SocialSyncModuleProps {
  socialSyncs: SocialSyncConfig[];
  onToggleAutoSync: (id: SocialSyncConfig['id']) => void;
  onSyncAllNow: () => void;
  isSyncing: boolean;
}

export const SocialSyncModule: React.FC<SocialSyncModuleProps> = ({
  socialSyncs,
  onToggleAutoSync,
  onSyncAllNow,
  isSyncing,
}) => {
  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
            <span>Integrasi Stok Otomatis Media Sosial</span>
            <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
              Multi-Channel Aktif
            </span>
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Setiap ada penjualan atau update stok di AROOS, katalog Instagram Shop, TikTok Shop, & WhatsApp otomatis tersinkronisasi tanpa input ulang.
          </p>
        </div>

        <button
          onClick={onSyncAllNow}
          disabled={isSyncing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-all active:scale-95 disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Menyinkronkan Multi-Platform...' : 'Sinkronisasikan Sekarang'}</span>
        </button>
      </div>

      {/* Highlights Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl border border-neutral-200/80 shadow-2xs space-y-1">
          <span className="text-xs text-neutral-500 font-medium">Katalog Terkoneksi</span>
          <p className="text-xl font-bold text-neutral-900">
            {socialSyncs.filter(s => s.connected).length} dari 3 Kanal
          </p>
          <span className="text-[11px] text-emerald-600 font-medium block">
            Instagram & TikTok Shop Sinkron
          </span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-neutral-200/80 shadow-2xs space-y-1">
          <span className="text-xs text-neutral-500 font-medium">Pencegahan Overselling</span>
          <p className="text-xl font-bold text-emerald-600">100% Otomatis</p>
          <span className="text-[11px] text-neutral-500 block">
            Stok 0 otomatis unpublish di medsos
          </span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-neutral-200/80 shadow-2xs space-y-1">
          <span className="text-xs text-neutral-500 font-medium">Kecepatan API Latensi</span>
          <p className="text-xl font-bold text-neutral-900">&lt; 3 Detik</p>
          <span className="text-[11px] text-neutral-500 block">
            Webhook real-time ke Meta & ByteDance
          </span>
        </div>
      </div>

      {/* Social Channels List */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 divide-y divide-neutral-100 overflow-hidden shadow-xs">
        {socialSyncs.map(channel => (
          <div key={channel.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-neutral-100 text-neutral-900 flex items-center justify-center shrink-0 border border-neutral-200/80">
                {channel.id === 'instagram' && <Instagram className="w-5 h-5" />}
                {channel.id === 'tiktok' && (
                  <span className="text-xs font-black tracking-tight text-neutral-900">TikTok</span>
                )}
                {channel.id === 'whatsapp' && <MessageCircle className="w-5 h-5 text-emerald-600" />}
              </div>

              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-neutral-900">
                    {channel.platformName}
                  </h4>
                  {channel.connected ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                      <CheckCircle2 className="w-3 h-3" /> Terhubung
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">
                      Belum Aktif
                    </span>
                  )}
                </div>

                <p className="text-xs text-neutral-500">
                  Akun: <span className="font-medium text-neutral-800">{channel.accountHandle}</span> · Sinkronisasi terakhir: <span className="text-neutral-700 font-medium">{channel.lastSyncedAt}</span>
                </p>

                <p className="text-[11px] text-neutral-400">
                  {channel.syncedProductsCount} SKU produk terhubung langsung ke etalase live stream & postingan.
                </p>
              </div>
            </div>

            {/* Actions & Toggles */}
            <div className="flex items-center gap-4 self-end sm:self-center">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-neutral-600 cursor-pointer">
                  Auto-Sync Stok:
                </label>
                <button
                  onClick={() => onToggleAutoSync(channel.id)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out ${
                    channel.autoSync ? 'bg-neutral-900' : 'bg-neutral-200'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                      channel.autoSync ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <button
                onClick={onSyncAllNow}
                className="text-xs text-neutral-900 font-semibold hover:underline flex items-center gap-1"
              >
                <span>Perbarui</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>

          </div>
        ))}
      </div>

      {/* Sync Workflow Explanation */}
      <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/80 flex items-start gap-3 text-xs text-neutral-700">
        <RefreshCw className="w-5 h-5 text-neutral-900 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold text-neutral-900 block">
            Bagaimana Sinkronisasi Otomatis Bekerja?
          </span>
          <p className="text-neutral-600 leading-relaxed">
            Ketika ada deal di AROOS atau Anda mengubah stok via Barcode Scanner, webhook kami otomatis mengirimkan update ke Meta Catalog &amp; TikTok Commerce. Pembeli di media sosial langsung melihat stok faktual tanpa takut kehabisan barang saat menghubungi Anda di chat.
          </p>
        </div>
      </div>

    </div>
  );
};
