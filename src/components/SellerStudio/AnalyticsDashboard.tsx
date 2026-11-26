import React from 'react';
import { 
  TrendingUp, Users, ShoppingBag, MapPin, 
  BarChart3, DollarSign, Clock, PackageCheck 
} from 'lucide-react';
import { DEMOGRAPHIC_DATA, SIZE_TRENDS, HOURLY_SALES_TREND } from '../../data/mockData';
import { Order, Product } from '../../types';

interface AnalyticsDashboardProps {
  orders: Order[];
  products: Product[];
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  orders,
  products,
}) => {
  const totalRevenue = orders.reduce((sum, o) => sum + (o.paymentStatus === 'paid' ? o.totalAmount : 0), 0) + 38240000;
  const totalOrdersCount = orders.length + 84;
  const activeStockCount = products.filter((p) => p.stock > 0 && p.listingStatus !== 'sold').length;

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">
            Analitik Performa Penjualan & Data Tren Pembeli
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Wawasan berbasis data untuk memahami preferensi pembeli fashion lokal dan pola transaksi harian.
          </p>
        </div>

        <div className="text-xs text-neutral-500 bg-neutral-100 px-3 py-1.5 rounded-lg">
          Data sinkronisasi: <span className="font-semibold text-neutral-800">Hari ini, 25 Okt 2026</span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total GMV */}
        <div className="p-5 bg-white rounded-xl border border-neutral-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span className="font-medium">Total Omzet Penjualan</span>
            <DollarSign className="w-4 h-4 text-[#522D60]" />
          </div>
          <p className="text-2xl font-extrabold text-neutral-900 tabular-nums">
            Rp {totalRevenue.toLocaleString('id-ID')}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+18.4% dari bulan lalu</span>
          </div>
        </div>

        {/* Direct Chat Active Listings */}
        <div className="p-5 bg-purple-50 rounded-xl border border-purple-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-[#522D60] text-xs">
            <span className="font-bold uppercase tracking-wider">Katalog Produk Aktif</span>
            <PackageCheck className="w-4 h-4 text-[#522D60]" />
          </div>
          <p className="text-2xl font-black text-[#522D60] tabular-nums">
            {activeStockCount} Item
          </p>
          <span className="text-[11px] text-[#522D60]/80 font-medium block">
            Siap dinegosiasikan via Direct Chat
          </span>
        </div>

        {/* Orders Count */}
        <div className="p-5 bg-white rounded-xl border border-neutral-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span className="font-medium">Total Pesanan Selesai</span>
            <ShoppingBag className="w-4 h-4 text-neutral-600" />
          </div>
          <p className="text-2xl font-extrabold text-neutral-900 tabular-nums">
            {totalOrdersCount} Pesanan
          </p>
          <span className="text-xs text-neutral-500 block">
            Rata-rata keranjang: Rp 455.000 / transaksi
          </span>
        </div>

        {/* Active Buyers */}
        <div className="p-5 bg-white rounded-xl border border-neutral-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span className="font-medium">Tingkat Pembeli Ulang</span>
            <Users className="w-4 h-4 text-neutral-600" />
          </div>
          <p className="text-2xl font-extrabold text-neutral-900 tabular-nums">
            34.2%
          </p>
          <span className="text-xs text-emerald-600 font-semibold block">
            Reputasi Ulasan Terverifikasi Kuat
          </span>
        </div>

      </div>

      {/* Hourly Sales Trend */}
      <div className="p-6 bg-white rounded-xl border border-neutral-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#522D60]" />
              <span>Pola Transaksi Harian (Jam Belanja Paling Ramai)</span>
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Distribusi penjualan per jam untuk optimasi jadwal broadcast konten Instagram & live TikTok.
            </p>
          </div>
          <span className="text-xs font-semibold text-[#522D60] bg-purple-50 px-2.5 py-1 rounded-md">
            Puncak: 19:00 - 21:00 WIB
          </span>
        </div>

        {/* Bar visualizer */}
        <div className="grid grid-cols-7 gap-2 pt-4 items-end h-44 border-b border-neutral-200 pb-2">
          {HOURLY_SALES_TREND.map(slot => {
            const maxSale = 3500000;
            const heightPercent = Math.min(100, Math.max(15, (slot.sales / maxSale) * 100));
            return (
              <div key={slot.time} className="flex flex-col items-center gap-2 h-full justify-end group">
                <span className="text-[10px] text-neutral-500 opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
                  Rp {(slot.sales / 1000).toFixed(0)}k
                </span>
                <div
                  style={{ height: `${heightPercent}%` }}
                  className="w-full max-w-12 bg-neutral-200 group-hover:bg-[#522D60] rounded-t-md transition-all duration-300 relative"
                />
                <span className="text-xs font-medium text-neutral-600">
                  {slot.time}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two columns: Demographics & Size Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* City Demographics */}
        <div className="p-6 bg-white rounded-xl border border-neutral-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#522D60]" />
              <span>Demografi Kota Asal Pembeli Terbesar</span>
            </h3>
            <span className="text-xs text-neutral-400">Pulau Jawa & Bali Dominan</span>
          </div>

          <div className="space-y-3.5">
            {DEMOGRAPHIC_DATA.map(d => (
              <div key={d.city} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-neutral-800">{d.city}</span>
                  <span className="font-bold text-neutral-900 tabular-nums">
                    {d.percentage}% (Rp {(d.revenue / 1000000).toFixed(1)} Juta)
                  </span>
                </div>
                <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${d.percentage}%` }}
                    className="h-full bg-[#522D60] rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Size Popularity Trends */}
        <div className="p-6 bg-white rounded-xl border border-neutral-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#522D60]" />
              <span>Tren & Preferensi Ukuran Paling Laris</span>
            </h3>
            <span className="text-xs text-neutral-400">Untuk Alokasi Produksi Jahit</span>
          </div>

          <div className="space-y-3.5">
            {SIZE_TRENDS.map(s => (
              <div key={s.size} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-neutral-800">{s.size}</span>
                  <span className="font-bold text-neutral-900 tabular-nums">
                    {s.percentage}% ({s.count} pcs)
                  </span>
                </div>
                <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${s.percentage}%` }}
                    className="h-full bg-purple-600 rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-purple-50 rounded-lg text-xs text-[#522D60] space-y-1">
            <span className="font-semibold block">Rekomendasi Pemotongan Bahan:</span>
            <p className="text-neutral-600 text-[11px]">
              Alokasikan 70% bahan kain untuk Size M dan L agar rasio inventory turnover Anda tetap optimal tanpa penumpukan dead stock.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
};
