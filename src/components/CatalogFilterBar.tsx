import React, { useEffect, useRef, useState, useCallback } from 'react';
import { SlidersHorizontal, MapPin, Check, X, Search, Users, UserCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, ProductCategory, ProductGender } from '../types';
import { CATEGORY_LIST, GENDER_OPTIONS, PRICE_PRESETS, getCategorySpec } from '../data/categorySpecs';

export type CatalogCondition = 'Semua' | 'Baru' | 'Pre-loved';
export type CatalogSortBy = 'baru' | 'murah' | 'mahal' | 'lama';

interface CatalogFilterBarProps {
  resultCount: number;
  searchQuery: string;
  onChangeSearch: (query: string) => void;
  selectedCategory: 'Semua' | ProductCategory;
  onChangeCategory: (category: 'Semua' | ProductCategory) => void;
  selectedSubCategory?: string;
  onChangeSubCategory?: (subCategory: string) => void;
  selectedSizes: string[];
  availableSizes: string[];
  onToggleSize: (size: string) => void;
  onClearSizes: () => void;
  selectedGender: 'Semua' | ProductGender;
  onChangeGender: (gender: 'Semua' | ProductGender) => void;
  minPrice: string;
  maxPrice: string;
  onChangePriceRange: (min: string, max: string) => void;
  selectedCondition: CatalogCondition;
  onChangeCondition: (condition: CatalogCondition) => void;
  selectedCity: string;
  availableCities: string[];
  onChangeCity: (city: string) => void;
  sortBy: CatalogSortBy;
  onChangeSort: (sort: CatalogSortBy) => void;
  isAiActive: boolean;
  isWishlistOnly: boolean;
  onClearWishlistOnly: () => void;
  isFollowingOnly?: boolean;
  onToggleFollowingOnly?: () => void;
  followingCount?: number;
  onOpenSellerDirectory?: () => void;
  onResetFilters: () => void;
  searchInputContainerRef?: React.RefObject<HTMLDivElement | null>;
  onFocusSearch?: () => void;
  onEscapeSearch?: () => void;
}

