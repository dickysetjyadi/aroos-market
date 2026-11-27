import React, { useState, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera, Edit3, Eye, EyeOff, MapPin, Plus,
  Search, Star, Tag, Trash2, TrendingUp, X
} from 'lucide-react';
import { ChatConversation, GarmentMeasurements, Product, ProductCategory, ProductGender, UserProfile } from '../../types';
import {
  CATEGORY_LIST,
  GENDER_OPTIONS,
  getCategorySpec,
  getMeasurementType,
} from '../../data/categorySpecs';
import { isProductOwnedByUser } from '../../utils/ownership';
import { useConfirm } from '../ConfirmDialogContext';
import { ReservedBuyerModal } from '../ReservedBuyerModal';
import { compressImageForUpload } from '../../utils/imageCompression';
import {
  AROOS_BACKDROP_TRANSITION,
  AROOS_MODAL_TRANSITION,
  AROOS_MODAL_VARIANTS,
} from '../../utils/motionPresets';

interface InventoryManagerProps {
  activeSection: 'sell' | 'listings';
  onSwitchSection?: (section: 'sell' | 'listings') => void;
  products: Product[];
  conversations?: ChatConversation[];
  ownerProfile?: UserProfile;
  sellerBrandName?: string;
  sellerBrandCity?: string;
  sellerId?: string;
  sellerAvatar?: string;
  pendingEditProductId?: string | null;
  onClearPendingEdit?: () => void;
  onUpdateProduct?: (productId: string, updates: Partial<Product>) => Promise<void> | void;
  onAddProduct: (newProduct: Product) => Promise<void> | void;
  onToggleActive?: (productId: string, newActiveState: boolean) => Promise<void> | void;
  onDeleteProduct?: (productId: string) => Promise<void> | void;
  triggerToast: (title: string, message: string, type: 'order' | 'low_stock' | 'social_sync' | 'system') => void;
}

const FASHION_CATEGORIES = CATEGORY_LIST.filter(
  (c) => getCategorySpec(c).group === 'Fashion'
);
const GENERAL_CATEGORIES = CATEGORY_LIST.filter(
  (c) => getCategorySpec(c).group === 'Elektronik, Hobi & Umum'
);

