import React from 'react';
import { Check } from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '../../data/mockData';
import { SubscriptionPlan } from '../../types';

interface SubscriptionTiersProps {
  currentPlanId: SubscriptionPlan['id'];
  onSelectPlan: (planId: SubscriptionPlan['id']) => void;
}

export const SubscriptionTiers: React.FC<SubscriptionTiersProps> = ({
  currentPlanId,
  onSelectPlan,
}) => {
  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
          Pilihan Paket Langganan Brand Lokal
        </h2>
        <p className="text-xs sm:text-sm text-neutral-500">
          Biaya tetap bulanan yang transparan untuk mendukung pengelolaan penjualan Anda.
        </p>
      </div>

      {/* 3 Tiers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        {SUBSCRIPTION_PLANS.map(plan => {
          const isActive = currentPlanId === plan.id;

          return (
            <div
              key={plan.id}
              className={`relative bg-white rounded-2xl p-6 flex flex-col justify-between border transition-all duration-200 ${
                plan.isPopular
                  ? 'border-neutral-900 shadow-lg ring-1 ring-neutral-900'
                  : 'border-neutral-200 shadow-xs hover:border-neutral-300'
              }`}
            >
              {plan.isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-neutral-900 text-white text-[11px] font-bold px-3 py-0.5 rounded-full shadow-xs">
                  Paling Banyak Dipilih
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-neutral-900">{plan.name}</h3>
                </div>

                {/* Price block */}
                <div className="pt-2 border-t border-neutral-100">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-neutral-900 tabular-nums">
                      Rp {plan.priceMonthly.toLocaleString('id-ID')}
                    </span>
                    <span className="text-xs text-neutral-500">/ bulan</span>
                  </div>
                  <div className="mt-1 text-xs text-emerald-700 font-semibold">
                    <span>Direct Chat &amp; Pencatatan Deal</span>
                  </div>
                  <span className="text-xs text-neutral-600 block mt-1 font-medium">
                    Kapasitas: {plan.productLimitText}
                  </span>
                </div>

                {/* Features List */}
                <ul className="space-y-2.5 pt-4 border-t border-neutral-100 text-xs text-neutral-600">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#522D60] shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Button */}
              <div className="pt-6">
                <button
                  onClick={() => onSelectPlan(plan.id)}
                  disabled={isActive}
                  className={`w-full py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 active:scale-[0.96] ${
                    isActive
                      ? 'bg-neutral-100 text-neutral-400 cursor-default'
                      : plan.isPopular
                      ? 'bg-[#522D60] hover:bg-[#40234c] text-white shadow-xs'
                      : 'border border-[#522D60] text-[#522D60] hover:bg-purple-50'
                  }`}
                >
                  {isActive ? 'Paket Aktif Saat Ini' : `Pilih ${plan.name}`}
                </button>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
};
