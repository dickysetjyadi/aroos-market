import React, { useMemo, useState } from 'react';
import {
  Package, Truck, CheckCircle2, Clock, MapPin, Phone,
  MessageSquare, FilePlus2, ListOrdered, AlertCircle
} from 'lucide-react';
import {
  ChatConversation,
  Order,
  OrderStatus,
  PaymentMethod,
  Product,
} from '../../types';
import { NON_COD_PAYMENT_OPTIONS } from '../../data/indonesianCouriers';
import { CourierSearchSelect } from '../CourierSearchSelect';
import { useConfirm } from '../ConfirmDialogContext';

interface SellerOrdersPanelProps {
  orders: Order[];
  products?: Product[];
  conversations?: ChatConversation[];
  sellerBrandName?: string;
  sellerBrandCity?: string;
  sellerId?: string;
  onUpdateOrder: (
    orderId: string,
    newStatus: OrderStatus,
    trackingNumber?: string,
    courier?: string
  ) => void;
  onCreateManualOrder?: (payload: {
    productId: string;
    productName: string;
    productImage: string;
    productPrice: number;
    quantity: number;
    size: string;
    color: string;
    buyerId?: string;
    buyerName: string;
    buyerPhone: string;
    buyerCity: string;
    buyerAddress: string;
    courier: string;
    trackingNumber: string;
    shippingFee: number;
    paymentMethod: Exclude<PaymentMethod, 'cod' | 'chat_direct'>;
    paymentStatus: 'paid' | 'pending';
  }) => Promise<string | void>;
  triggerToast: (
    title: string,
    message: string,
    type: 'order' | 'low_stock' | 'social_sync' | 'system'
  ) => void;
}

const formatPaymentMethod = (method: PaymentMethod): string => {
  switch (method) {
    case 'cod':
      return 'COD / Ketemuan';
    case 'transfer_langsung':
      return 'Transfer Langsung';
    case 'chat_direct':
      return 'Deal via Chat';
    case 'qris':
      return 'QRIS';
    case 'bca_va':
      return 'BCA Virtual Account';
    case 'mandiri_va':
      return 'Mandiri Virtual Account';
    case 'bri_va':
      return 'BRI Virtual Account';
    case 'bni_va':
      return 'BNI Virtual Account';
    case 'gopay':
      return 'GoPay';
    case 'ovo':
      return 'OVO';
    case 'dana':
      return 'DANA';
    case 'shopeepay':
      return 'ShopeePay';
    default:
      return String(method).replace('_', ' ').toUpperCase();
  }
};

