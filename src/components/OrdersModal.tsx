import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Package, Truck, CheckCircle2, Copy, Check,
  MessageSquare, Star, Clock, MapPin, XCircle
} from 'lucide-react';
import { Order, ChatProductContext } from '../types';
import { copyTextToClipboard } from '../utils/marketplaceSocial';
import { useConfirm } from './ConfirmDialogContext';
import {
  AROOS_BACKDROP_TRANSITION,
  AROOS_MODAL_TRANSITION,
  AROOS_MODAL_VARIANTS,
} from '../utils/motionPresets';

interface OrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  onConfirmReceived: (orderId: string) => Promise<void> | void;
  onCancelOrder?: (orderId: string, reason?: string) => Promise<void> | void;
  onOpenChat?: (brandName: string, productContext?: ChatProductContext) => void;
  onReviewProduct?: (productId: string) => void;
  reviewedOrderItemKeys?: string[];
}

export const OrdersModal: React.FC<OrdersModalProps> = ({
  isOpen,
  onClose,
  orders,
  onConfirmReceived,
  onCancelOrder,
  onOpenChat,
  onReviewProduct,
  reviewedOrderItemKeys = [],
}) => {
  const confirm = useConfirm();
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');
  const [copiedResiId, setCopiedResiId] = useState<string | null>(null);
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleConfirmOrder = async (order: Order) => {
    setActionError(null);
    const ok = await confirm({
      title: 'Selesaikan Deal',
      message: `Konfirmasi barang untuk deal #${order.orderNumber} sudah Anda terima dengan baik?`,
      confirmLabel: 'Sudah Diterima',
    });
    if (!ok) return;
    setConfirmingOrderId(order.id);
    try {
      await onConfirmReceived(order.id);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Gagal memperbarui status pesanan di server.'
      );
    } finally {
      setConfirmingOrderId(null);
    }
  };

  const handleCancelOrderClick = async (order: Order) => {
    if (!onCancelOrder) return;
    setActionError(null);
    const ok = await confirm({
      title: 'Batalkan Deal / Pesanan',
      message: `Batalkan pesanan #${order.orderNumber}? Stok barang akan dikembalikan ke penjual secara otomatis.`,
      confirmLabel: 'Ya, Batalkan',
      tone: 'danger',
    });
    if (!ok) return;
    setCancellingOrderId(order.id);
    try {
      await onCancelOrder(order.id, 'Dibatalkan oleh pembeli');
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Gagal membatalkan pesanan di server.'
      );
    } finally {
      setCancellingOrderId(null);
    }
  };

  const filteredOrders = orders.filter((order) => {
    if (filter === 'active') return order.orderStatus !== 'selesai' && order.orderStatus !== 'dibatalkan';
    if (filter === 'completed') return order.orderStatus === 'selesai';
    if (filter === 'cancelled') return order.orderStatus === 'dibatalkan';
    return true;
  });

  const handleCopyResi = async (orderId: string, tracking: string) => {
    const copied = await copyTextToClipboard(tracking);
    if (!copied) return;
    setCopiedResiId(orderId);
    setTimeout(() => setCopiedResiId(null), 1800);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="orders-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={AROOS_BACKDROP_TRANSITION}
          className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-6"
          onClick={onClose}
        >
          <motion.div
            key="orders-modal"
            variants={AROOS_MODAL_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={AROOS_MODAL_TRANSITION}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-neutral-200 max-h-[92dvh] sm:max-h-[88vh] flex flex-col overflow-hidden"
          >
          {/* Header */}
          <div className="px-5 sm:px-6 py-4 border-b border-neutral-100 flex items-center justify-between shrink-0 bg-white">
            <div>
              <h2 className="text-base font-bold text-neutral-900">
                Pesanan &amp; Deal Saya
              </h2>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Pantau pengiriman, nomor resi &amp; konfirmasi penerimaan barang
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 rounded-full transition-colors cursor-pointer"
              aria-label="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="px-4 sm:px-6 py-2.5 bg-neutral-50/70 border-b border-neutral-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            {[
              { id: 'all', label: `Semua (${orders.length})` },
              {
                id: 'active',
                label: `Berlangsung (${orders.filter((o) => o.orderStatus !== 'selesai' && o.orderStatus !== 'dibatalkan').length})`,
              },
              { id: 'completed', label: `Selesai (${orders.filter((o) => o.orderStatus === 'selesai').length})` },
              { id: 'cancelled', label: `Dibatalkan (${orders.filter((o) => o.orderStatus === 'dibatalkan').length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id as typeof filter)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  filter === tab.id
                    ? 'bg-neutral-900 text-white'
                    : 'bg-white text-neutral-600 hover:text-neutral-900 border border-neutral-200/80'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Order Cards List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-[#fafafa]">
            {actionError && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs font-medium text-red-700">
                {actionError}
              </div>
            )}
            {filteredOrders.length === 0 ? (
              <div className="p-10 text-center bg-white rounded-2xl border border-neutral-200/80 space-y-2">
                <Package className="w-9 h-9 text-neutral-300 mx-auto" />
                <p className="text-sm font-semibold text-neutral-800">Belum ada deal tercatat</p>
                <p className="text-xs text-neutral-500">
                  Deal produk dan penawaran harga yang disepakati via chat akan muncul di sini.
                </p>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const stepIdx = order.orderStatus === 'selesai' ? 2 : order.orderStatus === 'dikirim' ? 1 : 0;
                const firstItem = order.items[0];
                const paymentLabel =
                  order.paymentMethod === 'cod'
                    ? 'COD / Ketemuan'
                    : order.paymentMethod === 'transfer_langsung'
                    ? 'Transfer Langsung'
                    : order.paymentMethod === 'chat_direct'
                    ? 'Deal via Chat'
                    : String(order.paymentMethod).replace('_', ' ').toUpperCase();

                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-2xl border border-neutral-200/90 p-4 sm:p-5 space-y-4 shadow-2xs"
                  >
                    {/* Top Row: Order Number & Status */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-neutral-100">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-neutral-900">
                            #{order.orderNumber}
                          </span>
                          {order.negotiatedFromOffer && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700">
                              Harga Deal
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-400">{order.createdAt}</p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                            order.orderStatus === 'selesai'
                              ? 'bg-emerald-50 text-emerald-700'
                              : order.orderStatus === 'dibatalkan'
                              ? 'bg-rose-50 text-rose-700'
                              : order.orderStatus === 'dikirim'
                              ? 'bg-sky-50 text-sky-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {order.orderStatus === 'selesai' && <CheckCircle2 className="w-3 h-3" />}
                          {order.orderStatus === 'dibatalkan' && <XCircle className="w-3 h-3" />}
                          {order.orderStatus === 'dikirim' && <Truck className="w-3 h-3" />}
                          {(order.orderStatus === 'diproses' || order.orderStatus === 'menunggu_pembayaran') && (
                            <Clock className="w-3 h-3" />
                          )}
                          <span>
                            {order.orderStatus === 'selesai'
                              ? 'Selesai'
                              : order.orderStatus === 'dibatalkan'
                              ? 'Dibatalkan'
                              : order.orderStatus === 'dikirim'
                              ? 'Dikirim'
                              : 'Diproses Penjual'}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Stepper or Cancelled Banner */}
                    {order.orderStatus === 'dibatalkan' ? (
                      <div className="px-3 py-2 rounded-xl bg-rose-50/70 border border-rose-200/70 text-[11px] text-rose-700 flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {order.cancelledReason ||
                            (order.cancelledBy === 'seller'
                              ? 'Pesanan dibatalkan oleh penjual'
                              : 'Pesanan dibatalkan oleh pembeli')}
                        </span>
                        <span className="text-[10px] text-rose-500 font-semibold shrink-0">
                          Stok Dikembalikan
                        </span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 text-[11px]">
                        {['Diproses', 'Dikirim', 'Diterima'].map((label, idx) => {
                          const active = idx <= stepIdx;
                          return (
                            <div key={label} className="space-y-1.5">
                              <div
                                className={`h-1 rounded-full transition-colors ${
                                  active ? 'bg-neutral-900' : 'bg-neutral-200'
                                }`}
                              />
                              <span
                                className={`block font-medium ${
                                  active ? 'text-neutral-900' : 'text-neutral-400'
                                }`}
                              >
                                {label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Items */}
                    <div className="space-y-2.5">
                      {order.items.map((item, idx) => (
                        <div key={`${item.productId}-${idx}`} className="flex items-center gap-3">
                          <img
                            src={item.image}
                            alt={item.productName}
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.style.opacity = '0.25';
                            }}
                            className="w-14 h-14 rounded-xl object-cover bg-neutral-100 border border-neutral-200/80 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                              {item.brand}
                            </p>
                            <p className="text-xs font-semibold text-neutral-900 truncate">
                              {item.productName}
                            </p>
                            <p className="text-[11px] text-neutral-500">
                              {item.quantity}x · {item.size} · {item.color}
                            </p>
                          </div>
                          <span className="text-xs font-bold text-neutral-900 tabular-nums shrink-0">
                            Rp {(item.price * item.quantity).toLocaleString('id-ID')}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Shipping & Deal Info */}
                    <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/70 space-y-2 text-[11px]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-neutral-500 flex items-center gap-1.5 min-w-0">
                          <Truck className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <span className="truncate">{order.courier}</span>
                        </span>
                        {order.trackingNumber ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="font-mono font-semibold text-neutral-800">
                              {order.trackingNumber}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyResi(order.id, order.trackingNumber)}
                              className="p-1 text-neutral-400 hover:text-neutral-800 rounded cursor-pointer"
                              title="Salin nomor resi"
                              aria-label="Salin nomor resi"
                            >
                              {copiedResiId === order.id ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-neutral-400 italic">Menunggu resi penjual</span>
                        )}
                      </div>

                      <div className="flex items-start justify-between gap-2 text-neutral-500">
                        <span className="flex items-start gap-1.5 min-w-0">
                          <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
                          <span className="break-words min-w-0">{order.customerAddress}, {order.customerCity}</span>
                        </span>
                      </div>

                      <div className="pt-2 border-t border-neutral-200/70 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-neutral-600 font-medium">
                          Metode: <strong className="text-neutral-800">{paymentLabel}</strong>
                        </span>
                        <span className="font-bold text-neutral-900 tabular-nums shrink-0">
                          Total: Rp {order.totalAmount.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {onOpenChat && firstItem && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenChat(firstItem.brand, {
                                id: firstItem.productId,
                                name: firstItem.productName,
                                price: firstItem.price,
                                image: firstItem.image,
                                brand: firstItem.brand,
                              });
                            }}
                            className="w-full sm:w-auto justify-center px-3 py-2 sm:py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Chat Penjual</span>
                          </button>
                        )}
                        {onCancelOrder &&
                          (order.orderStatus === 'diproses' ||
                            order.orderStatus === 'menunggu_pembayaran') && (
                            <button
                              type="button"
                              disabled={cancellingOrderId === order.id}
                              onClick={() => handleCancelOrderClick(order)}
                              className="w-full sm:w-auto justify-center px-3 py-2 sm:py-1.5 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>
                                {cancellingOrderId === order.id ? 'Membatalkan...' : 'Batalkan'}
                              </span>
                            </button>
                          )}
                      </div>

                      {order.orderStatus === 'dibatalkan' ? null : order.orderStatus !== 'selesai' ? (
                        <button
                          type="button"
                          disabled={confirmingOrderId === order.id}
                          onClick={() => handleConfirmOrder(order)}
                          className="w-full sm:w-auto justify-center px-4 py-2.5 sm:py-2 bg-neutral-900 hover:bg-black disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>
                            {confirmingOrderId === order.id
                              ? 'Menyimpan...'
                              : 'Konfirmasi Barang Diterima'}
                          </span>
                        </button>
                      ) : (
                        onReviewProduct &&
                        order.items.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2 justify-end">
                            {order.items.map((item, itemIdx) => {
                              const isItemReviewed = reviewedOrderItemKeys.includes(
                                `${order.id}__${item.productId}`
                              );
                              if (isItemReviewed) {
                                return (
                                  <span
                                    key={`${item.productId}-${itemIdx}`}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 sm:py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/70 rounded-xl text-xs font-semibold"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>
                                      {order.items.length > 1
                                        ? `${item.productName.slice(0, 18)} · Sudah Diulas`
                                        : 'Sudah Diulas'}
                                    </span>
                                  </span>
                                );
                              }
                              return (
                                <button
                                  key={`${item.productId}-${itemIdx}`}
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    onReviewProduct(item.productId);
                                  }}
                                  className="w-full sm:w-auto justify-center px-4 py-2.5 sm:py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                                >
                                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                                  <span>
                                    {order.items.length > 1
                                      ? `Ulas ${item.productName.slice(0, 18)}`
                                      : 'Beri Ulasan'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
