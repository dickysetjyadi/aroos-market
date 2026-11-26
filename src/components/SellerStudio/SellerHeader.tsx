import React from 'react';
import { 
  PackageCheck, Layers, FileText, ArrowLeft, PlusCircle, User
} from 'lucide-react';

export type SellerTabId = 'sell' | 'listings' | 'orders' | 'reports';

interface SellerHeaderProps {
  activeTab: SellerTabId;
  setActiveTab: (tab: SellerTabId) => void;
  listingsCount?: number;
  pendingOrdersCount?: number;
  brandName?: string;
  brandCity?: string;
  followerCount?: number;
  followingCount?: number;
  onOpenProfile?: () => void;
  onOpenFollowers?: (tab?: 'followers' | 'following') => void;
  onBackToCatalog?: () => void;
}

export const SellerHeader: React.FC<SellerHeaderProps> = ({
  activeTab,
  setActiveTab,
  listingsCount,
  pendingOrdersCount = 0,
  brandName,
  brandCity,
  followerCount = 0,
  followingCount = 0,
  onOpenProfile,
  onOpenFollowers,
  onBackToCatalog,
}) => {
  const tabs: Array<{
    id: SellerTabId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }> = [
    {
      id: 'sell',
      label: 'Jual Barang',
      icon: PlusCircle,
    },
    {
      id: 'listings',
      label: 'Listing Saya',
      icon: Layers,
      badge: typeof listingsCount === 'number' && listingsCount > 0 ? `${listingsCount}` : undefined,
    },
    {
      id: 'orders',
      label: 'Pesanan Masuk',
      icon: PackageCheck,
      badge: pendingOrdersCount > 0 ? `${pendingOrdersCount} Baru` : undefined,
    },
    {
      id: 'reports',
      label: 'Laporan',
      icon: FileText,
    },
  ];

  const displayName = brandName || 'Lapak Saya';
  const displayCity = brandCity || 'Indonesia';

  return (
    <div className="bg-white border-b border-neutral-200">
      <div className="w-full max-w-[1840px] mx-auto px-3.5 sm:px-6 lg:px-8 xl:px-10 py-4 sm:py-5 space-y-3.5 sm:space-y-4">
        
        {/* Top Info Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-neutral-900">
              {displayName}
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5 tabular-nums flex items-center gap-1.5 flex-wrap">
              <span>{displayCity}</span>
              <span aria-hidden="true">·</span>
              {onOpenFollowers ? (
                <button
                  type="button"
                  onClick={() => onOpenFollowers('followers')}
                  className="font-semibold text-neutral-700 hover:text-neutral-900 hover:underline underline-offset-2 cursor-pointer transition-colors"
                >
                  {followerCount} Pengikut
                </button>
              ) : (
                <span>{followerCount} Pengikut</span>
              )}
              <span aria-hidden="true">·</span>
              {onOpenFollowers ? (
                <button
                  type="button"
                  onClick={() => onOpenFollowers('following')}
                  className="font-semibold text-neutral-700 hover:text-neutral-900 hover:underline underline-offset-2 cursor-pointer transition-colors"
                >
                  {followingCount} Mengikuti
                </button>
              ) : (
                <span>{followingCount} Mengikuti</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onOpenProfile && (
              <button
                type="button"
                onClick={onOpenProfile}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 text-xs font-medium text-neutral-700 hover:text-neutral-900 hover:border-neutral-400 transition-colors cursor-pointer whitespace-nowrap"
              >
                <User className="w-3.5 h-3.5" />
                <span>Profil Saya</span>
              </button>
            )}

            {onBackToCatalog && (
              <button
                type="button"
                onClick={onBackToCatalog}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 text-xs font-medium text-neutral-700 hover:text-neutral-900 hover:border-neutral-400 transition-colors cursor-pointer whitespace-nowrap"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Kembali ke Katalog</span>
              </button>
            )}
          </div>
        </div>

        {/* 3-Tab Carousell-style Selling Workspace Navigation */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-2 border-t border-neutral-100 no-scrollbar">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isCurrent = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 whitespace-nowrap active:scale-[0.96] cursor-pointer ${
                  isCurrent
                    ? 'bg-neutral-900 text-white shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                    isCurrent ? 'bg-white/15 text-white' : 'bg-neutral-100 text-neutral-700'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
};
