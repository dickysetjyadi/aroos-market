import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, Truck, X } from 'lucide-react';
import { INDONESIAN_COURIERS, IndonesianCourierOption } from '../data/indonesianCouriers';

interface CourierSearchSelectProps {
  value: string;
  onChange: (courierName: string) => void;
  placeholder?: string;
}

const CATEGORY_ORDER: IndonesianCourierOption['category'][] = [
  'Reguler & Express',
  'Instan & Sameday',
  'Kargo & Logistik',
  'Internasional',
  'Lainnya',
];

export const CourierSearchSelect: React.FC<CourierSearchSelectProps> = ({
  value,
  onChange,
  placeholder = 'Cari & pilih ekspedisi Indonesia (JNE, J&T, SiCepat, dll)...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 40);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  const filteredCouriers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return INDONESIAN_COURIERS;
    return INDONESIAN_COURIERS.filter((c) => {
      const hay = `${c.name} ${c.category} ${(c.aliases || []).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query]);

  const groupedCouriers = useMemo(() => {
    return CATEGORY_ORDER.map((cat) => ({
      category: cat,
      items: filteredCouriers.filter((c) => c.category === cat),
    })).filter((g) => g.items.length > 0);
  }, [filteredCouriers]);

  const trimmedQuery = query.trim();
  const hasExactMatch = filteredCouriers.some(
    (c) => c.name.toLowerCase() === trimmedQuery.toLowerCase()
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full min-h-[40px] px-3.5 py-2 rounded-xl border text-left text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
          isOpen
            ? 'bg-white border-neutral-900 ring-2 ring-neutral-900/10'
            : 'bg-neutral-50 border-neutral-200 hover:bg-white'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Truck className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
          <span className={`truncate ${value ? 'font-semibold text-neutral-900' : 'text-neutral-400'}`}>
            {value || placeholder}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-neutral-400 shrink-0 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1.5 z-50 bg-white rounded-2xl border border-neutral-200 shadow-xl overflow-hidden">
          <div className="p-2.5 border-b border-neutral-100 bg-neutral-50/70">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ketik nama ekspedisi (JNE, J&T, SPX, GoSend, Lion, Kargo...)"
                className="w-full pl-8 pr-7 py-1.5 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                  aria-label="Hapus pencarian kurir"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto divide-y divide-neutral-100">
            {groupedCouriers.map((group) => (
              <div key={group.category} className="py-1.5">
                <p className="px-3 py-1 text-[10px] font-bold text-neutral-400 tracking-wide">
                  {group.category}
                </p>
                {group.items.map((courier) => {
                  const isSelected = value === courier.name;
                  return (
                    <button
                      key={courier.id}
                      type="button"
                      onClick={() => {
                        onChange(courier.name);
                        setIsOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-neutral-900 text-white font-semibold'
                          : 'text-neutral-800 hover:bg-neutral-100'
                      }`}
                    >
                      <span className="truncate">{courier.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ))}

            {trimmedQuery && !hasExactMatch && (
              <div className="p-2 bg-neutral-50">
                <button
                  type="button"
                  onClick={() => {
                    onChange(trimmedQuery);
                    setIsOpen(false);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-neutral-200 hover:border-neutral-900 text-left text-xs font-semibold text-neutral-800 cursor-pointer"
                >
                  Gunakan ekspedisi lain: &ldquo;{trimmedQuery}&rdquo;
                </button>
              </div>
            )}

            {groupedCouriers.length === 0 && !trimmedQuery && (
              <div className="p-4 text-center text-xs text-neutral-500">
                Ketik nama ekspedisi untuk mencari.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