export const CatalogFilterBar: React.FC<CatalogFilterBarProps> = ({
  resultCount,
  searchQuery,
  onChangeSearch,
  selectedCategory,
  onChangeCategory,
  selectedSubCategory = 'Semua',
  onChangeSubCategory,
  selectedSizes,
  availableSizes,
  onToggleSize,
  onClearSizes,
  selectedGender,
  onChangeGender,
  minPrice,
  maxPrice,
  onChangePriceRange,
  selectedCondition,
  onChangeCondition,
  selectedCity,
  availableCities,
  onChangeCity,
  sortBy,
  onChangeSort,
  isAiActive,
  isWishlistOnly,
  onClearWishlistOnly,
  isFollowingOnly = false,
  onToggleFollowingOnly,
  followingCount = 0,
  onOpenSellerDirectory,
  onResetFilters,
  searchInputContainerRef,
  onFocusSearch,
  onEscapeSearch,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const categoryItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateCategoryScrollState = useCallback(() => {
    const el = categoryScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateCategoryScrollState();
    window.addEventListener('resize', updateCategoryScrollState);
    return () => window.removeEventListener('resize', updateCategoryScrollState);
  }, [updateCategoryScrollState]);

  useEffect(() => {
    const container = categoryScrollRef.current;
    const activeBtn = categoryItemRefs.current[selectedCategory];
    if (!container || !activeBtn) return;
    const containerRect = container.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    if (btnRect.left < containerRect.left + 24 || btnRect.right > containerRect.right - 24) {
      const targetLeft =
        activeBtn.offsetLeft - container.clientWidth / 2 + activeBtn.clientWidth / 2;
      container.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
    }
  }, [selectedCategory]);

  const scrollCategoriesBy = (delta: number) => {
    const el = categoryScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const sortOptions: Array<{ value: CatalogSortBy; label: string }> = [
    { value: 'baru', label: isAiActive ? 'Paling Relevan' : 'Paling Baru' },
    { value: 'murah', label: 'Harga Terendah' },
    { value: 'mahal', label: 'Harga Tertinggi' },
    { value: 'lama', label: 'Paling Lama' },
  ];

  const hasPriceFilter = Boolean(minPrice.trim() || maxPrice.trim());
  const selectedCategorySpec = selectedCategory !== 'Semua' ? getCategorySpec(selectedCategory) : null;
  const supportsSizeFilter = selectedCategory === 'Semua' || Boolean(selectedCategorySpec?.supportsSize);
  const supportsGenderFilter = selectedCategory === 'Semua' || Boolean(selectedCategorySpec?.supportsGender);

  const activeFilterCount =
    (selectedCategory !== 'Semua' ? 1 : 0) +
    (selectedSubCategory && selectedSubCategory !== 'Semua' ? 1 : 0) +
    (supportsSizeFilter && selectedSizes.length > 0 ? 1 : 0) +
    (hasPriceFilter ? 1 : 0) +
    (selectedCondition !== 'Semua' ? 1 : 0) +
    (supportsGenderFilter && selectedGender !== 'Semua' ? 1 : 0) +
    (selectedCity !== 'Semua Kota' ? 1 : 0) +
    (isFollowingOnly ? 1 : 0) +
    (sortBy !== 'baru' ? 1 : 0);

  const activeSizeLabel = selectedCategorySpec ? selectedCategorySpec.sizeLabel : 'Ukuran';

  const showQuickSizeBar =
    supportsSizeFilter &&
    availableSizes.length > 0 &&
    (selectedCategory !== 'Semua' || selectedSizes.length > 0);

  const fashionCategories = CATEGORY_LIST.filter((c) => getCategorySpec(c).group === 'Fashion');
  const generalCategories = CATEGORY_LIST.filter((c) => getCategorySpec(c).group !== 'Fashion');

  return (
    <div className="space-y-2.5">
      {/* Row 1: Single-line Primary Parent Category Strip with smart scroll controls */}
      <div className="relative group/cats">
        {canScrollLeft && (
          <div className="hidden md:flex items-center absolute left-0 top-0 bottom-0 z-10 pr-6 bg-gradient-to-r from-[#fafafa] via-[#fafafa]/90 to-transparent pointer-events-none">
            <button
              type="button"
              onClick={() => scrollCategoriesBy(-280)}
              aria-label="Geser kategori ke kiri"
              className="pointer-events-auto w-7 h-7 rounded-full bg-white border border-neutral-200/90 shadow-sm hover:border-neutral-400 text-neutral-700 hover:text-neutral-900 flex items-center justify-center transition-all active:scale-90 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}

        <div
          ref={categoryScrollRef}
          onScroll={updateCategoryScrollState}
          className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-0.5 no-scrollbar scroll-smooth"
          role="tablist"
          aria-label="Filter kategori produk"
        >
          <button
            ref={(el) => {
              categoryItemRefs.current['Semua'] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selectedCategory === 'Semua'}
            onClick={() => onChangeCategory('Semua')}
            className={`px-3.5 py-1.5 sm:py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 border ${
              selectedCategory === 'Semua'
                ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                : 'bg-white text-neutral-600 border-neutral-200/90 hover:border-neutral-400 hover:text-neutral-900'
            }`}
          >
            Semua Kategori
          </button>
          {CATEGORY_LIST.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                ref={(el) => {
                  categoryItemRefs.current[cat] = el;
                }}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onChangeCategory(cat)}
                className={`px-3.5 py-1.5 sm:py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 border ${
                  isActive
                    ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                    : 'bg-white text-neutral-600 border-neutral-200/90 hover:border-neutral-400 hover:text-neutral-900'
                }`}
              >
                {getCategorySpec(cat).label}
              </button>
            );
          })}
        </div>

        {canScrollRight && (
          <div className="hidden md:flex items-center justify-end absolute right-0 top-0 bottom-0 z-10 pl-8 bg-gradient-to-l from-[#fafafa] via-[#fafafa]/90 to-transparent pointer-events-none">
            <button
              type="button"
              onClick={() => scrollCategoriesBy(280)}
              aria-label="Geser kategori ke kanan"
              className="pointer-events-auto w-7 h-7 rounded-full bg-white border border-neutral-200/90 shadow-sm hover:border-neutral-400 text-neutral-700 hover:text-neutral-900 flex items-center justify-center transition-all active:scale-90 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Contextual Nested Sub-Category Tray (Visually subordinate to Parent Category) */}
      <AnimatePresence initial={false}>
        {selectedCategorySpec && onChangeSubCategory && selectedCategorySpec.subCategories.length > 0 && (
          <motion.div
            key={selectedCategory}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="w-fit max-w-full bg-neutral-100/80 border border-neutral-200/80 rounded-2xl p-1.5"
          >
            <div className="flex items-center gap-1 overflow-x-auto sm:overflow-visible sm:flex-wrap no-scrollbar">
              <button
                type="button"
                onClick={() => onChangeSubCategory('Semua')}
                className={`px-3 py-1 rounded-xl text-xs whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                  selectedSubCategory === 'Semua'
                    ? 'bg-white text-neutral-900 font-semibold shadow-2xs ring-1 ring-neutral-900/10'
                    : 'text-neutral-600 font-medium hover:text-neutral-900 hover:bg-white/60'
                }`}
              >
                Semua
              </button>
              {selectedCategorySpec.subCategories.map((sub) => {
                const isSubActive = selectedSubCategory === sub;
                return (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => onChangeSubCategory(isSubActive ? 'Semua' : sub)}
                    className={`px-3 py-1 rounded-xl text-xs whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                      isSubActive
                        ? 'bg-white text-neutral-900 font-semibold shadow-2xs ring-1 ring-neutral-900/10'
                        : 'text-neutral-600 font-medium hover:text-neutral-900 hover:bg-white/60'
                    }`}
                  >
                    {sub}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Row 2 (Contextual): Dynamic Category-Scoped Quick Size Strip */}
      {showQuickSizeBar && (
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar">
          <span className="text-[11px] font-medium text-neutral-500 whitespace-nowrap shrink-0">
            {activeSizeLabel}:
          </span>
          <div className="flex items-center gap-1.5">
            {availableSizes.map((size) => {
              const isSelected = selectedSizes.includes(size);
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => onToggleSize(size)}
                  className={`min-w-[36px] h-8 px-2.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer shrink-0 border tabular-nums ${
                    isSelected
                      ? 'bg-neutral-900 text-white border-neutral-900'
                      : 'bg-white text-neutral-700 border-neutral-200/90 hover:border-neutral-400 hover:text-neutral-900'
                  }`}
                >
                  {size}
                </button>
              );
            })}
          </div>
          {selectedSizes.length > 0 && (
            <button
              type="button"
              onClick={onClearSizes}
              className="text-[11px] font-medium text-neutral-500 hover:text-neutral-900 underline underline-offset-2 whitespace-nowrap cursor-pointer shrink-0 ml-1"
            >
              Hapus ukuran
            </button>
          )}
        </div>
      )}

      {/* Row 3: Full-width Search Bar & Actions */}
      <div className="space-y-2.5">
        {/* Full-width Search Field */}
        <div
          ref={searchInputContainerRef}
          className="w-full"
        >
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onChangeSearch(e.target.value)}
              onFocus={() => onFocusSearch?.()}
              onClick={() => onFocusSearch?.()}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  (e.currentTarget as HTMLInputElement).blur();
                  onEscapeSearch?.();
                }
              }}
              placeholder="Cari produk, toko, user, kota..."
              aria-label="Cari produk atau toko di katalog"
              className="w-full min-h-[44px] bg-white border border-neutral-200/90 hover:border-neutral-300 focus:border-neutral-900 rounded-xl pl-10 pr-10 py-2 text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none transition-colors shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onChangeSearch('')}
                aria-label="Hapus pencarian katalog"
                className="absolute right-3 p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Status & Actions Row */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          {/* Left: Clean product count + active summary */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-neutral-500 min-w-0">
            <span className="font-medium text-neutral-700 tabular-nums whitespace-nowrap">
              {resultCount} produk
            </span>
            {activeFilterCount > 0 && (
              <>
                <span aria-hidden="true" className="text-neutral-300">
                  ·
                </span>
                <button
                  type="button"
                  onClick={onResetFilters}
                  className="text-xs text-neutral-500 hover:text-neutral-900 underline underline-offset-2 cursor-pointer whitespace-nowrap"
                >
                  Reset filter
                </button>
              </>
            )}
            {isWishlistOnly && (
              <>
                <span aria-hidden="true" className="text-neutral-300">
                  ·
                </span>
                <button
                  type="button"
                  onClick={onClearWishlistOnly}
                  className="text-xs text-neutral-600 hover:text-neutral-900 underline underline-offset-2 cursor-pointer whitespace-nowrap"
                >
                  Wishlist (Semua)
                </button>
              </>
            )}
            {isFollowingOnly && onToggleFollowingOnly && (
              <>
                <span aria-hidden="true" className="text-neutral-300">
                  ·
                </span>
                <button
                  type="button"
                  onClick={onToggleFollowingOnly}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                >
                  <UserCheck className="w-3 h-3 shrink-0" />
                  <span>Diikuti</span>
                  <X className="w-3 h-3 ml-0.5" />
                </button>
              </>
            )}
          </div>

          {/* Right: Cari Toko/User + Filter & Urutkan triggers */}
          <div className="relative flex items-center gap-1.5 sm:gap-2 shrink-0">
            {!isFollowingOnly && followingCount > 0 && onToggleFollowingOnly && (
              <button
                type="button"
                onClick={onToggleFollowingOnly}
                className="hidden lg:inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-xl border border-neutral-200/90 bg-white hover:border-neutral-400 text-xs font-medium text-neutral-700 hover:text-neutral-900 transition-all cursor-pointer whitespace-nowrap shrink-0 tabular-nums"
              >
                <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Diikuti ({followingCount})</span>
              </button>
            )}

            {onOpenSellerDirectory && (
              <button
                type="button"
                onClick={onOpenSellerDirectory}
                className="inline-flex items-center gap-1.5 min-h-[38px] sm:min-h-[40px] px-2.5 sm:px-3 py-1.5 rounded-xl border border-neutral-200/90 bg-white hover:border-neutral-400 text-xs font-medium text-neutral-700 hover:text-neutral-900 transition-all cursor-pointer whitespace-nowrap shrink-0 active:scale-[0.98]"
              >
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Toko &amp; User</span>
                <span className="sm:hidden">Toko</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsOpen((prev) => !prev)}
              aria-expanded={isOpen}
              aria-haspopup="dialog"
              className={`inline-flex items-center gap-1.5 sm:gap-2 min-h-[38px] sm:min-h-[40px] px-2.5 sm:px-3.5 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 active:scale-[0.98] ${
                isOpen
                  ? 'bg-neutral-900 text-white border-neutral-900'
                  : activeFilterCount > 0
                    ? 'bg-white text-neutral-900 border-neutral-900/70'
                    : 'bg-white text-neutral-700 border-neutral-200/90 hover:border-neutral-400 hover:text-neutral-900'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xs:inline sm:inline">Filter &amp; Urutkan</span>
              <span className="xs:hidden sm:hidden">Filter</span>
              {activeFilterCount > 0 && (
                <span
                  className={`tabular-nums text-[11px] font-semibold ${
                    isOpen ? 'text-white/80' : 'text-neutral-500'
                  }`}
                >
                  ({activeFilterCount})
                </span>
              )}
            </button>

          <AnimatePresence>
            {isOpen && (
              <>
                {/* Click-outside backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => setIsOpen(false)}
                  className="fixed inset-0 z-40 bg-black/30 md:bg-transparent backdrop-blur-[1px] md:backdrop-blur-none"
                />

                {/* Responsive Panel: Mobile bottom sheet / Desktop popover */}
                <motion.div
                  role="dialog"
                  aria-label="Filter dan Urutkan Katalog"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  className="fixed inset-x-0 bottom-0 md:inset-auto md:absolute md:right-0 md:top-full md:mt-2 z-50 w-full md:w-96 max-h-[85vh] flex flex-col overflow-hidden bg-white rounded-t-3xl md:rounded-2xl border-t md:border border-neutral-200 shadow-2xl md:shadow-xl"
                >
                  {/* Panel Header (Non-scrolling, zero top gap) */}
                  <div className="shrink-0 flex items-center justify-between px-5 pt-5 pb-3.5 border-b border-neutral-100 bg-white">
                    <span className="text-sm font-semibold text-neutral-900">
                      Filter &amp; Urutkan
                    </span>
                    <div className="flex items-center gap-3">
                      {activeFilterCount > 0 && (
                        <button
                          type="button"
                          onClick={onResetFilters}
                          className="text-xs font-medium text-neutral-500 hover:text-neutral-900 underline underline-offset-2 cursor-pointer"
                        >
                          Reset
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
                        aria-label="Tutup panel filter"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Scrollable Filter Body */}
                  <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-5">

                  {/* Category & Sub-Category Dropdowns */}
                  <div className="space-y-2.5">
                    <div>
                      <label
                        htmlFor="catalog-category-filter"
                        className="block text-xs font-medium text-neutral-500 mb-1.5"
                      >
                        Kategori Barang
                      </label>
                      <select
                        id="catalog-category-filter"
                        value={selectedCategory}
                        onChange={(e) => onChangeCategory(e.target.value as 'Semua' | ProductCategory)}
                        className="w-full min-h-[40px] bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-neutral-800 focus:outline-none focus:border-neutral-900 cursor-pointer"
                      >
                        <option value="Semua">Semua Kategori</option>
                        <optgroup label="Fashion">
                          {fashionCategories.map((cat) => (
                            <option key={cat} value={cat}>
                              {getCategorySpec(cat).label}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Elektronik, Hobi &amp; Umum">
                          {generalCategories.map((cat) => (
                            <option key={cat} value={cat}>
                              {getCategorySpec(cat).label}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>

                    {selectedCategorySpec && onChangeSubCategory && (
                      <div>
                        <label
                          htmlFor="catalog-subcategory-filter"
                          className="block text-xs font-medium text-neutral-500 mb-1.5"
                        >
                          Sub-Kategori
                        </label>
                        <select
                          id="catalog-subcategory-filter"
                          value={selectedSubCategory}
                          onChange={(e) => onChangeSubCategory(e.target.value)}
                          className="w-full min-h-[40px] bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-neutral-800 focus:outline-none focus:border-neutral-900 cursor-pointer"
                        >
                          <option value="Semua">Semua {selectedCategorySpec.label}</option>
                          {selectedCategorySpec.subCategories.map((sub) => (
                            <option key={sub} value={sub}>
                              {sub}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Dynamic Sizes (Multi-select, Fashion only) */}
                  {supportsSizeFilter && availableSizes.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-medium text-neutral-500">
                          {activeSizeLabel} {selectedSizes.length > 0 ? `(${selectedSizes.length})` : ''}
                        </label>
                        {selectedSizes.length > 0 && (
                          <button
                            type="button"
                            onClick={onClearSizes}
                            className="text-[11px] font-medium text-neutral-500 hover:text-neutral-900 underline cursor-pointer"
                          >
                            Hapus ukuran
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {availableSizes.map((size) => {
                          const isSelected = selectedSizes.includes(size);
                          return (
                            <button
                              key={size}
                              type="button"
                              onClick={() => onToggleSize(size)}
                              className={`min-w-[38px] px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer tabular-nums ${
                                isSelected
                                  ? 'bg-neutral-900 text-white border-neutral-900'
                                  : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400'
                              }`}
                            >
                              {size}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Price Range */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-medium text-neutral-500">
                        Rentang Harga (Rp)
                      </label>
                      {hasPriceFilter && (
                        <button
                          type="button"
                          onClick={() => onChangePriceRange('', '')}
                          className="text-[11px] font-medium text-neutral-500 hover:text-neutral-900 underline cursor-pointer"
                        >
                          Hapus harga
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        placeholder="Min Rp"
                        value={minPrice}
                        onChange={(e) => onChangePriceRange(e.target.value, maxPrice)}
                        className="w-full min-h-[38px] px-3 py-1.5 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-900 tabular-nums placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900"
                      />
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        placeholder="Max Rp"
                        value={maxPrice}
                        onChange={(e) => onChangePriceRange(minPrice, e.target.value)}
                        className="w-full min-h-[38px] px-3 py-1.5 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-900 tabular-nums placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {PRICE_PRESETS.map((preset) => {
                        const presetMin = preset.min ? String(preset.min) : '';
                        const presetMax = preset.max ? String(preset.max) : '';
                        const isPresetActive = minPrice === presetMin && maxPrice === presetMax;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() =>
                              isPresetActive
                                ? onChangePriceRange('', '')
                                : onChangePriceRange(presetMin, presetMax)
                            }
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer tabular-nums ${
                              isPresetActive
                                ? 'bg-neutral-900 text-white border-neutral-900'
                                : 'bg-neutral-50 text-neutral-600 border-neutral-200/80 hover:border-neutral-400'
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Condition */}
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-neutral-500">
                      Kondisi Produk
                    </label>
                    <div className="grid grid-cols-3 gap-1 p-1 bg-neutral-100 rounded-xl border border-neutral-200/60">
                      {(['Semua', 'Baru', 'Pre-loved'] as const).map((cond) => (
                        <button
                          key={cond}
                          type="button"
                          onClick={() => onChangeCondition(cond)}
                          className={`min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                            selectedCondition === cond
                              ? 'bg-white text-neutral-900 shadow-2xs'
                              : 'text-neutral-600 hover:text-neutral-900'
                          }`}
                        >
                          {cond}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Gender (Fashion only) */}
                  {supportsGenderFilter && (
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-neutral-500">
                        Gender
                      </label>
                      <div className="grid grid-cols-4 gap-1 p-1 bg-neutral-100 rounded-xl border border-neutral-200/60">
                        {(['Semua', ...GENDER_OPTIONS] as const).map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => onChangeGender(g)}
                            className={`min-h-[36px] px-2 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                              selectedGender === g
                                ? 'bg-white text-neutral-900 shadow-2xs'
                                : 'text-neutral-600 hover:text-neutral-900'
                            }`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* City */}
                  <div className="space-y-2">
                    <label
                      htmlFor="catalog-city-filter"
                      className="block text-xs font-medium text-neutral-500"
                    >
                      Kota Asal
                    </label>
                    <div className="relative flex items-center">
                      <MapPin className="w-4 h-4 text-neutral-400 absolute left-3 pointer-events-none" />
                      <select
                        id="catalog-city-filter"
                        value={selectedCity}
                        onChange={(e) => onChangeCity(e.target.value)}
                        className="w-full min-h-[42px] bg-white border border-neutral-200 rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm font-medium text-neutral-800 focus:outline-none focus:border-neutral-900 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23666666%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:9px_9px] bg-[right_12px_center] bg-no-repeat"
                      >
                        {availableCities.map((city) => (
                          <option key={city} value={city}>
                            {city}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Followed Stores Toggle */}
                  {onToggleFollowingOnly && (
                    <div className="space-y-2">
                      <span className="block text-xs font-medium text-neutral-500">
                        Lapak Favorit
                      </span>
                      <button
                        type="button"
                        onClick={onToggleFollowingOnly}
                        className={`w-full min-h-[42px] flex items-center justify-between px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                          isFollowingOnly
                            ? 'bg-red-50 border-red-300 text-red-700 font-semibold'
                            : 'bg-white border-neutral-200 text-neutral-700 hover:border-neutral-400'
                        }`}
                      >
                        <span className="inline-flex items-center gap-2">
                          <UserCheck className={`w-4 h-4 ${isFollowingOnly ? 'text-red-600' : 'text-neutral-400'}`} />
                          <span>Hanya dari Lapak Diikuti ({followingCount})</span>
                        </span>
                        {isFollowingOnly && <Check className="w-4 h-4 text-red-600 shrink-0" />}
                      </button>
                    </div>
                  )}

                  {/* Sort */}
                  <div className="space-y-2">
                    <span className="block text-xs font-medium text-neutral-500">
                      Urutkan
                    </span>
                    <div className="space-y-1">
                      {sortOptions.map((option) => {
                        const isSelected = sortBy === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => onChangeSort(option.value)}
                            className={`w-full min-h-[40px] flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-neutral-100 text-neutral-900 font-semibold'
                                : 'text-neutral-700 hover:bg-neutral-50'
                            }`}
                          >
                            <span>{option.label}</span>
                            {isSelected && (
                              <Check className="w-4 h-4 text-neutral-900 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  </div>

                  {/* Anchored Footer Action */}
                  <div className="shrink-0 px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:pb-4 border-t border-neutral-100 bg-white">
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="w-full min-h-[44px] py-2.5 px-4 bg-neutral-900 hover:bg-black text-white text-xs sm:text-sm font-medium rounded-xl transition-colors cursor-pointer tabular-nums"
                    >
                      Tampilkan {resultCount} produk
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
        </div>
      </div>
    </div>
  );
};