export const SellerOrdersPanel: React.FC<SellerOrdersPanelProps> = ({
  orders,
  products = [],
  conversations = [],
  onUpdateOrder,
  onCreateManualOrder,
  triggerToast,
}) => {
  const confirm = useConfirm();
  const [panelTab, setPanelTab] = useState<'list' | 'input'>('list');
  const [filterStatus, setFilterStatus] = useState<'all' | 'diproses' | 'dikirim' | 'selesai'>('all');
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({});

  // Input Pesanan (Non-COD) states
  const [inputMode, setInputMode] = useState<'new_order' | 'existing_order'>('new_order');
  const [selectedExistingOrderId, setSelectedExistingOrderId] = useState<string>('');
  const [existingCourier, setExistingCourier] = useState<string>('');
  const [existingResi, setExistingResi] = useState<string>('');

  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [customProductName, setCustomProductName] = useState<string>('');
  const [customPrice, setCustomPrice] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [buyerName, setBuyerName] = useState<string>('');
  const [buyerId, setBuyerId] = useState<string>('');
  const [buyerPhone, setBuyerPhone] = useState<string>('');
  const [buyerCity, setBuyerCity] = useState<string>('');
  const [buyerAddress, setBuyerAddress] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<Exclude<PaymentMethod, 'cod' | 'chat_direct'>>('transfer_langsung');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'pending'>('paid');
  const [shippingFee, setShippingFee] = useState<string>('0');
  const [manualCourier, setManualCourier] = useState<string>('');
  const [manualResi, setManualResi] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [isSavingManual, setIsSavingManual] = useState<boolean>(false);

  const activeDealsCount = orders.filter((o) => o.orderStatus !== 'selesai').length;
  const needActionCount = orders.filter((o) => o.orderStatus === 'diproses').length;
  const completedDealsCount = orders.filter((o) => o.orderStatus === 'selesai').length;

  const filteredOrders = orders.filter((o) => {
    if (filterStatus === 'all') return true;
    return o.orderStatus === filterStatus;
  });

  // Eligible existing orders: Non-COD & currently diproses
  const eligibleNonCodOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.orderStatus === 'diproses' &&
          o.paymentMethod !== 'cod' &&
          !o.courier.toLowerCase().includes('cod')
      ),
    [orders]
  );

  // Recent chat buyers to optionally pre-fill buyer fields cleanly
  const chatBuyerOptions = useMemo(() => {
    const seen = new Set<string>();
    const list: { key: string; buyerId?: string; buyerName: string; productName: string; productId: string }[] = [];
    conversations.forEach((c) => {
      if (!c.buyerName) return;
      const k = c.buyerId || c.buyerName.toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      list.push({
        key: k,
        buyerId: c.buyerId,
        buyerName: c.buyerName,
        productName: c.product?.name || '',
        productId: c.product?.id || '',
      });
    });
    return list;
  }, [conversations]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) || null,
    [products, selectedProductId]
  );

  const handleShipOrder = async (order: Order) => {
    const resi = (trackingInputs[order.id] ?? order.trackingNumber).trim();
    if (!resi) {
      triggerToast('Resi Kosong', 'Masukkan nomor resi pengiriman terlebih dahulu.', 'system');
      return;
    }
    const ok = await confirm({
      title: 'Kirim Pesanan',
      message: `Input resi ${resi} untuk deal #${order.orderNumber}?`,
      confirmLabel: 'Kirim',
    });
    if (!ok) return;

    onUpdateOrder(order.id, 'dikirim', resi);
  };

  const handleAssignExistingOrderResi = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const target = eligibleNonCodOrders.find((o) => o.id === selectedExistingOrderId);
    if (!target) {
      setFormError('Pilih pesanan non-COD yang ingin diinput resinya.');
      return;
    }
    if (!existingCourier.trim()) {
      setFormError('Pilih ekspedisi pengiriman terlebih dahulu.');
      return;
    }
    if (!existingResi.trim()) {
      setFormError('Nomor resi wajib diisi.');
      return;
    }

    const ok = await confirm({
      title: 'Simpan Resi & Kirim Pesanan',
      message: `Update ekspedisi ${existingCourier} dengan resi ${existingResi.trim()} untuk pesanan #${target.orderNumber}?`,
      confirmLabel: 'Simpan & Kirim',
    });
    if (!ok) return;

    onUpdateOrder(target.id, 'dikirim', existingResi.trim(), existingCourier.trim());
    setSelectedExistingOrderId('');
    setExistingCourier('');
    setExistingResi('');
    setPanelTab('list');
  };

  const handleCreateNewManualOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!onCreateManualOrder) return;

    const effectiveName = (selectedProduct?.name || customProductName).trim();
    const effectivePrice = selectedProduct
      ? selectedProduct.price
      : Math.max(0, Number(customPrice) || 0);

    if (!effectiveName) {
      setFormError('Pilih barang dari listing Anda atau isi nama barang secara manual.');
      return;
    }
    if (effectivePrice <= 0) {
      setFormError('Harga barang harus lebih dari Rp 0.');
      return;
    }
    if (!buyerName.trim() || !buyerPhone.trim() || !buyerCity.trim() || !buyerAddress.trim()) {
      setFormError('Lengkapi nama pembeli, nomor HP, kota, dan alamat pengiriman.');
      return;
    }
    if (!manualCourier.trim()) {
      setFormError('Pilih ekspedisi pengiriman dari dropdown.');
      return;
    }
    if (manualCourier.toLowerCase().includes('cod')) {
      setFormError('Metode COD tidak diperbolehkan pada form Input Pesanan ini.');
      return;
    }
    if (!manualResi.trim()) {
      setFormError('Masukkan nomor resi manual.');
      return;
    }

    const ok = await confirm({
      title: 'Simpan Pesanan & Resi Manual',
      message: `Buat pesanan ${effectiveName} via ${manualCourier} (Resi: ${manualResi.trim()}) untuk ${buyerName.trim()}?`,
      confirmLabel: 'Simpan Pesanan',
    });
    if (!ok) return;

    setIsSavingManual(true);
    try {
      await onCreateManualOrder({
        productId: selectedProduct?.id || `manual-${Date.now().toString(36)}`,
        productName: effectiveName,
        productImage: selectedProduct?.image || '',
        productPrice: effectivePrice,
        quantity: Math.max(1, Number(quantity) || 1),
        size: selectedProduct?.sizes?.[0] || 'Standar',
        color: selectedProduct?.colors?.[0] || 'Default',
        buyerId: buyerId.trim() || undefined,
        buyerName: buyerName.trim(),
        buyerPhone: buyerPhone.trim(),
        buyerCity: buyerCity.trim(),
        buyerAddress: buyerAddress.trim(),
        courier: manualCourier.trim(),
        trackingNumber: manualResi.trim(),
        shippingFee: Math.max(0, Number(shippingFee) || 0),
        paymentMethod,
        paymentStatus,
      });

      setSelectedProductId('');
      setCustomProductName('');
      setCustomPrice('');
      setQuantity(1);
      setBuyerId('');
      setBuyerName('');
      setBuyerPhone('');
      setBuyerCity('');
      setBuyerAddress('');
      setShippingFee('0');
      setManualCourier('');
      setManualResi('');
      setPanelTab('list');
    } finally {
      setIsSavingManual(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Deal Summary */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-white rounded-2xl border border-neutral-200/80 p-3 sm:p-5 space-y-1 sm:space-y-2">
          <div className="flex items-center justify-between gap-1 text-[11px] sm:text-xs text-neutral-500">
            <span className="font-medium truncate">Deal Aktif</span>
            <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-400 shrink-0" />
          </div>
          <p className="text-base sm:text-2xl font-bold text-neutral-900 tabular-nums leading-tight">
            {activeDealsCount} <span className="text-[11px] sm:text-sm font-semibold text-neutral-500">Deal</span>
          </p>
          <p className="hidden sm:block text-[11px] text-neutral-400">
            Kesepakatan COD, transfer, dan resi manual
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200/80 p-3 sm:p-5 space-y-1 sm:space-y-2">
          <div className="flex items-center justify-between gap-1 text-[11px] sm:text-xs text-neutral-500">
            <span className="font-medium truncate">Perlu Resi</span>
            <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 shrink-0" />
          </div>
          <p className="text-base sm:text-2xl font-bold text-neutral-900 tabular-nums leading-tight">
            {needActionCount} <span className="text-[11px] sm:text-sm font-semibold text-neutral-500">Order</span>
          </p>
          <p className="hidden sm:block text-[11px] text-neutral-400">
            Input nomor resi agar status terupdate ke pembeli
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200/80 p-3 sm:p-5 space-y-1 sm:space-y-2">
          <div className="flex items-center justify-between gap-1 text-[11px] sm:text-xs text-neutral-500">
            <span className="font-medium truncate">Selesai</span>
            <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
          </div>
          <p className="text-base sm:text-2xl font-bold text-emerald-700 tabular-nums leading-tight">
            {completedDealsCount} <span className="text-[11px] sm:text-sm font-semibold text-emerald-600">Deal</span>
          </p>
          <p className="hidden sm:block text-[11px] text-neutral-400">
            Transaksi yang telah dikonfirmasi diterima pembeli
          </p>
        </div>
      </div>

      {/* Main Switcher: Daftar Pesanan | Input Pesanan (Non-COD) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-neutral-100 rounded-2xl border border-neutral-200/70">
          <button
            type="button"
            onClick={() => setPanelTab('list')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              panelTab === 'list'
                ? 'bg-neutral-900 text-white shadow-2xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5 shrink-0" />
            <span className="tabular-nums">Daftar Pesanan ({orders.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setPanelTab('input');
              setFormError('');
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              panelTab === 'input'
                ? 'bg-neutral-900 text-white shadow-2xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <FilePlus2 className="w-3.5 h-3.5 shrink-0" />
            <span>Input Pesanan (Non-COD)</span>
          </button>
        </div>

        {panelTab === 'list' && (
          <div className="flex items-center gap-1.5 p-1 bg-neutral-100 rounded-2xl border border-neutral-200/60 overflow-x-auto max-w-full no-scrollbar">
            {[
              { id: 'all', label: `Semua (${orders.length})` },
              { id: 'diproses', label: `Perlu Diproses (${orders.filter((o) => o.orderStatus === 'diproses').length})` },
              { id: 'dikirim', label: `Dikirim (${orders.filter((o) => o.orderStatus === 'dikirim').length})` },
              { id: 'selesai', label: `Selesai (${orders.filter((o) => o.orderStatus === 'selesai').length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterStatus(tab.id as typeof filterStatus)}
                className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
                  filterStatus === tab.id
                    ? 'bg-white text-neutral-900 shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tab 1: Orders List */}
      {panelTab === 'list' && (
        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-3xl border border-neutral-200/80 p-12 text-center space-y-2.5">
              <Package className="w-9 h-9 text-neutral-300 mx-auto" />
              <p className="text-sm font-semibold text-neutral-800">Tidak ada deal di tab ini</p>
              <p className="text-xs text-neutral-500 max-w-md mx-auto">
                Deal dari obrolan chat atau pesanan manual non-COD yang Anda catat akan muncul di sini.
              </p>
              <button
                type="button"
                onClick={() => setPanelTab('input')}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-full cursor-pointer"
              >
                <FilePlus2 className="w-3.5 h-3.5" />
                <span>Input Pesanan / Resi Manual</span>
              </button>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const resiVal = trackingInputs[order.id] ?? order.trackingNumber;
              const isCompleted = order.orderStatus === 'selesai';

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl border border-neutral-200/80 p-4 sm:p-5 space-y-4 shadow-2xs"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-neutral-100">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-neutral-900">
                          #{order.orderNumber}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                            order.orderStatus === 'selesai'
                              ? 'text-emerald-700'
                              : order.orderStatus === 'dikirim'
                              ? 'text-sky-700'
                              : 'text-amber-700'
                          }`}
                        >
                          <span aria-hidden="true">·</span>
                          {order.orderStatus === 'selesai' && <CheckCircle2 className="w-3 h-3" />}
                          {order.orderStatus === 'dikirim' && <Truck className="w-3 h-3" />}
                          {order.orderStatus === 'diproses' && <Clock className="w-3 h-3" />}
                          <span>
                            {order.orderStatus === 'selesai'
                              ? 'Selesai'
                              : order.orderStatus === 'dikirim'
                              ? 'Dalam Pengiriman'
                              : 'Perlu Diproses'}
                          </span>
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400">
                        {order.createdAt} · {formatPaymentMethod(order.paymentMethod)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-bold text-neutral-900 tabular-nums">
                        Rp {order.totalAmount.toLocaleString('id-ID')}
                      </p>
                      <p className={`text-[10px] font-semibold ${isCompleted ? 'text-emerald-600' : 'text-neutral-500'}`}>
                        {isCompleted ? 'Barang telah diterima' : 'Transaksi langsung AROOS'}
                      </p>
                    </div>
                  </div>

                  {/* Buyer & Items */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <div className="lg:col-span-7 space-y-2.5">
                      {order.items.map((item, idx) => (
                        <div key={`${item.productId}-${idx}`} className="flex items-center gap-3">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.productName}
                              loading="lazy"
                              decoding="async"
                              referrerPolicy="no-referrer"
                              className="w-12 h-12 rounded-xl object-cover bg-neutral-100 border border-neutral-200/80 shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-neutral-100 border border-neutral-200/80 flex items-center justify-center shrink-0">
                              <Package className="w-5 h-5 text-neutral-400" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-neutral-900 truncate">
                              {item.productName}
                            </p>
                            <p className="text-[11px] text-neutral-500 tabular-nums">
                              {item.quantity}x · {item.size} · {item.color}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="lg:col-span-5 p-3 bg-neutral-50 rounded-xl border border-neutral-200/70 space-y-1.5 text-[11px] min-w-0">
                      <p className="font-semibold text-neutral-900 truncate">{order.customerName}</p>
                      <p className="text-neutral-500 flex items-center gap-1.5">
                        <Phone className="w-3 h-3 shrink-0" />
                        <span className="break-all">{order.customerPhone}</span>
                      </p>
                      <p className="text-neutral-500 flex items-start gap-1.5 min-w-0">
                        <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                        <span className="break-words min-w-0">{order.customerAddress}, {order.customerCity}</span>
                      </p>
                      <p className="text-neutral-700 font-medium pt-0.5">
                        Kurir / Pengiriman: {order.courier}
                      </p>
                    </div>
                  </div>

                  {/* Fulfillment Control */}
                  <div className="pt-2 border-t border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
                    {order.orderStatus === 'diproses' ? (
                      <>
                        <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 min-w-0">
                          <label className="text-[11px] font-semibold text-neutral-600 shrink-0">
                            No. Resi:
                          </label>
                          <input
                            type="text"
                            value={resiVal}
                            onChange={(e) =>
                              setTrackingInputs((prev) => ({ ...prev, [order.id]: e.target.value }))
                            }
                            placeholder="Masukkan nomor resi pengiriman..."
                            className="w-full sm:max-w-xs px-3 py-2 sm:py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-mono text-neutral-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleShipOrder(order)}
                          className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-all active:scale-95 cursor-pointer inline-flex items-center justify-center gap-1.5 shrink-0"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>Input Resi &amp; Kirim Paket</span>
                        </button>
                      </>
                    ) : order.orderStatus === 'dikirim' ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 w-full text-xs">
                        <span className="text-neutral-600">
                          Resi Pengiriman: <strong className="font-mono text-neutral-900">{order.trackingNumber}</strong>
                        </span>
                        <span className="text-[11px] text-neutral-500">
                          Menunggu konfirmasi diterima dari pembeli
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2 w-full text-xs">
                        <span className="text-neutral-600">
                          Resi: <strong className="font-mono text-neutral-900">{order.trackingNumber || '-'}</strong>
                        </span>
                        <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Deal selesai · Barang telah diterima pembeli
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: Input Pesanan & Resi Manual (Non-COD Only) */}
      {panelTab === 'input' && (
        <section className="bg-white rounded-3xl border border-neutral-200/80 shadow-xs overflow-hidden">
          <div className="px-5 sm:px-7 py-4 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-neutral-900">
                Input Pesanan &amp; Resi Manual (Non-COD)
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Catat pesanan pengiriman baru atau masukkan resi manual untuk pesanan non-COD menggunakan semua ekspedisi Indonesia.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-1 p-1 bg-neutral-100 rounded-xl border border-neutral-200/70 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setInputMode('new_order');
                  setFormError('');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  inputMode === 'new_order'
                    ? 'bg-white text-neutral-900 shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Pesanan Baru
              </button>
              <button
                type="button"
                onClick={() => {
                  setInputMode('existing_order');
                  setFormError('');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap tabular-nums ${
                  inputMode === 'existing_order'
                    ? 'bg-white text-neutral-900 shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Order Diproses ({eligibleNonCodOrders.length})
              </button>
            </div>
          </div>

          <div className="p-5 sm:p-7 space-y-5">
            {formError && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs font-medium text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {inputMode === 'existing_order' ? (
              eligibleNonCodOrders.length === 0 ? (
                <div className="py-10 px-4 text-center rounded-2xl bg-neutral-50 border border-neutral-200/70 space-y-2.5">
                  <Truck className="w-8 h-8 text-neutral-300 mx-auto" />
                  <p className="text-xs font-semibold text-neutral-800">
                    Tidak ada pesanan Non-COD yang menunggu resi
                  </p>
                  <p className="text-[11px] text-neutral-500 max-w-md mx-auto">
                    Anda tetap dapat mencatat pesanan baru beserta nomor resinya pada mode &ldquo;Pesanan Baru&rdquo;.
                  </p>
                  <button
                    type="button"
                    onClick={() => setInputMode('new_order')}
                    className="px-4 py-2 bg-neutral-900 text-white text-xs font-semibold rounded-full hover:bg-black cursor-pointer"
                  >
                    Catat Pesanan Baru
                  </button>
                </div>
              ) : (
                <form onSubmit={handleAssignExistingOrderResi} className="space-y-4 max-w-2xl text-xs">
                  <div>
                    <label className="font-semibold text-neutral-700 block mb-1.5">
                      Pilih Pesanan Non-COD <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={selectedExistingOrderId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setSelectedExistingOrderId(id);
                        const found = eligibleNonCodOrders.find((o) => o.id === id);
                        if (found) {
                          setExistingCourier(found.courier || '');
                          setExistingResi(found.trackingNumber || '');
                        }
                      }}
                      className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-medium focus:bg-white focus:outline-none"
                    >
                      <option value="">-- Pilih Nomor Pesanan --</option>
                      {eligibleNonCodOrders.map((ord) => (
                        <option key={ord.id} value={ord.id}>
                          #{ord.orderNumber} · {ord.customerName} · Rp {ord.totalAmount.toLocaleString('id-ID')} ({formatPaymentMethod(ord.paymentMethod)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-semibold text-neutral-700 block mb-1.5">
                        Ekspedisi Indonesia <span className="text-red-500">*</span>
                      </label>
                      <CourierSearchSelect
                        value={existingCourier}
                        onChange={setExistingCourier}
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-neutral-700 block mb-1.5">
                        Nomor Resi Manual <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={existingResi}
                        onChange={(e) => setExistingResi(e.target.value)}
                        placeholder="Contoh: JP8829104421"
                        className="w-full min-h-[40px] px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-mono text-xs text-neutral-900 focus:bg-white focus:outline-none focus:border-neutral-900"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-xl cursor-pointer transition-all active:scale-95"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>Simpan Resi &amp; Tandai Dikirim</span>
                    </button>
                  </div>
                </form>
              )
            ) : (
              <form onSubmit={handleCreateNewManualOrder} className="space-y-5 text-xs">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Left: Barang & Pembayaran Non-COD */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-neutral-900 border-b border-neutral-100 pb-2">
                      1. Detail Barang &amp; Pembayaran Non-COD
                    </h4>

                    <div>
                      <label className="font-semibold text-neutral-700 block mb-1">
                        Pilih dari Listing Anda (Opsional)
                      </label>
                      <select
                        value={selectedProductId}
                        onChange={(e) => {
                          const pid = e.target.value;
                          setSelectedProductId(pid);
                          const prod = products.find((p) => p.id === pid);
                          if (prod) {
                            setCustomProductName(prod.name);
                            setCustomPrice(String(prod.price));
                          }
                        }}
                        className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-medium focus:bg-white focus:outline-none"
                      >
                        <option value="">-- Input Barang Manual / Pilih Listing --</option>
                        {products.map((prod) => (
                          <option key={prod.id} value={prod.id}>
                            {prod.name} (Rp {prod.price.toLocaleString('id-ID')})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="font-semibold text-neutral-700 block mb-1">
                          Nama Barang <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={selectedProduct ? selectedProduct.name : customProductName}
                          onChange={(e) => {
                            if (selectedProductId) setSelectedProductId('');
                            setCustomProductName(e.target.value);
                          }}
                          placeholder="Contoh: Jaket Denim Vintage Selvedge"
                          className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:bg-white focus:outline-none focus:border-neutral-900"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-neutral-700 block mb-1">
                          Jumlah <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          required
                          value={quantity}
                          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                          className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 tabular-nums focus:bg-white focus:outline-none focus:border-neutral-900"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-semibold text-neutral-700 block mb-1">
                          Harga Satuan (Rp) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min={1000}
                          required
                          value={selectedProduct ? selectedProduct.price : customPrice}
                          onChange={(e) => {
                            if (selectedProductId) setSelectedProductId('');
                            setCustomPrice(e.target.value);
                          }}
                          placeholder="250000"
                          className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 tabular-nums font-semibold focus:bg-white focus:outline-none focus:border-neutral-900"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-neutral-700 block mb-1">
                          Ongkos Kirim (Rp)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={shippingFee}
                          onChange={(e) => setShippingFee(e.target.value)}
                          placeholder="0"
                          className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 tabular-nums focus:bg-white focus:outline-none focus:border-neutral-900"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-semibold text-neutral-700 block mb-1">
                          Metode Pembayaran (Non-COD) <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={paymentMethod}
                          onChange={(e) =>
                            setPaymentMethod(
                              e.target.value as Exclude<PaymentMethod, 'cod' | 'chat_direct'>
                            )
                          }
                          className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-medium focus:bg-white focus:outline-none"
                        >
                          {NON_COD_PAYMENT_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="font-semibold text-neutral-700 block mb-1">
                          Status Pembayaran
                        </label>
                        <div className="grid grid-cols-2 gap-1 p-1 bg-neutral-100 rounded-xl border border-neutral-200/70">
                          <button
                            type="button"
                            onClick={() => setPaymentStatus('paid')}
                            className={`py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                              paymentStatus === 'paid'
                                ? 'bg-white text-emerald-700 shadow-2xs'
                                : 'text-neutral-600'
                            }`}
                          >
                            Sudah Lunas
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaymentStatus('pending')}
                            className={`py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                              paymentStatus === 'pending'
                                ? 'bg-white text-amber-700 shadow-2xs'
                                : 'text-neutral-600'
                            }`}
                          >
                            Menunggu
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Pembeli, Ekspedisi Indonesia & Resi */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-neutral-100 pb-2 gap-2">
                      <h4 className="text-xs font-bold text-neutral-900">
                        2. Tujuan Pembeli, Ekspedisi &amp; No. Resi
                      </h4>
                      {chatBuyerOptions.length > 0 && (
                        <select
                          value=""
                          onChange={(e) => {
                            const found = chatBuyerOptions.find((c) => c.key === e.target.value);
                            if (found) {
                              setBuyerName(found.buyerName);
                              setBuyerId(found.buyerId || '');
                            }
                          }}
                          className="text-[11px] px-2.5 py-1 bg-neutral-100 border border-neutral-200 rounded-lg text-neutral-700 font-medium max-w-[180px]"
                        >
                          <option value="">Isi dari Chat Pembeli...</option>
                          {chatBuyerOptions.map((opt) => (
                            <option key={opt.key} value={opt.key}>
                              {opt.buyerName} ({opt.productName})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-semibold text-neutral-700 block mb-1">
                          Nama Pembeli <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={buyerName}
                          onChange={(e) => setBuyerName(e.target.value)}
                          placeholder="Nama lengkap penerima"
                          className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:bg-white focus:outline-none focus:border-neutral-900"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-neutral-700 block mb-1">
                          Nomor HP / WhatsApp <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="tel"
                          required
                          value={buyerPhone}
                          onChange={(e) => setBuyerPhone(e.target.value)}
                          placeholder="0812xxxxxxxx"
                          className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 tabular-nums focus:bg-white focus:outline-none focus:border-neutral-900"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="font-semibold text-neutral-700 block mb-1">
                          Kota Tujuan <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={buyerCity}
                          onChange={(e) => setBuyerCity(e.target.value)}
                          placeholder="Contoh: Bandung"
                          className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:bg-white focus:outline-none focus:border-neutral-900"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="font-semibold text-neutral-700 block mb-1">
                          Alamat Lengkap Penerima <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={buyerAddress}
                          onChange={(e) => setBuyerAddress(e.target.value)}
                          placeholder="Jl. Merdeka No. 12, Kecamatan..."
                          className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:bg-white focus:outline-none focus:border-neutral-900"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-semibold text-neutral-700 block mb-1">
                          Ekspedisi Pengiriman <span className="text-red-500">*</span>
                        </label>
                        <CourierSearchSelect
                          value={manualCourier}
                          onChange={setManualCourier}
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-neutral-700 block mb-1">
                          Nomor Resi Manual <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={manualResi}
                          onChange={(e) => setManualResi(e.target.value)}
                          placeholder="Masukkan no. resi ekspedisi"
                          className="w-full min-h-[40px] px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-mono text-xs text-neutral-900 focus:bg-white focus:outline-none focus:border-neutral-900"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[11px] text-neutral-500">
                    Total Pesanan:{' '}
                    <strong className="text-neutral-900 tabular-nums">
                      Rp{' '}
                      {(
                        (selectedProduct ? selectedProduct.price : Number(customPrice) || 0) *
                          Math.max(1, Number(quantity) || 1) +
                        Math.max(0, Number(shippingFee) || 0)
                      ).toLocaleString('id-ID')}
                    </strong>{' '}
                    · Non-COD
                  </p>
                  <button
                    type="submit"
                    disabled={isSavingManual || !onCreateManualOrder}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-neutral-900 hover:bg-black disabled:opacity-50 text-white text-xs font-semibold rounded-xl cursor-pointer transition-all active:scale-95"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>{isSavingManual ? 'Menyimpan...' : 'Simpan Pesanan & Resi'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
      )}
    </div>
  );
};