export const InventoryManager: React.FC<InventoryManagerProps> = ({
  activeSection,
  onSwitchSection,
  products,
  conversations = [],
  ownerProfile,
  sellerBrandName = 'Lapak Saya',
  sellerBrandCity = 'Indonesia',
  sellerId,
  sellerAvatar,
  pendingEditProductId = null,
  onClearPendingEdit,
  onUpdateProduct,
  onAddProduct,
  onToggleActive,
  onDeleteProduct,
  triggerToast,
}) => {
  const confirm = useConfirm();
  const photoBoxRef = useRef<HTMLDivElement>(null);

  // "Jual Barang" form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ProductCategory>('Atasan');
  const initialSpec = getCategorySpec('Atasan');
  const [subCategory, setSubCategory] = useState<string>(initialSpec.subCategories[0]);
  const [condition, setCondition] = useState<'Baru' | 'Pre-loved'>('Pre-loved');
  const [gender, setGender] = useState<ProductGender>('Unisex');
  const [sizes, setSizes] = useState<string[]>([initialSpec.defaultSize]);
  const [customSizeInput, setCustomSizeInput] = useState('');
  const [fit, setFit] = useState<string>(initialSpec.fitOptions[0] || '');
  const [colors, setColors] = useState<string[]>([initialSpec.colorSuggestions[0]]);
  const [customColorInput, setCustomColorInput] = useState('');
  const [stock, setStock] = useState<number>(1);
  const [price, setPrice] = useState<string>('250000');
  const [city, setCity] = useState(sellerBrandCity);
  const [allowMeetup, setAllowMeetup] = useState(true);
  const [meetupArea, setMeetupArea] = useState('');
  const [description, setDescription] = useState('');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [photoFormError, setPhotoFormError] = useState<string | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [isProcessingEditPhoto, setIsProcessingEditPhoto] = useState(false);
  const [isSubmittingListing, setIsSubmittingListing] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [publishImmediately, setPublishImmediately] = useState(true);
  // Optional Garment Measurements (cm)
  const [panjangBaju, setPanjangBaju] = useState('');
  const [lebarDada, setLebarDada] = useState('');
  const [lebarBahu, setLebarBahu] = useState('');
  const [panjangCelana, setPanjangCelana] = useState('');
  const [lebarPinggang, setLebarPinggang] = useState('');
  const [openLeg, setOpenLeg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // "Listing Saya" filter & search state
  const [search, setSearch] = useState('');
  const [listingTab, setListingTab] = useState<'all' | 'active' | 'sold' | 'draft'>('all');

  // Edit listing modal state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<ProductCategory>('Atasan');
  const [editSubCategory, setEditSubCategory] = useState('');
  const [editGender, setEditGender] = useState<ProductGender>('Unisex');
  const [editFit, setEditFit] = useState('');
  const [editSizes, setEditSizes] = useState<string[]>([]);
  const [editCustomSizeInput, setEditCustomSizeInput] = useState('');
  const [editColors, setEditColors] = useState<string[]>([]);
  const [editStock, setEditStock] = useState<number>(1);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editCondition, setEditCondition] = useState<'Baru' | 'Pre-loved'>('Pre-loved');
  const [editListingStatus, setEditListingStatus] = useState<'available' | 'reserved' | 'sold'>('available');
  const [editReservedByUserId, setEditReservedByUserId] = useState<string>('');
  const [editReservedByUserName, setEditReservedByUserName] = useState<string>('');
  const [reservedPickerTarget, setReservedPickerTarget] = useState<{
    product: Product;
    source: 'card' | 'edit';
  } | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editImages, setEditImages] = useState<string[]>([]);
  const [editPhotoError, setEditPhotoError] = useState<string | null>(null);
  const [editPanjangBaju, setEditPanjangBaju] = useState('');
  const [editLebarDada, setEditLebarDada] = useState('');
  const [editLebarBahu, setEditLebarBahu] = useState('');
  const [editPanjangCelana, setEditPanjangCelana] = useState('');
  const [editLebarPinggang, setEditLebarPinggang] = useState('');
  const [editOpenLeg, setEditOpenLeg] = useState('');
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const activeSpec = getCategorySpec(category);
  const editSpec = getCategorySpec(editCategory);
  const activeMeasurementType = getMeasurementType(category, subCategory);
  const editMeasurementType = getMeasurementType(editCategory, editSubCategory);

  const priceBenchmark = useMemo(() => {
    const exactMatches = products.filter(
      (p) =>
        p.price > 0 &&
        p.category === category &&
        p.subCategory === subCategory &&
        (p.condition || 'Baru') === condition
    );
    const subMatches = products.filter(
      (p) => p.price > 0 && p.category === category && p.subCategory === subCategory
    );
    const catCondMatches = products.filter(
      (p) =>
        p.price > 0 &&
        p.category === category &&
        (p.condition || 'Baru') === condition
    );
    const catMatches = products.filter((p) => p.price > 0 && p.category === category);

    const pool =
      exactMatches.length >= 2
        ? exactMatches
        : subMatches.length >= 2
          ? subMatches
          : catCondMatches.length >= 2
            ? catCondMatches
            : catMatches;

    let minSuggested: number;
    let maxSuggested: number;
    let medianSuggested: number;

    if (pool.length >= 2) {
      const sorted = pool.map((p) => p.price).sort((a, b) => a - b);
      const rawMin = sorted[0];
      const rawMax = sorted[sorted.length - 1];
      const midIdx = Math.floor(sorted.length / 2);
      const rawMedian =
        sorted.length % 2 === 1
          ? sorted[midIdx]
          : Math.round((sorted[midIdx - 1] + sorted[midIdx]) / 2);

      const poolHasSameCondition = pool.some((p) => (p.condition || 'Baru') === condition);
      const factor = poolHasSameCondition ? 1 : condition === 'Pre-loved' ? 0.72 : 1.15;

      minSuggested = Math.max(15000, Math.round((rawMin * factor) / 5000) * 5000);
      maxSuggested = Math.max(minSuggested + 25000, Math.round((rawMax * factor) / 5000) * 5000);
      medianSuggested = Math.round((rawMedian * factor) / 5000) * 5000;
    } else {
      const [baseMin, baseMax] = activeSpec.priceRange;
      const factor = condition === 'Pre-loved' ? 0.65 : 1;
      minSuggested = Math.max(15000, Math.round((baseMin * factor) / 5000) * 5000);
      maxSuggested = Math.max(minSuggested + 25000, Math.round((baseMax * factor) / 5000) * 5000);
      medianSuggested = Math.round(((minSuggested + maxSuggested) / 2) / 5000) * 5000;
    }

    const currentPrice = Number(price) || 0;
    let positionLabel = 'Masukkan harga untuk cek posisi pasar';
    let positionTone: 'good' | 'neutral' | 'high' = 'neutral';

    if (currentPrice > 0) {
      if (currentPrice < minSuggested * 0.92) {
        positionLabel = 'Di bawah pasar · Cepat laku';
        positionTone = 'good';
      } else if (currentPrice <= maxSuggested * 1.05) {
        positionLabel = 'Sesuai harga pasar';
        positionTone = 'neutral';
      } else {
        positionLabel = 'Di atas pasar · Jelaskan nilai lebihnya';
        positionTone = 'high';
      }
    }

    // Visual bar range spans slightly wider than min..max
    const spanMin = Math.max(0, minSuggested * 0.7);
    const spanMax = maxSuggested * 1.3;
    const totalSpan = Math.max(1, spanMax - spanMin);
    const clampPct = (val: number) => Math.max(3, Math.min(97, ((val - spanMin) / totalSpan) * 100));

    return {
      minSuggested,
      maxSuggested,
      medianSuggested,
      comparableCount: pool.length,
      positionLabel,
      positionTone,
      bandStartPct: clampPct(minSuggested),
      bandEndPct: clampPct(maxSuggested),
      medianPct: clampPct(medianSuggested),
      markerPct: currentPrice > 0 ? clampPct(currentPrice) : null,
    };
  }, [products, category, subCategory, condition, price, activeSpec.priceRange]);

  const buildMeasurementsPayload = (
    mType: 'top' | 'bottom' | null,
    vals: {
      panjangBaju: string;
      lebarDada: string;
      lebarBahu: string;
      panjangCelana: string;
      lebarPinggang: string;
      openLeg: string;
    }
  ): GarmentMeasurements | undefined => {
    const parseCm = (raw: string): number | undefined => {
      const n = Number(raw.trim());
      return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : undefined;
    };
    const obj: GarmentMeasurements = {};
    if (mType === 'top') {
      const pb = parseCm(vals.panjangBaju);
      const ld = parseCm(vals.lebarDada);
      const lb = parseCm(vals.lebarBahu);
      if (pb !== undefined) obj.panjangBaju = pb;
      if (ld !== undefined) obj.lebarDada = ld;
      if (lb !== undefined) obj.lebarBahu = lb;
    } else if (mType === 'bottom') {
      const pc = parseCm(vals.panjangCelana);
      const lp = parseCm(vals.lebarPinggang);
      const ol = parseCm(vals.openLeg);
      if (pc !== undefined) obj.panjangCelana = pc;
      if (lp !== undefined) obj.lebarPinggang = lp;
      if (ol !== undefined) obj.openLeg = ol;
    }
    return Object.keys(obj).length > 0 ? obj : undefined;
  };

  const handleCategoryChange = (nextCategory: ProductCategory) => {
    setCategory(nextCategory);
    const nextSpec = getCategorySpec(nextCategory);
    const nextSub = nextSpec.subCategories[0] || '';
    setSubCategory(nextSub);
    setSizes(nextSpec.supportsSize && nextSpec.defaultSize ? [nextSpec.defaultSize] : []);
    setFit(nextSpec.supportsFit && nextSpec.fitOptions[0] ? nextSpec.fitOptions[0] : '');
    setColors(nextSpec.colorSuggestions[0] ? [nextSpec.colorSuggestions[0]] : []);
    setCustomSizeInput('');
    setCustomColorInput('');
    const nextMType = getMeasurementType(nextCategory, nextSub);
    if (nextMType !== 'top') {
      setPanjangBaju('');
      setLebarDada('');
      setLebarBahu('');
    }
    if (nextMType !== 'bottom') {
      setPanjangCelana('');
      setLebarPinggang('');
      setOpenLeg('');
    }
  };

  const handleToggleSize = (sizeVal: string) => {
    setSizes((prev) => {
      if (prev.includes(sizeVal)) {
        if (prev.length === 1) return prev;
        return prev.filter((s) => s !== sizeVal);
      }
      return [...prev, sizeVal];
    });
  };

  const handleAddCustomSize = () => {
    const clean = customSizeInput.trim();
    if (!clean) return;
    if (!sizes.includes(clean)) {
      setSizes((prev) => [...prev, clean]);
    }
    setCustomSizeInput('');
  };

  const handleToggleColor = (colorVal: string) => {
    setColors((prev) => {
      if (prev.includes(colorVal)) {
        if (prev.length === 1) return prev;
        return prev.filter((c) => c !== colorVal);
      }
      return [...prev, colorVal];
    });
  };

  const handleAddCustomColor = () => {
    const clean = customColorInput.trim();
    if (!clean) return;
    if (!colors.includes(clean)) {
      setColors((prev) => [...prev, clean]);
    }
    setCustomColorInput('');
  };

  const recompressDataUrl = (
    rawDataUrl: string,
    maxDimension = 760,
    quality = 0.72
  ): Promise<string> => {
    return new Promise((resolve) => {
      if (!rawDataUrl || !rawDataUrl.startsWith('data:image/')) {
        resolve(rawDataUrl);
        return;
      }
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const targetWidth = Math.max(1, Math.round(img.width * ratio));
        const targetHeight = Math.max(1, Math.round(img.height * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawDataUrl);
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(rawDataUrl);
      img.src = rawDataUrl;
    });
  };

  const fitImagesToFirestoreBudget = async (images: string[]): Promise<string[]> => {
    const estimateTotal = (arr: string[]) =>
      arr.reduce((sum, img) => sum + img.length, 0) + (arr[0]?.length || 0);

    let current = [...images];
    const passes: Array<[number, number]> = [
      [760, 0.72],
      [640, 0.62],
      [520, 0.52],
    ];
    for (const [dim, q] of passes) {
      if (estimateTotal(current) <= 700_000) break;
      current = await Promise.all(
        current.map((img) =>
          img.startsWith('data:image/') ? recompressDataUrl(img, dim, q) : Promise.resolve(img)
        )
      );
    }
    return current;
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = Math.max(0, 5 - uploadedImages.length);
    const selectedFiles = Array.from(files).slice(0, remainingSlots);
    e.target.value = '';
    if (remainingSlots <= 0) {
      setPhotoFormError('Maksimal 5 foto per produk.');
      return;
    }

    setPhotoFormError(null);
    setIsProcessingPhoto(true);
    try {
      for (const file of selectedFiles) {
        if (file.size > 25 * 1024 * 1024) {
          setPhotoFormError('Ukuran setiap foto maksimal 25MB.');
          continue;
        }
        try {
          const compressed = await compressImageForUpload(file, {
            maxDimension: 760,
            quality: 0.72,
            maxDataUrlLength: 280_000,
          });
          setUploadedImages((prev) => [...prev, compressed].slice(0, 5));
        } catch (err) {
          setPhotoFormError(
            err instanceof Error
              ? err.message
              : 'Foto gagal diproses. Coba ambil ulang atau pilih foto lain.'
          );
        }
      }
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  const handleRemoveUploadedPhoto = (idx: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handlePromoteUploadedPhoto = (idx: number) => {
    if (idx <= 0) return;
    setUploadedImages((prev) => {
      const copy = [...prev];
      const [picked] = copy.splice(idx, 1);
      return [picked, ...copy];
    });
  };

  const handleEditPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = Math.max(0, 5 - editImages.length);
    const selectedFiles = Array.from(files).slice(0, remainingSlots);
    e.target.value = '';
    if (remainingSlots <= 0) {
      setEditPhotoError('Maksimal 5 foto per produk.');
      return;
    }

    setEditPhotoError(null);
    setIsProcessingEditPhoto(true);
    try {
      for (const file of selectedFiles) {
        if (file.size > 25 * 1024 * 1024) {
          setEditPhotoError('Ukuran setiap foto maksimal 25MB.');
          continue;
        }
        try {
          const compressed = await compressImageForUpload(file, {
            maxDimension: 760,
            quality: 0.72,
            maxDataUrlLength: 280_000,
          });
          setEditImages((prev) => [...prev, compressed].slice(0, 5));
        } catch (err) {
          setEditPhotoError(
            err instanceof Error
              ? err.message
              : 'Foto gagal diproses. Coba ambil ulang atau pilih foto lain.'
          );
        }
      }
    } finally {
      setIsProcessingEditPhoto(false);
    }
  };

  const handleRemoveEditPhoto = (idx: number) => {
    if (editImages.length <= 1) {
      setEditPhotoError('Minimal harus ada 1 foto barang.');
      return;
    }
    setEditPhotoError(null);
    setEditImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handlePromoteEditPhoto = (idx: number) => {
    if (idx <= 0) return;
    setEditPhotoError(null);
    setEditImages((prev) => {
      const copy = [...prev];
      const [picked] = copy.splice(idx, 1);
      return [picked, ...copy];
    });
  };

  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    const numericPrice = Math.max(1000, Number(price) || 0);
    const finalSizes = activeSpec.supportsSize
      ? sizes.length > 0
        ? sizes
        : [activeSpec.defaultSize]
      : [];
    const finalColors =
      colors.length > 0
        ? colors
        : activeSpec.colorSuggestions[0]
          ? [activeSpec.colorSuggestions[0]]
          : [];
    const finalStock = Math.max(1, Number(stock) || 1);

    if (uploadedImages.length === 0) {
      setPhotoFormError('Unggah minimal 1 foto produk sebelum melanjutkan.');
      photoBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (!cleanTitle || numericPrice <= 0) return;

    const cleanCity = city.trim() || sellerBrandCity || 'Indonesia';
    const sizeText = finalSizes.length > 0 ? ` (${finalSizes.join(', ')})` : '';
    const ok = await confirm({
      title: publishImmediately ? 'Tayangkan Listing' : 'Simpan Draft',
      message: `${cleanTitle}${sizeText} · Rp ${numericPrice.toLocaleString('id-ID')}`,
      confirmLabel: publishImmediately ? 'Tayangkan' : 'Simpan',
    });
    if (!ok) return;

    if (isSubmittingListing) return;
    setIsSubmittingListing(true);

    try {
      const fittedImages = await fitImagesToFirestoreBudget(uploadedImages);
      const primaryImage = fittedImages[0];
      const allImages = [...fittedImages];
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);

      const builtMeasurements = buildMeasurementsPayload(activeMeasurementType, {
        panjangBaju,
        lebarDada,
        lebarBahu,
        panjangCelana,
        lebarPinggang,
        openLeg,
      });

      const effectiveBrand = sellerBrandName || ownerProfile?.brandName || ownerProfile?.name || 'Lapak Saya';
      const effectiveSellerId = sellerId || ownerProfile?.id;

      const newListing: Product = {
        id: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: cleanTitle,
        brand: effectiveBrand,
        sellerBrandName: effectiveBrand,
        brandCity: cleanCity,
        category,
        subCategory: subCategory || activeSpec.subCategories[0],
        ...(activeSpec.supportsGender ? { gender } : {}),
        ...(activeSpec.supportsFit && (fit || activeSpec.fitOptions[0])
          ? { fit: fit || activeSpec.fitOptions[0] }
          : {}),
        ...(builtMeasurements ? { measurements: builtMeasurements } : {}),
        condition,
        listingStatus: 'available',
        allowMeetup,
        ...(allowMeetup ? { meetupArea: meetupArea.trim() || `COD ${cleanCity}` } : {}),
        price: numericPrice,
        stock: finalStock,
        sku: `ARS-${randomSuffix}`,
        barcode: `8991204${randomSuffix}`,
        sizes: finalSizes,
        colors: finalColors,
        image: primaryImage,
        images: allImages,
        description:
          description.trim() ||
          `${cleanTitle} (${subCategory}, ${condition}${
            finalSizes.length > 0 ? `, size ${finalSizes.join(', ')}` : ''
          }) berlokasi di ${cleanCity}. Chat penjual untuk detail atau nego harga.`,
        rating: 5.0,
        reviewsCount: 0,
        verifiedBrand: true,
        ...(effectiveSellerId ? { sellerId: effectiveSellerId } : {}),
        ...(sellerAvatar ? { sellerAvatar } : {}),
        isActive: publishImmediately,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await onAddProduct(newListing);

      setTitle('');
      setPrice('250000');
      setStock(condition === 'Pre-loved' ? 1 : 2);
      setDescription('');
      setMeetupArea('');
      setUploadedImages([]);
      setPhotoFormError(null);
      setPanjangBaju('');
      setLebarDada('');
      setLebarBahu('');
      setPanjangCelana('');
      setLebarPinggang('');
      setOpenLeg('');
      setSizes(activeSpec.supportsSize && activeSpec.defaultSize ? [activeSpec.defaultSize] : []);

      triggerToast(
        publishImmediately ? 'Barang Berhasil Ditayangkan' : 'Disimpan ke Draft',
        publishImmediately
          ? `"${newListing.name}" sudah tampil di katalog AROOS.`
          : `"${newListing.name}" tersimpan sebagai draft.`,
        'system'
      );

      if (!publishImmediately) {
        setListingTab('draft');
        setSearch('');
        onSwitchSection?.('listings');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Gagal menyimpan produk ke server. Silakan coba lagi.';
      setPhotoFormError(msg);
      triggerToast('Gagal Menayangkan Barang', msg, 'system');
    } finally {
      setIsSubmittingListing(false);
    }
  };

  const handleOpenEdit = (product: Product) => {
    const spec = getCategorySpec(product.category);
    const existingImages =
      product.images && product.images.length > 0
        ? product.images
        : product.image
          ? [product.image]
          : [];

    setEditingProduct(product);
    setEditName(product.name);
    setEditCategory(spec.id);
    setEditSubCategory(product.subCategory || spec.subCategories[0] || '');
    setEditGender(product.gender || 'Unisex');
    setEditFit(product.fit || spec.fitOptions[0] || '');
    setEditSizes(
      spec.supportsSize
        ? product.sizes && product.sizes.length > 0
          ? product.sizes
          : [spec.defaultSize]
        : []
    );
    setEditCustomSizeInput('');
    setEditColors(
      product.colors && product.colors.length > 0
        ? product.colors
        : spec.colorSuggestions[0]
          ? [spec.colorSuggestions[0]]
          : []
    );
    setEditStock(Math.max(1, product.stock || 1));
    setEditPrice(product.price);
    setEditCondition(product.condition || 'Baru');
    setEditListingStatus(product.listingStatus || 'available');
    setEditReservedByUserId(product.reservedByUserId || '');
    setEditReservedByUserName(product.reservedByUserName || '');
    setEditDescription(product.description || '');
    setEditImages(existingImages);
    setEditPhotoError(null);
    const m = product.measurements;
    setEditPanjangBaju(m?.panjangBaju ? String(m.panjangBaju) : '');
    setEditLebarDada(m?.lebarDada ? String(m.lebarDada) : '');
    setEditLebarBahu(m?.lebarBahu ? String(m.lebarBahu) : '');
    setEditPanjangCelana(m?.panjangCelana ? String(m.panjangCelana) : '');
    setEditLebarPinggang(m?.lebarPinggang ? String(m.lebarPinggang) : '');
    setEditOpenLeg(m?.openLeg ? String(m.openLeg) : '');
  };

  useEffect(() => {
    if (!pendingEditProductId) return;
    const found = products.find((p) => p.id === pendingEditProductId);
    if (found) {
      handleOpenEdit(found);
      onClearPendingEdit?.();
    }
  }, [pendingEditProductId, products, onClearPendingEdit]);

  const handleEditCategoryChange = (nextCategory: ProductCategory) => {
    setEditCategory(nextCategory);
    const nextSpec = getCategorySpec(nextCategory);
    setEditSubCategory(nextSpec.subCategories[0] || '');
    setEditSizes(nextSpec.supportsSize && nextSpec.defaultSize ? [nextSpec.defaultSize] : []);
    setEditFit(nextSpec.supportsFit && nextSpec.fitOptions[0] ? nextSpec.fitOptions[0] : '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !onUpdateProduct) return;

    if (editImages.length === 0) {
      setEditPhotoError('Minimal harus ada 1 foto barang.');
      return;
    }

    const nextName = editName.trim() || editingProduct.name;
    const nextPrice = Math.max(1000, Number(editPrice) || editingProduct.price);
    const nextSizes = editSpec.supportsSize
      ? editSizes.length > 0
        ? editSizes
        : [editSpec.defaultSize]
      : [];
    const nextStock = editListingStatus === 'sold' ? 0 : Math.max(1, Number(editStock) || 1);
    const statusLabelMap = {
      available: 'Tersedia',
      reserved: 'Reserved',
      sold: 'Terjual',
    };

    const ok = await confirm({
      title: 'Simpan Perubahan',
      message: `${nextName} · Rp ${nextPrice.toLocaleString('id-ID')} (${statusLabelMap[editListingStatus]})`,
      confirmLabel: 'Simpan',
    });
    if (!ok) return;

    if (isSavingEdit) return;
    setIsSavingEdit(true);

    try {
      const fittedEditImages = await fitImagesToFirestoreBudget(editImages);
      const editedMeasurements = buildMeasurementsPayload(editMeasurementType, {
        panjangBaju: editPanjangBaju,
        lebarDada: editLebarDada,
        lebarBahu: editLebarBahu,
        panjangCelana: editPanjangCelana,
        lebarPinggang: editLebarPinggang,
        openLeg: editOpenLeg,
      });

      await onUpdateProduct(editingProduct.id, {
        name: nextName,
        category: editCategory,
        subCategory: editSubCategory || editSpec.subCategories[0],
        gender: editSpec.supportsGender ? editGender : undefined,
        fit: editSpec.supportsFit ? editFit || editSpec.fitOptions[0] : undefined,
        measurements: editedMeasurements || {},
        sizes: nextSizes,
        colors:
          editColors.length > 0
            ? editColors
            : editSpec.colorSuggestions[0]
              ? [editSpec.colorSuggestions[0]]
              : [],
        image: fittedEditImages[0],
        images: fittedEditImages,
        price: nextPrice,
        condition: editCondition,
        listingStatus: editListingStatus,
        reservedByUserId: editListingStatus === 'reserved' ? editReservedByUserId : '',
        reservedByUserName: editListingStatus === 'reserved' ? editReservedByUserName : '',
        stock: nextStock,
        description: editDescription.trim() || editingProduct.description,
        updatedAt: new Date().toISOString(),
      });

      triggerToast('Listing Diperbarui', `Perubahan pada "${nextName}" telah disimpan.`, 'system');
      setEditingProduct(null);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Gagal menyimpan perubahan ke server.';
      setEditPhotoError(msg);
      triggerToast('Gagal Menyimpan Perubahan', msg, 'system');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleChangeListingStatus = async (product: Product, nextStatus: 'available' | 'reserved' | 'sold') => {
    if (!onUpdateProduct) return;
    if (nextStatus === 'reserved') {
      setReservedPickerTarget({ product, source: 'card' });
      return;
    }
    if (nextStatus === (product.listingStatus || 'available')) return;

    const labelMap = {
      available: 'Tersedia',
      reserved: 'Reserved',
      sold: 'Terjual',
    };

    const ok = await confirm({
      title: 'Ubah Status',
      message: `Ubah "${product.name}" menjadi ${labelMap[nextStatus]}?`,
      confirmLabel: 'Ubah',
      tone: nextStatus === 'sold' ? 'warning' : 'default',
    });
    if (!ok) return;

    try {
      await onUpdateProduct(product.id, {
        listingStatus: nextStatus,
        reservedByUserId: '',
        reservedByUserName: '',
        stock: nextStatus === 'sold' ? 0 : Math.max(1, product.stock || 1),
      });
      triggerToast('Status Diperbarui', `"${product.name}" kini berstatus ${labelMap[nextStatus]}.`, 'system');
    } catch (err) {
      triggerToast(
        'Gagal Mengubah Status',
        err instanceof Error ? err.message : 'Perubahan gagal disinkronkan ke server.',
        'system'
      );
    }
  };

  const handleToggleVisibility = async (product: Product, isVisible: boolean) => {
    if (!onToggleActive) return;
    const nextVisible = !isVisible;
    const ok = await confirm({
      title: nextVisible ? 'Tayangkan Listing' : 'Sembunyikan ke Draft',
      message: `${nextVisible ? 'Tampilkan' : 'Sembunyikan'} "${product.name}"?`,
      confirmLabel: nextVisible ? 'Tayangkan' : 'Sembunyikan',
    });
    if (!ok) return;

    try {
      await onToggleActive(product.id, nextVisible);
    } catch (err) {
      triggerToast(
        'Gagal Mengubah Visibilitas',
        err instanceof Error ? err.message : 'Perubahan gagal disinkronkan ke server.',
        'system'
      );
    }
  };

  const handleDeleteListing = async (product: Product) => {
    if (!onDeleteProduct) return;
    const ok = await confirm({
      title: 'Hapus Listing',
      message: `Hapus permanen "${product.name}"?`,
      confirmLabel: 'Hapus',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      await onDeleteProduct(product.id);
      triggerToast('Listing Dihapus', `"${product.name}" telah dihapus.`, 'system');
    } catch (err) {
      triggerToast(
        'Gagal Menghapus Listing',
        err instanceof Error ? err.message : 'Gagal menghapus listing di server.',
        'system'
      );
    }
  };

  const effectiveOwnerProfile = useMemo<UserProfile>(
    () =>
      ownerProfile || {
        isRegistered: true,
        id: sellerId,
        name: sellerBrandName || 'Lapak Saya',
        phone: '',
        email: '',
        isSeller: true,
        brandName: sellerBrandName,
        brandCity: sellerBrandCity,
      },
    [ownerProfile, sellerId, sellerBrandName, sellerBrandCity]
  );

  const myProducts = useMemo(
    () => products.filter((p) => isProductOwnedByUser(p, effectiveOwnerProfile)),
    [products, effectiveOwnerProfile]
  );

  const activeCount = myProducts.filter((p) => p.isActive !== false && p.listingStatus !== 'sold').length;
  const soldCount = myProducts.filter((p) => p.listingStatus === 'sold').length;
  const draftCount = myProducts.filter((p) => p.isActive === false).length;

  const filteredListings = myProducts.filter((p) => {
    const q = search.trim().toLowerCase();
    if (q) {
      const match =
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.subCategory || '').toLowerCase().includes(q) ||
        (p.brandCity || '').toLowerCase().includes(q);
      if (!match) return false;
    }

    if (listingTab === 'active') return p.isActive !== false && p.listingStatus !== 'sold';
    if (listingTab === 'sold') return p.listingStatus === 'sold';
    if (listingTab === 'draft') return p.isActive === false;
    return true;
  });

  const allAvailableSizeOptions = Array.from(new Set([...activeSpec.sizePresets, ...sizes]));
  const allAvailableColorOptions = Array.from(new Set([...activeSpec.colorSuggestions, ...colors]));
  const editAvailableSizeOptions = Array.from(new Set([...editSpec.sizePresets, ...editSizes]));

  return (
    <div className="space-y-8">
      {/* 1. "Jual Barang" Form Section */}
      {activeSection === 'sell' && (
        <section className="bg-white rounded-3xl border border-neutral-200/80 shadow-xs overflow-hidden">
          <div className="px-5 sm:px-7 py-4 border-b border-neutral-100 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-neutral-900">
                Jual Barang
              </h2>
              <p className="text-xs text-neutral-500">
                Pilih kategori &amp; sub-kategori — form spesifikasi menyesuaikan otomatis.
              </p>
            </div>
            {onSwitchSection && (
              <button
                type="button"
                onClick={() => onSwitchSection('listings')}
                className="px-3.5 py-2 rounded-full border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-xs font-semibold text-neutral-700 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
              >
                Lihat Listing Saya ({myProducts.length})
              </button>
            )}
          </div>

          <form onSubmit={handleCreateListing} className="p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Photos */}
            <div ref={photoBoxRef} className="lg:col-span-5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-800">
                  Foto Produk <span className="text-red-500">*</span>
                </span>
                <span className="text-[11px] text-neutral-400 tabular-nums">
                  {uploadedImages.length}/5 foto
                </span>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handlePhotoUpload}
                accept="image/*"
                multiple
                className="hidden"
              />

              {uploadedImages.length > 0 ? (
                <div className="grid grid-cols-3 gap-2.5">
                  {uploadedImages.map((imgUrl, idx) => (
                    <div
                      key={idx}
                      className={`group relative aspect-square rounded-2xl overflow-hidden border border-neutral-200 bg-neutral-100 ${
                        idx === 0 ? 'col-span-2 row-span-2' : ''
                      }`}
                    >
                      <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                      {idx === 0 ? (
                        <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/75 text-white text-[10px] font-semibold">
                          Utama
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handlePromoteUploadedPhoto(idx)}
                          title="Jadikan Foto Utama"
                          className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-white/90 hover:bg-white text-neutral-900 text-[10px] font-semibold shadow-2xs cursor-pointer"
                        >
                          Utama
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveUploadedPhoto(idx)}
                        className="absolute top-2 right-2 p-1 bg-black/70 hover:bg-neutral-900 text-white rounded-full cursor-pointer"
                        aria-label="Hapus foto"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {uploadedImages.length < 5 && (
                    <button
                      type="button"
                      disabled={isProcessingPhoto}
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-2xl border-2 border-dashed border-neutral-300 hover:border-neutral-900 bg-neutral-50 hover:bg-white flex flex-col items-center justify-center gap-1 text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Plus className="w-5 h-5" />
                      <span className="text-[11px] font-medium">
                        {isProcessingPhoto ? 'Memproses...' : 'Tambah'}
                      </span>
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  disabled={isProcessingPhoto}
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full aspect-16/10 rounded-2xl border-2 border-dashed bg-neutral-50/70 hover:bg-neutral-50 flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer p-4 disabled:opacity-60 ${
                    photoFormError
                      ? 'border-red-400 text-red-700 hover:border-red-500'
                      : 'border-neutral-300 hover:border-neutral-900 text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  <div className="w-11 h-11 rounded-2xl bg-white border border-neutral-200 flex items-center justify-center shadow-2xs">
                    <Camera className="w-5 h-5 text-neutral-700" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-neutral-800">
                      {isProcessingPhoto ? 'Memproses & mengompres foto...' : 'Unggah Foto Barang Asli'}
                    </p>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Klik untuk pilih hingga 5 foto (maks. 25MB/foto)
                    </p>
                  </div>
                </button>
              )}

              {photoFormError && (
                <p className="text-xs font-medium text-red-600 bg-red-50 border border-red-200/80 rounded-xl px-3 py-2">
                  {photoFormError}
                </p>
              )}
            </div>

            {/* Right: Grouped Category + Dynamic Adaptive Fields */}
            <div className="lg:col-span-7 space-y-4 text-xs">
              {/* Step 1: Grouped Category & Sub-Category Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-neutral-800 block mb-1.5">
                    Kategori Barang
                  </label>
                  <select
                    value={category}
                    onChange={(e) => handleCategoryChange(e.target.value as ProductCategory)}
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10 cursor-pointer"
                  >
                    <optgroup label="Fashion">
                      {FASHION_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {getCategorySpec(cat).label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Elektronik, Hobi & Umum">
                      {GENERAL_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {getCategorySpec(cat).label}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-neutral-800 block mb-1.5">
                    Sub-Kategori
                  </label>
                  <select
                    value={subCategory}
                    onChange={(e) => setSubCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10 cursor-pointer"
                  >
                    {activeSpec.subCategories.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="font-semibold text-neutral-800 block mb-1.5">
                  Judul Barang
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={activeSpec.titlePlaceholder}
                  className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                />
              </div>

              {/* Dynamic Category Specifications Card */}
              <div className="p-4 rounded-2xl bg-neutral-50/80 border border-neutral-200/80 space-y-4">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-neutral-200/70">
                  <span className="font-bold text-neutral-900">
                    Spesifikasi {activeSpec.label}
                  </span>
                  <span className="text-[11px] text-neutral-500">
                    {activeSpec.supportsSize
                      ? 'Ukuran, warna & stok'
                      : 'Warna/varian & stok'}
                  </span>
                </div>

                {/* Dynamic Multi-Select Sizes (Hidden automatically for non-fashion categories) */}
                {activeSpec.supportsSize && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="font-semibold text-neutral-700">
                        {activeSpec.sizeLabel}
                      </label>
                      <span className="text-[11px] text-neutral-500 tabular-nums">
                        {sizes.length} dipilih
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {allAvailableSizeOptions.map((sz) => {
                        const selected = sizes.includes(sz);
                        return (
                          <button
                            key={sz}
                            type="button"
                            onClick={() => handleToggleSize(sz)}
                            className={`min-w-[38px] px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer tabular-nums ${
                              selected
                                ? 'bg-neutral-900 text-white border-neutral-900 shadow-2xs'
                                : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400'
                            }`}
                          >
                            {sz}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-2 pt-0.5">
                      <input
                        type="text"
                        value={customSizeInput}
                        onChange={(e) => setCustomSizeInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddCustomSize();
                          }
                        }}
                        placeholder={
                          category === 'Sepatu'
                            ? 'Ukuran lain (mis. 42.5)'
                            : 'Ukuran kustom (mis. 3XL / 29)'
                        }
                        className="flex-1 min-w-0 px-3 py-1.5 bg-white border border-neutral-200 rounded-lg text-[11px] text-neutral-900 focus:outline-none focus:border-neutral-900"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomSize}
                        disabled={!customSizeInput.trim()}
                        className="px-3 py-1.5 rounded-lg bg-white border border-neutral-200 hover:border-neutral-900 disabled:opacity-40 text-[11px] font-semibold text-neutral-800 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                      >
                        + Tambah
                      </button>
                    </div>
                  </div>
                )}

                {/* Gender (Fashion only) & Stock */}
                <div className={`grid grid-cols-1 ${activeSpec.supportsGender ? 'sm:grid-cols-2' : ''} gap-3`}>
                  {activeSpec.supportsGender && (
                    <div>
                      <label className="font-semibold text-neutral-700 block mb-1.5">Gender</label>
                      <div className="grid grid-cols-3 gap-1 p-1 bg-white rounded-xl border border-neutral-200">
                        {GENDER_OPTIONS.map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setGender(g)}
                            className={`py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                              gender === g
                                ? 'bg-neutral-900 text-white'
                                : 'text-neutral-600 hover:text-neutral-900'
                            }`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="font-semibold text-neutral-700 block mb-1.5">
                      Jumlah Stok Tersedia
                    </label>
                    <div className="flex items-center justify-between bg-white border border-neutral-200 rounded-xl px-2 py-1">
                      <button
                        type="button"
                        onClick={() => setStock((prev) => Math.max(1, prev - 1))}
                        disabled={stock <= 1}
                        className="w-7 h-7 rounded-lg bg-neutral-100 hover:bg-neutral-200 disabled:opacity-40 font-bold text-neutral-800 cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={stock}
                        onChange={(e) => setStock(Math.max(1, Math.min(999, Number(e.target.value) || 1)))}
                        className="w-14 text-center font-bold text-neutral-900 tabular-nums focus:outline-none"
                        aria-label="Jumlah stok"
                      />
                      <button
                        type="button"
                        onClick={() => setStock((prev) => Math.min(999, prev + 1))}
                        className="w-7 h-7 rounded-lg bg-neutral-100 hover:bg-neutral-200 font-bold text-neutral-800 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Fit / Cut (Fashion categories with fit) */}
                {activeSpec.supportsFit && activeSpec.fitOptions.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="font-semibold text-neutral-700 block">
                      {activeSpec.fitLabel}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {activeSpec.fitOptions.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setFit(opt)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                            fit === opt
                              ? 'bg-neutral-900 text-white border-neutral-900'
                              : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Optional Detailed Measurements for Baju / Kemeja & Celana */}
                {activeMeasurementType === 'top' && (
                  <div className="space-y-2 pt-1 border-t border-neutral-200/70">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-neutral-700">
                        Ukuran Detail Baju / Kemeja (Opsional)
                      </label>
                      <span className="text-[11px] text-neutral-400">Satuan cm</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="text-[11px] font-medium text-neutral-600 block mb-1">
                          Panjang Baju
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="1"
                            step="0.5"
                            value={panjangBaju}
                            onChange={(e) => setPanjangBaju(e.target.value)}
                            placeholder="mis. 70"
                            className="w-full px-3 pr-9 py-2 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-900 tabular-nums focus:outline-none focus:border-neutral-900"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-neutral-400 pointer-events-none">
                            cm
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-neutral-600 block mb-1">
                          Lebar Dada
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="1"
                            step="0.5"
                            value={lebarDada}
                            onChange={(e) => setLebarDada(e.target.value)}
                            placeholder="mis. 54"
                            className="w-full px-3 pr-9 py-2 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-900 tabular-nums focus:outline-none focus:border-neutral-900"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-neutral-400 pointer-events-none">
                            cm
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-neutral-600 block mb-1">
                          Lebar Bahu
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="1"
                            step="0.5"
                            value={lebarBahu}
                            onChange={(e) => setLebarBahu(e.target.value)}
                            placeholder="mis. 46"
                            className="w-full px-3 pr-9 py-2 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-900 tabular-nums focus:outline-none focus:border-neutral-900"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-neutral-400 pointer-events-none">
                            cm
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeMeasurementType === 'bottom' && (
                  <div className="space-y-2 pt-1 border-t border-neutral-200/70">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-neutral-700">
                        Ukuran Detail Celana (Opsional)
                      </label>
                      <span className="text-[11px] text-neutral-400">Satuan cm</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="text-[11px] font-medium text-neutral-600 block mb-1">
                          Panjang Celana
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="1"
                            step="0.5"
                            value={panjangCelana}
                            onChange={(e) => setPanjangCelana(e.target.value)}
                            placeholder="mis. 100"
                            className="w-full px-3 pr-9 py-2 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-900 tabular-nums focus:outline-none focus:border-neutral-900"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-neutral-400 pointer-events-none">
                            cm
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-neutral-600 block mb-1">
                          Lebar Pinggang
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="1"
                            step="0.5"
                            value={lebarPinggang}
                            onChange={(e) => setLebarPinggang(e.target.value)}
                            placeholder="mis. 40"
                            className="w-full px-3 pr-9 py-2 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-900 tabular-nums focus:outline-none focus:border-neutral-900"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-neutral-400 pointer-events-none">
                            cm
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-neutral-600 block mb-1">
                          Open Leg
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="1"
                            step="0.5"
                            value={openLeg}
                            onChange={(e) => setOpenLeg(e.target.value)}
                            placeholder="mis. 20"
                            className="w-full px-3 pr-9 py-2 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-900 tabular-nums focus:outline-none focus:border-neutral-900"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-neutral-400 pointer-events-none">
                            cm
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Colors / Variant Tag */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-700 block">
                    {activeSpec.supportsSize ? 'Warna' : 'Warna / Varian'}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {allAvailableColorOptions.map((clr) => (
                      <button
                        key={clr}
                        type="button"
                        onClick={() => handleToggleColor(clr)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                          colors.includes(clr)
                            ? 'bg-neutral-900 text-white border-neutral-900'
                            : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400'
                        }`}
                      >
                        {clr}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 pt-0.5">
                    <input
                      type="text"
                      value={customColorInput}
                      onChange={(e) => setCustomColorInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomColor();
                        }
                      }}
                      placeholder={
                        activeSpec.supportsSize
                          ? 'Tambah warna lain (mis. Sage Green)'
                          : 'Tambah varian/warna (mis. 256GB Hitam)'
                      }
                      className="flex-1 min-w-0 px-3 py-1.5 bg-white border border-neutral-200 rounded-lg text-[11px] text-neutral-900 focus:outline-none focus:border-neutral-900"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomColor}
                      disabled={!customColorInput.trim()}
                      className="px-3 py-1.5 rounded-lg bg-white border border-neutral-200 hover:border-neutral-900 disabled:opacity-40 text-[11px] font-semibold text-neutral-800 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                    >
                      + Tambah
                    </button>
                  </div>
                </div>
              </div>

              {/* Condition & Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-neutral-800 block mb-1.5">Kondisi</label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-100 rounded-xl border border-neutral-200/70">
                    {(['Pre-loved', 'Baru'] as const).map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          setCondition(item);
                          if (item === 'Pre-loved' && stock > 1) {
                            setStock(1);
                          }
                        }}
                        className={`py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          condition === item
                            ? 'bg-white text-neutral-900 shadow-2xs'
                            : 'text-neutral-500 hover:text-neutral-800'
                        }`}
                      >
                        {item === 'Baru' ? 'Baru (Brand New)' : 'Pre-loved'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-neutral-800 block mb-1.5">Harga (Rp)</label>
                  <input
                    type="number"
                    required
                    min="1000"
                    step="1000"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-bold tabular-nums focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                  />
                </div>
              </div>

              {/* Redesigned Smart Price Hint Card (Red theme matching Jual CTA) */}
              <div className="p-4 bg-gradient-to-br from-red-50/75 via-white to-red-50/35 border border-red-200/80 rounded-2xl space-y-3.5 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-red-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <TrendingUp className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-neutral-900 truncate">
                        Patokan Harga Pasar
                      </p>
                      <p className="text-[11px] text-neutral-500 truncate">
                        {subCategory || activeSpec.label} · {condition}
                        {priceBenchmark.comparableCount > 0 && ` · ${priceBenchmark.comparableCount} pembanding`}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border whitespace-nowrap transition-colors duration-150 ${
                      priceBenchmark.positionTone === 'good'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                        : priceBenchmark.positionTone === 'high'
                          ? 'bg-amber-50 text-amber-700 border-amber-200/80'
                          : 'bg-red-50 text-red-700 border-red-200/80'
                    }`}
                  >
                    {priceBenchmark.positionLabel}
                  </span>
                </div>

                {/* Visual Range Spectrum Track */}
                <div className="space-y-1.5 pt-1">
                  <div className="relative h-2 bg-red-100/90 rounded-full overflow-visible">
                    <motion.div
                      initial={false}
                      animate={{
                        left: `${priceBenchmark.bandStartPct}%`,
                        width: `${Math.max(8, priceBenchmark.bandEndPct - priceBenchmark.bandStartPct)}%`,
                      }}
                      transition={{ duration: 0.18, ease: [0.2, 0.9, 0.2, 1] }}
                      className="absolute top-0 bottom-0 bg-gradient-to-r from-red-400/55 via-red-500/65 to-red-400/55 rounded-full"
                    />
                    <motion.div
                      initial={false}
                      animate={{ left: `${priceBenchmark.medianPct}%` }}
                      transition={{ duration: 0.18, ease: [0.2, 0.9, 0.2, 1] }}
                      className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-red-700/75"
                      title={`Ideal: Rp ${priceBenchmark.medianSuggested.toLocaleString('id-ID')}`}
                    />
                    {priceBenchmark.markerPct !== null && (
                      <motion.div
                        initial={false}
                        animate={{ left: `${priceBenchmark.markerPct}%` }}
                        transition={{ type: 'spring', stiffness: 480, damping: 32 }}
                        className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm ${
                          priceBenchmark.positionTone === 'good'
                            ? 'bg-emerald-600'
                            : priceBenchmark.positionTone === 'high'
                              ? 'bg-amber-600'
                              : 'bg-red-600'
                        }`}
                      />
                    )}
                  </div>
                </div>

                {/* Clean 3-Column Metrics + Quick Action */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-red-200/50">
                  <div className="grid grid-cols-3 gap-2 sm:gap-4 flex-1 min-w-0">
                    <div>
                      <span className="text-[10px] uppercase tracking-wide text-neutral-400 block">
                        Terendah
                      </span>
                      <span className="text-xs font-semibold text-neutral-700 tabular-nums">
                        Rp {priceBenchmark.minSuggested.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wide text-red-600 font-semibold block">
                        Ideal
                      </span>
                      <span className="text-xs font-bold text-red-700 tabular-nums">
                        Rp {priceBenchmark.medianSuggested.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wide text-neutral-400 block">
                        Tertinggi
                      </span>
                      <span className="text-xs font-semibold text-neutral-700 tabular-nums">
                        Rp {priceBenchmark.maxSuggested.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setPrice(String(priceBenchmark.medianSuggested))}
                    className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-full text-[11px] font-bold transition-all active:scale-95 shadow-xs cursor-pointer whitespace-nowrap shrink-0 tabular-nums"
                  >
                    Pakai Harga Ideal
                  </button>
                </div>
              </div>

              {/* City & Meet-up */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-neutral-800 block mb-1.5">Lokasi / Kota</label>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Contoh: Jakarta Selatan"
                      className="w-full pl-9 pr-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-neutral-800 block mb-1.5">Meet-up / COD</label>
                  <div className="flex items-center gap-2 h-[38px]">
                    <button
                      type="button"
                      onClick={() => setAllowMeetup(!allowMeetup)}
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                        allowMeetup ? 'bg-neutral-900' : 'bg-neutral-300'
                      }`}
                      aria-label="Toggle Meet-up"
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          allowMeetup ? 'translate-x-4.5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    {allowMeetup ? (
                      <input
                        type="text"
                        value={meetupArea}
                        onChange={(e) => setMeetupArea(e.target.value)}
                        placeholder={`Area COD (mis. ${city || 'Kemang'})`}
                        className="flex-1 min-w-0 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:bg-white focus:outline-none"
                      />
                    ) : (
                      <span className="text-neutral-500 text-xs">Hanya kirim kurir</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="font-semibold text-neutral-800 block mb-1.5">
                  Deskripsi Singkat
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ceritakan detail barang, minus pemakaian jika pre-loved, atau kelengkapan box/garansi..."
                  className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                />
              </div>

              {/* Submit Bar */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-neutral-100">
                <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={publishImmediately}
                    onChange={(e) => setPublishImmediately(e.target.checked)}
                    className="w-4 h-4 rounded accent-neutral-900 cursor-pointer"
                  />
                  <span className="text-xs font-medium text-neutral-700">
                    Langsung tampilkan di katalog
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={isSubmittingListing}
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-neutral-900 hover:bg-black disabled:opacity-60 text-white text-xs font-semibold rounded-full shadow-xs transition-all active:scale-[0.97] cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {isSubmittingListing
                      ? 'Menyimpan...'
                      : publishImmediately
                        ? 'Tayangkan Sekarang'
                        : 'Simpan Draft'}
                  </span>
                </button>
              </div>
            </div>
          </form>
        </section>
      )}

      {/* 2. Dedicated "Listing Saya" Section */}
      {activeSection === 'listings' && (
        <section id="seller-listings" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <h2 className="text-base sm:text-lg font-bold text-neutral-900">Listing Saya</h2>
              <span className="text-xs text-neutral-500 tabular-nums">({myProducts.length})</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1 p-1 bg-white rounded-xl border border-neutral-200/80">
                {[
                  { id: 'all' as const, label: `Semua (${myProducts.length})` },
                  { id: 'active' as const, label: `Aktif (${activeCount})` },
                  { id: 'sold' as const, label: `Terjual (${soldCount})` },
                  { id: 'draft' as const, label: `Draft (${draftCount})` },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setListingTab(t.id)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      listingTab === t.id
                        ? 'bg-neutral-900 text-white'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari listing saya..."
                  className="w-full pl-8 pr-7 py-1.5 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {onSwitchSection && (
                <button
                  type="button"
                  onClick={() => onSwitchSection('sell')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-neutral-900 hover:bg-black text-white rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Jual Barang</span>
                </button>
              )}
            </div>
          </div>

          {filteredListings.length === 0 ? (
            <div className="bg-white rounded-3xl border border-neutral-200/80 p-10 text-center space-y-3">
              <Tag className="w-8 h-8 text-neutral-300 mx-auto" />
              <p className="text-sm font-semibold text-neutral-800">Belum ada listing di tab ini</p>
              <p className="text-xs text-neutral-500">
                Mulai jual barang fashion, elektronik, buku, atau hobi Anda sekarang.
              </p>
              {onSwitchSection && (
                <button
                  type="button"
                  onClick={() => onSwitchSection('sell')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-full cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Jual Barang Sekarang</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredListings.map((p) => {
                const isVisible = p.isActive !== false;
                const status = p.listingStatus || 'available';
                const pSpec = getCategorySpec(p.category);

                return (
                  <div
                    key={p.id}
                    className="bg-white rounded-2xl border border-neutral-200/80 p-3.5 flex flex-col justify-between gap-3 hover:border-neutral-300 transition-colors"
                  >
                    <div className="flex gap-3">
                      <div className="relative w-20 h-24 rounded-xl overflow-hidden bg-neutral-100 shrink-0 border border-neutral-200/60">
                        <img src={p.image} alt={p.name} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        {!isVisible && (
                          <span className="absolute inset-x-1 bottom-1 text-center text-[9px] font-bold bg-black/75 text-white py-0.5 rounded-md">
                            Draft
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 truncate">
                          <span className="font-semibold text-neutral-700">{p.condition || 'Baru'}</span>
                          <span>·</span>
                          <span className="truncate">{p.subCategory || pSpec.label}</span>
                        </div>

                        <h4 className="text-xs font-bold text-neutral-900 line-clamp-2 leading-snug">
                          {p.name}
                        </h4>

                        <p className="text-sm font-bold text-neutral-900 tabular-nums">
                          Rp {p.price.toLocaleString('id-ID')}
                        </p>

                        <p className="text-[11px] text-neutral-500 truncate tabular-nums">
                          {pSpec.supportsSize && p.sizes && p.sizes.length > 0
                            ? `Size: ${p.sizes.join(', ')} · Stok ${p.stock}`
                            : `${pSpec.label} · Stok ${p.stock}`}
                        </p>

                        {p.brandCity && (
                          <p className="text-[11px] text-neutral-400 flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">{p.brandCity}</span>
                          </p>
                        )}
                        {status === 'reserved' && p.reservedByUserName && (
                          <p className="text-[11px] font-semibold text-amber-700 truncate">
                            Reserved: {p.reservedByUserName}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-2">
                      {onUpdateProduct ? (
                        <div className="inline-flex items-center p-0.5 bg-neutral-100 rounded-xl border border-neutral-200/70">
                          {([
                            { value: 'available', label: 'Tersedia' },
                            { value: 'reserved', label: 'Reserved' },
                            { value: 'sold', label: 'Terjual' },
                          ] as const).map((opt) => {
                            const isSelected = status === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => handleChangeListingStatus(p, opt.value)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                                  isSelected
                                    ? opt.value === 'sold'
                                      ? 'bg-neutral-900 text-white shadow-2xs'
                                      : opt.value === 'reserved'
                                        ? 'bg-amber-500 text-white shadow-2xs'
                                        : 'bg-white text-neutral-900 shadow-2xs'
                                    : 'text-neutral-500 hover:text-neutral-800'
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <span />
                      )}

                      <div className="flex items-center gap-1">
                        {onToggleActive && (
                          <button
                            type="button"
                            onClick={() => handleToggleVisibility(p, isVisible)}
                            title={isVisible ? 'Sembunyikan ke Draft' : 'Tayangkan ke Katalog'}
                            className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                              isVisible
                                ? 'border-neutral-200 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                                : 'border-neutral-300 bg-neutral-100 text-neutral-700'
                            }`}
                          >
                            {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenEdit(p)}
                          title="Edit Listing"
                          className="p-1.5 rounded-lg border border-neutral-200 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {onDeleteProduct && (
                          <button
                            type="button"
                            onClick={() => handleDeleteListing(p)}
                            title="Hapus Listing"
                            className="p-1.5 rounded-lg border border-neutral-200 text-neutral-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Edit Listing Modal (Includes Photo Manager & Adaptive Category Specs) */}
      <AnimatePresence>
        {editingProduct && (
          <motion.div
            key="edit-listing-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={AROOS_BACKDROP_TRANSITION}
            className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4"
            onClick={() => setEditingProduct(null)}
          >
            <motion.div
              key="edit-listing-modal"
              variants={AROOS_MODAL_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={AROOS_MODAL_TRANSITION}
              className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-neutral-200 p-4 sm:p-6 space-y-4 max-h-[92dvh] overflow-y-auto my-auto"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-sm font-bold text-neutral-900 truncate pr-2">
                Edit Listing &amp; Foto
              </h3>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              {/* Photo Management in Edit Modal */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-neutral-700">
                    Foto Produk ({editImages.length}/5)
                  </label>
                  <span className="text-[11px] text-neutral-400">
                    Klik bintang untuk jadikan utama
                  </span>
                </div>

                <input
                  type="file"
                  ref={editFileInputRef}
                  onChange={handleEditPhotoUpload}
                  accept="image/*"
                  multiple
                  className="hidden"
                />

                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                  {editImages.map((imgUrl, idx) => (
                    <div
                      key={`${idx}-${imgUrl.slice(0, 24)}`}
                      className={`relative aspect-square rounded-xl overflow-hidden border bg-neutral-100 ${
                        idx === 0 ? 'border-neutral-900 ring-1 ring-neutral-900/20' : 'border-neutral-200'
                      }`}
                    >
                      <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                      {idx === 0 ? (
                        <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/75 text-white text-[9px] font-semibold">
                          Utama
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handlePromoteEditPhoto(idx)}
                          title="Jadikan Foto Utama"
                          className="absolute bottom-1 left-1 p-1 rounded bg-white/90 hover:bg-white text-neutral-800 shadow-2xs cursor-pointer"
                        >
                          <Star className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveEditPhoto(idx)}
                        title="Hapus Foto"
                        className="absolute top-1 right-1 p-0.5 bg-black/70 hover:bg-neutral-900 text-white rounded-full cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  {editImages.length < 5 && (
                    <button
                      type="button"
                      disabled={isProcessingEditPhoto}
                      onClick={() => editFileInputRef.current?.click()}
                      className="aspect-square rounded-xl border-2 border-dashed border-neutral-300 hover:border-neutral-900 bg-neutral-50 hover:bg-white flex flex-col items-center justify-center gap-0.5 text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-[10px] font-semibold">
                        {isProcessingEditPhoto ? 'Memproses...' : 'Tambah'}
                      </span>
                    </button>
                  )}
                </div>

                {editPhotoError && (
                  <p className="text-[11px] font-medium text-red-600">{editPhotoError}</p>
                )}
              </div>

              <div>
                <label className="font-semibold text-neutral-700 block mb-1">Judul Barang</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">Kategori</label>
                  <select
                    value={editCategory}
                    onChange={(e) => handleEditCategoryChange(e.target.value as ProductCategory)}
                    className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900"
                  >
                    <optgroup label="Fashion">
                      {FASHION_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {getCategorySpec(cat).label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Elektronik, Hobi & Umum">
                      {GENERAL_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {getCategorySpec(cat).label}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">Sub-Kategori</label>
                  <select
                    value={editSubCategory}
                    onChange={(e) => setEditSubCategory(e.target.value)}
                    className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900"
                  >
                    {editSpec.subCategories.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dynamic Sizes (Hidden automatically for non-fashion categories) */}
              {editSpec.supportsSize && (
                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-700 block">{editSpec.sizeLabel}</label>
                  <div className="flex flex-wrap gap-1.5">
                    {editAvailableSizeOptions.map((sz) => {
                      const selected = editSizes.includes(sz);
                      return (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => {
                            setEditSizes((prev) => {
                              if (prev.includes(sz)) {
                                return prev.length === 1 ? prev : prev.filter((item) => item !== sz);
                              }
                              return [...prev, sz];
                            });
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer tabular-nums ${
                            selected
                              ? 'bg-neutral-900 text-white border-neutral-900'
                              : 'bg-neutral-50 text-neutral-700 border-neutral-200'
                          }`}
                        >
                          {sz}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={editCustomSizeInput}
                      onChange={(e) => setEditCustomSizeInput(e.target.value)}
                      placeholder="Tambah ukuran kustom"
                      className="flex-1 px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-[11px]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const clean = editCustomSizeInput.trim();
                        if (!clean) return;
                        if (!editSizes.includes(clean)) setEditSizes((p) => [...p, clean]);
                        setEditCustomSizeInput('');
                      }}
                      className="px-3 py-1.5 border border-neutral-200 rounded-lg text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0"
                    >
                      + Tambah
                    </button>
                  </div>
                </div>
              )}

              {(editSpec.supportsGender || (editSpec.supportsFit && editSpec.fitOptions.length > 0)) && (
                <div className={`grid grid-cols-1 ${editSpec.supportsGender && editSpec.supportsFit ? 'sm:grid-cols-2' : ''} gap-3`}>
                  {editSpec.supportsGender && (
                    <div>
                      <label className="font-semibold text-neutral-700 block mb-1">Gender</label>
                      <div className="grid grid-cols-3 gap-1 p-1 bg-neutral-100 rounded-xl border border-neutral-200/70">
                        {GENDER_OPTIONS.map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setEditGender(g as ProductGender)}
                            className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                              editGender === g
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

                  {editSpec.supportsFit && editSpec.fitOptions.length > 0 && (
                    <div>
                      <label className="font-semibold text-neutral-700 block mb-1">{editSpec.fitLabel}</label>
                      <select
                        value={editFit}
                        onChange={(e) => setEditFit(e.target.value)}
                        className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900"
                      >
                        {editSpec.fitOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Optional Garment Measurements in Edit Modal */}
              {editMeasurementType === 'top' && (
                <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-neutral-700">
                      Ukuran Detail Baju / Kemeja (Opsional)
                    </label>
                    <span className="text-[11px] text-neutral-400">cm</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-[11px] text-neutral-500 block mb-1">Panjang Baju</label>
                      <input
                        type="number"
                        min="1"
                        step="0.5"
                        value={editPanjangBaju}
                        onChange={(e) => setEditPanjangBaju(e.target.value)}
                        placeholder="70"
                        className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs text-neutral-900 tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-neutral-500 block mb-1">Lebar Dada</label>
                      <input
                        type="number"
                        min="1"
                        step="0.5"
                        value={editLebarDada}
                        onChange={(e) => setEditLebarDada(e.target.value)}
                        placeholder="54"
                        className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs text-neutral-900 tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-neutral-500 block mb-1">Lebar Bahu</label>
                      <input
                        type="number"
                        min="1"
                        step="0.5"
                        value={editLebarBahu}
                        onChange={(e) => setEditLebarBahu(e.target.value)}
                        placeholder="46"
                        className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs text-neutral-900 tabular-nums"
                      />
                    </div>
                  </div>
                </div>
              )}

              {editMeasurementType === 'bottom' && (
                <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-neutral-700">
                      Ukuran Detail Celana (Opsional)
                    </label>
                    <span className="text-[11px] text-neutral-400">cm</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-[11px] text-neutral-500 block mb-1">Panjang Celana</label>
                      <input
                        type="number"
                        min="1"
                        step="0.5"
                        value={editPanjangCelana}
                        onChange={(e) => setEditPanjangCelana(e.target.value)}
                        placeholder="100"
                        className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs text-neutral-900 tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-neutral-500 block mb-1">Lebar Pinggang</label>
                      <input
                        type="number"
                        min="1"
                        step="0.5"
                        value={editLebarPinggang}
                        onChange={(e) => setEditLebarPinggang(e.target.value)}
                        placeholder="40"
                        className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs text-neutral-900 tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-neutral-500 block mb-1">Open Leg</label>
                      <input
                        type="number"
                        min="1"
                        step="0.5"
                        value={editOpenLeg}
                        onChange={(e) => setEditOpenLeg(e.target.value)}
                        placeholder="20"
                        className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs text-neutral-900 tabular-nums"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">Harga (Rp)</label>
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    required
                    value={editPrice}
                    onChange={(e) => setEditPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-bold tabular-nums focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">Stok</label>
                  <input
                    type="number"
                    min="0"
                    max="999"
                    value={editStock}
                    onChange={(e) => setEditStock(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-bold tabular-nums focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">Kondisi</label>
                  <div className="grid grid-cols-2 gap-1 p-1 bg-neutral-100 rounded-xl border border-neutral-200/70">
                    {(['Pre-loved', 'Baru'] as const).map((cond) => (
                      <button
                        key={cond}
                        type="button"
                        onClick={() => setEditCondition(cond)}
                        className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                          editCondition === cond
                            ? 'bg-white text-neutral-900 shadow-2xs'
                            : 'text-neutral-600 hover:text-neutral-900'
                        }`}
                      >
                        {cond}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">Status</label>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-neutral-100 rounded-xl border border-neutral-200/70">
                    {([
                      { value: 'available', label: 'Tersedia' },
                      { value: 'reserved', label: 'Reserved' },
                      { value: 'sold', label: 'Terjual' },
                    ] as const).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          if (opt.value === 'reserved' && editingProduct) {
                            setReservedPickerTarget({ product: editingProduct, source: 'edit' });
                            return;
                          }
                          setEditListingStatus(opt.value);
                          setEditReservedByUserId('');
                          setEditReservedByUserName('');
                        }}
                        className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                          editListingStatus === opt.value
                            ? opt.value === 'sold'
                              ? 'bg-neutral-900 text-white shadow-2xs'
                              : opt.value === 'reserved'
                                ? 'bg-amber-500 text-white shadow-2xs'
                                : 'bg-white text-neutral-900 shadow-2xs'
                            : 'text-neutral-600 hover:text-neutral-900'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {editListingStatus === 'reserved' && editReservedByUserName && (
                    <p className="text-[11px] font-medium text-amber-700 mt-1">
                      Reserved oleh {editReservedByUserName}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="font-semibold text-neutral-700 block mb-1">Deskripsi</label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 text-neutral-600 hover:text-neutral-900 font-medium cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 bg-neutral-900 hover:bg-black disabled:opacity-60 text-white font-semibold rounded-full cursor-pointer whitespace-nowrap"
                >
                  {isSavingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ReservedBuyerModal
        isOpen={Boolean(reservedPickerTarget)}
        onClose={() => setReservedPickerTarget(null)}
        product={reservedPickerTarget?.product || null}
        conversations={conversations}
        preferredBuyerId={
          reservedPickerTarget?.source === 'edit'
            ? editReservedByUserId
            : reservedPickerTarget?.product?.reservedByUserId
        }
        preferredBuyerName={
          reservedPickerTarget?.source === 'edit'
            ? editReservedByUserName
            : reservedPickerTarget?.product?.reservedByUserName
        }
        onConfirmReserve={async (prod, buyer) => {
          if (reservedPickerTarget?.source === 'edit') {
            setEditListingStatus('reserved');
            setEditReservedByUserId(buyer.id || '');
            setEditReservedByUserName(buyer.name);
            return;
          }
          if (!onUpdateProduct) return;
          try {
            await onUpdateProduct(prod.id, {
              listingStatus: 'reserved',
              reservedByUserId: buyer.id || '',
              reservedByUserName: buyer.name,
              stock: Math.max(1, prod.stock || 1),
            });
            triggerToast(
              'Status Reserved Diperbarui',
              `"${prod.name}" kini di-reserve oleh ${buyer.name}.`,
              'system'
            );
          } catch (err) {
            triggerToast(
              'Gagal Memperbarui Status',
              err instanceof Error ? err.message : 'Gagal sinkronisasi ke server.',
              'system'
            );
          }
        }}
        onUnreserve={async (prod) => {
          if (reservedPickerTarget?.source === 'edit') {
            setEditListingStatus('available');
            setEditReservedByUserId('');
            setEditReservedByUserName('');
            return;
          }
          if (!onUpdateProduct) return;
          try {
            await onUpdateProduct(prod.id, {
              listingStatus: 'available',
              reservedByUserId: '',
              reservedByUserName: '',
              stock: Math.max(1, prod.stock || 1),
            });
            triggerToast('Reservasi Dibatalkan', `"${prod.name}" kini kembali tersedia.`, 'system');
          } catch (err) {
            triggerToast(
              'Gagal Membatalkan Reservasi',
              err instanceof Error ? err.message : 'Gagal sinkronisasi ke server.',
              'system'
            );
          }
        }}
      />
    </div>
  );
};
