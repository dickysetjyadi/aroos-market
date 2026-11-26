import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Printer, CheckCircle2, FileSpreadsheet, Eye, X, ShieldCheck, Check, Package } from 'lucide-react';
import { Order, Product } from '../../types';
import {
  AROOS_BACKDROP_TRANSITION,
  AROOS_MODAL_TRANSITION,
  AROOS_MODAL_VARIANTS,
} from '../../utils/motionPresets';

interface ReportExporterProps {
  orders: Order[];
  products: Product[];
  brandName?: string;
}

export const ReportExporter: React.FC<ReportExporterProps> = ({
  orders,
  brandName = 'Lapak AROOS',
}) => {
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [showPdfPreview, setShowPdfPreview] = useState(false);

  const currentMonth = useMemo(() => {
    return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date());
  }, []);

  const currentDateLabel = useMemo(() => {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date());
  }, []);

  const { settledRevenue, pendingRevenue, totalDealValue } = useMemo(() => {
    let settled = 0;
    let pending = 0;
    for (const o of orders) {
      const amount = Number(o.totalAmount) || 0;
      if (o.paymentStatus === 'paid' || o.orderStatus === 'selesai') {
        settled += amount;
      } else {
        pending += amount;
      }
    }
    return {
      settledRevenue: settled,
      pendingRevenue: pending,
      totalDealValue: settled + pending,
    };
  }, [orders]);

  const handleDownloadCsv = () => {
    const headers = [
      'Nomor Pesanan',
      'Tanggal',
      'Pelanggan',
      'Kota',
      'Total (IDR)',
      'Metode Pembayaran',
      'Status Pesanan',
    ];
    const escapeCsv = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`;

    const rows = orders.map((o) => [
      escapeCsv(o.orderNumber),
      escapeCsv(o.createdAt),
      escapeCsv(o.customerName),
      escapeCsv(o.customerCity),
      o.totalAmount,
      escapeCsv(String(o.paymentMethod).toUpperCase()),
      escapeCsv(o.orderStatus),
    ]);

    const csvBody = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvBody], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Laporan_Pendapatan_Aroos_${currentMonth.replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadSuccess(
      orders.length > 0
        ? `Laporan CSV (${orders.length} transaksi) berhasil diunduh.`
        : 'Template laporan CSV berhasil diunduh.'
    );
    window.setTimeout(() => setDownloadSuccess(null), 3000);
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-neutral-900 tracking-tight">
            Laporan Pendapatan &amp; Rekonsiliasi Bulanan
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Rekapitulasi transaksi deal langsung untuk pembukuan penjualan lapak Anda.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="flex-1 sm:flex-none justify-center inline-flex items-center gap-1.5 px-3.5 py-2.5 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
            <span>Unduh Excel (.CSV)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPdfPreview(true)}
            className="flex-1 sm:flex-none justify-center inline-flex items-center gap-1.5 px-3.5 py-2.5 sm:py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <Eye className="w-3.5 h-3.5 shrink-0" />
            <span>Pratinjau &amp; Cetak PDF</span>
          </button>
        </div>
      </div>

      {downloadSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{downloadSuccess}</span>
        </div>
      )}

      {/* Monthly Financial Summary Card */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden shadow-xs">
        <div className="p-4 sm:p-5 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-neutral-50/60">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Periode Pembukuan
            </span>
            <h3 className="text-base font-bold text-neutral-900 capitalize">{currentMonth}</h3>
          </div>
          <span className="self-start sm:self-auto text-xs text-emerald-700 font-semibold bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/70 inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>{orders.length} Deal Tercatat</span>
          </span>
        </div>

        <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 border-b border-neutral-100">
          <div className="space-y-1">
            <span className="text-xs text-neutral-500">Pendapatan Deal Selesai:</span>
            <p className="text-xl sm:text-2xl font-black text-neutral-900 tabular-nums">
              Rp {settledRevenue.toLocaleString('id-ID')}
            </p>
            <span className="text-[11px] text-neutral-400">
              Total nilai transaksi yang telah diterima pembeli
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-neutral-500">Total Nilai Deal Keseluruhan:</span>
            <p className="text-xl sm:text-2xl font-black text-neutral-900 tabular-nums">
              Rp {totalDealValue.toLocaleString('id-ID')}
            </p>
            <span className="text-[11px] text-neutral-500 font-medium tabular-nums">
              {pendingRevenue > 0
                ? `Termasuk Rp ${pendingRevenue.toLocaleString('id-ID')} dalam proses`
                : `Terverifikasi pada periode ${currentMonth}`}
            </span>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="p-4 sm:p-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-600 mb-3">
            Ringkasan Transaksi ({orders.length})
          </h4>
          {orders.length === 0 ? (
            <div className="p-8 text-center bg-neutral-50/70 rounded-xl border border-neutral-200/60 space-y-1.5">
              <Package className="w-7 h-7 text-neutral-300 mx-auto" />
              <p className="text-xs font-semibold text-neutral-700">Belum ada transaksi tercatat</p>
              <p className="text-[11px] text-neutral-500">
                Deal COD atau transfer langsung yang dicatat dari obrolan chat akan tampil otomatis di laporan ini.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200/80 text-neutral-400 font-semibold pb-2">
                    <th className="py-2.5 pr-3 whitespace-nowrap">No. Pesanan</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Waktu</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Pelanggan</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Metode</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Nominal</th>
                    <th className="py-2.5 pl-3 text-center whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {orders.map((o) => {
                    const isSettled = o.paymentStatus === 'paid' || o.orderStatus === 'selesai';
                    return (
                      <tr key={o.id} className="hover:bg-neutral-50/80 transition-colors">
                        <td className="py-3 pr-3 font-mono font-medium text-neutral-900 whitespace-nowrap">
                          {o.orderNumber}
                        </td>
                        <td className="py-3 px-3 text-neutral-500 whitespace-nowrap">{o.createdAt}</td>
                        <td className="py-3 px-3 text-neutral-800 font-medium whitespace-nowrap">
                          {o.customerName}{' '}
                          <span className="text-neutral-400 font-normal">({o.customerCity})</span>
                        </td>
                        <td className="py-3 px-3 uppercase text-[11px] font-medium text-neutral-600 whitespace-nowrap">
                          {String(o.paymentMethod).replace('_', ' ')}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-neutral-900 tabular-nums whitespace-nowrap">
                          Rp {o.totalAmount.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 pl-3 text-center whitespace-nowrap">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              isSettled
                                ? 'text-emerald-700 bg-emerald-50 border-emerald-200/60'
                                : 'text-amber-700 bg-amber-50 border-amber-200/60'
                            }`}
                          >
                            {isSettled ? 'Selesai' : o.orderStatus === 'dikirim' ? 'Dikirim' : 'Diproses'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* PDF Modal Preview - Mobile Responsive & Sleek */}
      <AnimatePresence>
        {showPdfPreview && (
          <motion.div
            key="pdf-preview-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={AROOS_BACKDROP_TRANSITION}
            className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-6"
            onClick={() => setShowPdfPreview(false)}
          >
            <motion.div
              key="pdf-preview-modal"
              variants={AROOS_MODAL_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={AROOS_MODAL_TRANSITION}
              className="relative bg-white rounded-2xl sm:rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-neutral-200 flex flex-col max-h-[92dvh] sm:max-h-[88vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top Control Bar */}
              <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-neutral-100 bg-neutral-50/80 sticky top-0 z-10">
                <div className="flex items-center gap-2 min-w-0">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs sm:text-sm font-semibold text-neutral-900 tracking-tight truncate">
                    Pratinjau Dokumen Keuangan
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handlePrintPdf}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Cetak / Simpan PDF</span>
                    <span className="sm:hidden">Cetak</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPdfPreview(false)}
                    className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-200/50 transition-colors cursor-pointer"
                    aria-label="Tutup"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Document Printable View */}
              <div className="p-4 sm:p-8 overflow-y-auto space-y-6 text-neutral-800 bg-white" id="printable-statement">
                {/* Official Header */}
                <div className="border-b border-neutral-200 pb-5 flex flex-col sm:flex-row justify-between sm:items-start gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl sm:text-2xl font-black text-neutral-950 tracking-tight">AROOS STUDIO</span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">Ekosistem Marketplace Busana &amp; Barang Lokal</p>
                  </div>
                  <div className="sm:text-right text-xs bg-neutral-50 sm:bg-transparent p-3 sm:p-0 rounded-xl sm:rounded-none">
                    <span className="font-bold text-neutral-900 block text-xs sm:text-sm">LAPORAN PENDAPATAN &amp; REKONSILIASI</span>
                    <span className="text-neutral-500 block mt-0.5 capitalize">
                      Periode: <strong className="text-neutral-800">{currentMonth}</strong>
                    </span>
                    <span className="text-[11px] text-neutral-400 block mt-0.5">
                      Diterbitkan: {currentDateLabel}
                    </span>
                  </div>
                </div>

                {/* Merchant Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs bg-neutral-50/70 p-4 rounded-xl border border-neutral-200/70">
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
                      Nama Brand / Toko
                    </span>
                    <span className="font-bold text-neutral-900 block text-sm">{brandName}</span>
                    <div className="pt-1">
                      <span className="text-[11px] text-neutral-400 block">Status Akun:</span>
                      <span className="font-semibold text-neutral-800">Penjual Terverifikasi</span>
                    </div>
                  </div>
                  <div className="space-y-1 sm:border-l sm:border-neutral-200 sm:pl-4">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
                      Kanal Transaksi
                    </span>
                    <span className="font-bold text-neutral-900 block text-sm">
                      Direct Chat · COD &amp; Transfer
                    </span>
                    <span className="text-[11px] text-neutral-500 block">
                      Tanpa potongan payment gateway
                    </span>
                    <div className="pt-1 flex items-center gap-1.5 text-emerald-700 font-semibold text-xs">
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                      <span>Terverifikasi di AROOS</span>
                    </div>
                  </div>
                </div>

                {/* Breakdown Statement */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900">
                      Rincian Penjualan &amp; Rekonsiliasi
                    </h3>
                    <span className="text-[11px] text-neutral-400">IDR (Rupiah)</span>
                  </div>

                  <div className="border border-neutral-200/90 rounded-xl overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-neutral-50 text-neutral-600 font-semibold border-b border-neutral-200/90">
                        <tr>
                          <th className="py-2.5 px-3">Keterangan</th>
                          <th className="py-2.5 px-3 text-center w-28">Volume</th>
                          <th className="py-2.5 px-3 text-right w-36">Jumlah (IDR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        <tr className="hover:bg-neutral-50/50">
                          <td className="py-2.5 px-3 text-neutral-800">Deal Selesai</td>
                          <td className="py-2.5 px-3 text-center text-neutral-500 tabular-nums">
                            {orders.filter((o) => o.paymentStatus === 'paid' || o.orderStatus === 'selesai').length} Pesanan
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium tabular-nums text-neutral-900">
                            Rp {settledRevenue.toLocaleString('id-ID')}
                          </td>
                        </tr>
                        {pendingRevenue > 0 && (
                          <tr className="hover:bg-neutral-50/50">
                            <td className="py-2.5 px-3 text-neutral-800">Deal Dalam Proses / Pengiriman</td>
                            <td className="py-2.5 px-3 text-center text-neutral-500 tabular-nums">
                              {orders.filter((o) => o.paymentStatus !== 'paid' && o.orderStatus !== 'selesai').length} Pesanan
                            </td>
                            <td className="py-2.5 px-3 text-right font-medium tabular-nums text-neutral-700">
                              Rp {pendingRevenue.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        )}
                        <tr className="bg-neutral-900 text-white font-bold">
                          <td className="py-3 px-3">Total Nilai Deal Tercatat</td>
                          <td className="py-3 px-3 text-center text-neutral-300 tabular-nums">
                            {orders.length} Pesanan
                          </td>
                          <td className="py-3 px-3 text-right text-sm tabular-nums text-emerald-400">
                            Rp {totalDealValue.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Footer Verification Note */}
                <div className="pt-4 border-t border-neutral-200 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 text-xs text-neutral-500">
                  <div className="max-w-xs space-y-1">
                    <p className="text-[11px] leading-relaxed">
                      Ringkasan transaksi ini dihasilkan langsung dari catatan deal aktif lapak Anda di AROOS.
                    </p>
                  </div>
                  <div className="text-center w-full sm:w-44 bg-neutral-50/80 sm:bg-transparent p-3 sm:p-0 rounded-xl border border-neutral-200/60 sm:border-0">
                    <div className="w-28 h-9 border border-dashed border-emerald-300 bg-emerald-50/60 rounded-lg mx-auto mb-1.5 flex items-center justify-center gap-1.5 text-[10px] text-emerald-700 font-semibold">
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>Tercatat Sistem</span>
                    </div>
                    <span className="text-[11px] font-medium text-neutral-700 block">{brandName}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
