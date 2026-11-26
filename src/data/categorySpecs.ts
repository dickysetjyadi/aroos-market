import { Product, ProductCategory, ProductGender } from '../types';

export interface CategorySpecConfig {
  id: ProductCategory;
  label: string;
  group: 'Fashion' | 'Elektronik, Hobi & Umum';
  supportsSize: boolean;
  supportsGender: boolean;
  supportsFit: boolean;
  sizeLabel: string;
  sizePresets: string[];
  defaultSize: string;
  subCategories: string[];
  fitLabel: string;
  fitOptions: string[];
  colorSuggestions: string[];
  titlePlaceholder: string;
  priceRange: [number, number];
}

export const CATEGORY_LIST: ProductCategory[] = [
  'Atasan',
  'Outerwear',
  'Bawahan',
  'Batik & Etnik',
  'Sepatu',
  'Aksesoris',
  'Elektronik & Gadget',
  'Komputer & Laptop',
  'Buku & Majalah',
  'Sepeda & Olahraga',
  'Perlengkapan Rumah',
  'Hobi & Koleksi',
  'Kecantikan & Perawatan',
  'Otomotif & Aksesori',
];

export const GENDER_OPTIONS: ProductGender[] = ['Unisex', 'Pria', 'Wanita'];

export const PRICE_PRESETS: Array<{
  id: string;
  label: string;
  min?: number;
  max?: number;
}> = [
  { id: 'under-250', label: '< Rp 250rb', max: 250000 },
  { id: '250-500', label: 'Rp 250rb – 500rb', min: 250000, max: 500000 },
  { id: 'above-500', label: '> Rp 500rb', min: 500000 },
];

export const CATEGORY_SPEC_MAP: Record<ProductCategory, CategorySpecConfig> = {
  Atasan: {
    id: 'Atasan',
    label: 'Atasan',
    group: 'Fashion',
    supportsSize: true,
    supportsGender: true,
    supportsFit: true,
    sizeLabel: 'Ukuran Atasan',
    sizePresets: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'All Size'],
    defaultSize: 'L',
    subCategories: [
      'Kemeja & Workshirt',
      'Kaos / Tee',
      'Hoodie & Sweatshirt',
      'Polo Shirt',
      'Blus / Tunik',
    ],
    fitLabel: 'Potongan / Fit',
    fitOptions: ['Regular Fit', 'Relaxed / Boxy', 'Oversized', 'Slim Fit', 'Cropped'],
    colorSuggestions: ['Hitam', 'Putih', 'Olive', 'Navy', 'Krem', 'Abu-abu'],
    titlePlaceholder: 'Contoh: Kemeja Linen Relaxed Warna Olive Size L',
    priceRange: [140000, 320000],
  },
  Outerwear: {
    id: 'Outerwear',
    label: 'Outerwear',
    group: 'Fashion',
    supportsSize: true,
    supportsGender: true,
    supportsFit: true,
    sizeLabel: 'Ukuran Outerwear',
    sizePresets: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'All Size'],
    defaultSize: 'L',
    subCategories: [
      'Jaket Denim',
      'Jaket / Parka',
      'Blazer',
      'Cardigan / Knitwear',
      'Vest / Rompi',
    ],
    fitLabel: 'Potongan / Fit',
    fitOptions: ['Regular Fit', 'Relaxed / Boxy', 'Oversized', 'Slim Fit', 'Cropped'],
    colorSuggestions: ['Indigo Denim', 'Hitam', 'Cokelat', 'Khaki', 'Abu-abu', 'Hijau Army'],
    titlePlaceholder: 'Contoh: Jaket Denim Selvedge 14oz Kondisi 98% Size XL',
    priceRange: [280000, 620000],
  },
  Bawahan: {
    id: 'Bawahan',
    label: 'Bawahan',
    group: 'Fashion',
    supportsSize: true,
    supportsGender: true,
    supportsFit: true,
    sizeLabel: 'Ukuran Pinggang / Celana',
    sizePresets: ['27', '28', '29', '30', '31', '32', '33', '34', '36', 'S', 'M', 'L', 'XL', 'All Size'],
    defaultSize: '30',
    subCategories: [
      'Celana Panjang / Trouser',
      'Jeans / Denim',
      'Chino',
      'Kulot / Wide-Leg',
      'Celana Pendek',
      'Rok',
    ],
    fitLabel: 'Potongan / Fit',
    fitOptions: ['Wide-Leg / Baggy', 'Straight Cut', 'Slim / Tapered', 'Relaxed', 'High-Waist'],
    colorSuggestions: ['Hitam', 'Khaki', 'Indigo', 'Charcoal', 'Off White', 'Olive'],
    titlePlaceholder: 'Contoh: Pleated Wide Leg Trouser Charcoal Size 30',
    priceRange: [200000, 450000],
  },
  'Batik & Etnik': {
    id: 'Batik & Etnik',
    label: 'Batik & Etnik',
    group: 'Fashion',
    supportsSize: true,
    supportsGender: true,
    supportsFit: true,
    sizeLabel: 'Ukuran Batik & Etnik',
    sizePresets: ['S', 'M', 'L', 'XL', 'XXL', 'All Size / Oversized'],
    defaultSize: 'All Size / Oversized',
    subCategories: [
      'Kimono Outer',
      'Kemeja Batik',
      'Blus / Kebaya Modern',
      'Kain / Sarung Tenun',
      'Setelan Etnik',
    ],
    fitLabel: 'Potongan / Fit',
    fitOptions: ['Relaxed / Loose', 'Regular Fit', 'Slim Fit', 'Tailored'],
    colorSuggestions: ['Sogan Cokelat', 'Indigo', 'Sand Natural', 'Maroon', 'Hitam Emas'],
    titlePlaceholder: 'Contoh: Outer Kimono Batik Cap Sogan Laweyan All Size',
    priceRange: [240000, 580000],
  },
  Sepatu: {
    id: 'Sepatu',
    label: 'Sepatu',
    group: 'Fashion',
    supportsSize: true,
    supportsGender: true,
    supportsFit: true,
    sizeLabel: 'Ukuran Sepatu (EU)',
    sizePresets: ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'],
    defaultSize: '42',
    subCategories: [
      'Sneakers',
      'Loafers & Pantofel',
      'Boots',
      'Sandal & Slip-on',
      'Sepatu Olahraga',
    ],
    fitLabel: 'Karakter / Lebar Fit',
    fitOptions: ['True to Size (Pas)', 'Agak Sempit (Up-Size)', 'Agak Longgar', 'Wide Fit'],
    colorSuggestions: ['Putih / Cream', 'Hitam', 'Cokelat', 'Abu-abu', 'Gum / Tan', 'Navy'],
    titlePlaceholder: 'Contoh: Sneakers Kanvas Gazelle Low Cream Size 42',
    priceRange: [300000, 750000],
  },
  Aksesoris: {
    id: 'Aksesoris',
    label: 'Tas & Aksesoris',
    group: 'Fashion',
    supportsSize: true,
    supportsGender: true,
    supportsFit: false,
    sizeLabel: 'Ukuran / Dimensi',
    sizePresets: ['One Size (Adjustable)', 'Mini / Compact', 'S', 'M', 'L'],
    defaultSize: 'One Size (Adjustable)',
    subCategories: [
      'Topi / Cap',
      'Tas & Slingbag',
      'Ikat Pinggang',
      'Kacamata',
      'Jam Tangan & Dompet',
    ],
    fitLabel: 'Model / Karakter',
    fitOptions: ['Adjustable', 'Compact', 'Structured', 'Soft / Slouchy'],
    colorSuggestions: ['Hitam', 'Vintage White', 'Cokelat', 'Olive', 'Navy'],
    titlePlaceholder: 'Contoh: Slingbag Kanvas Harian Warna Hitam',
    priceRange: [95000, 280000],
  },
  'Elektronik & Gadget': {
    id: 'Elektronik & Gadget',
    label: 'Elektronik & Gadget',
    group: 'Elektronik, Hobi & Umum',
    supportsSize: false,
    supportsGender: false,
    supportsFit: false,
    sizeLabel: 'Varian',
    sizePresets: [],
    defaultSize: '',
    subCategories: [
      'Smartphone & Tablet',
      'Kamera & Lensa',
      'Audio & Headphone',
      'Smartwatch & Wearable',
      'Konsol & Gaming',
      'Aksesori Gadget',
    ],
    fitLabel: 'Tipe',
    fitOptions: [],
    colorSuggestions: ['Hitam', 'Putih / Silver', 'Abu-abu / Space Gray', 'Biru', 'Lainnya'],
    titlePlaceholder: 'Contoh: Sony WH-1000XM4 Lengkap Box Mulus 95%',
    priceRange: [450000, 2800000],
  },
  'Komputer & Laptop': {
    id: 'Komputer & Laptop',
    label: 'Komputer & Laptop',
    group: 'Elektronik, Hobi & Umum',
    supportsSize: false,
    supportsGender: false,
    supportsFit: false,
    sizeLabel: 'Varian',
    sizePresets: [],
    defaultSize: '',
    subCategories: [
      'Laptop & MacBook',
      'PC Desktop & Komponen',
      'Monitor & Layar',
      'Keyboard & Mouse',
      'Printer & Jaringan',
    ],
    fitLabel: 'Tipe',
    fitOptions: [],
    colorSuggestions: ['Space Gray', 'Silver', 'Hitam', 'Putih', 'Lainnya'],
    titlePlaceholder: 'Contoh: MacBook Air M1 8/256GB Battery Health 92%',
    priceRange: [650000, 6500000],
  },
  'Buku & Majalah': {
    id: 'Buku & Majalah',
    label: 'Buku & Majalah',
    group: 'Elektronik, Hobi & Umum',
    supportsSize: false,
    supportsGender: false,
    supportsFit: false,
    sizeLabel: 'Varian',
    sizePresets: [],
    defaultSize: '',
    subCategories: [
      'Novel & Sastra',
      'Komik & Manga',
      'Bisnis & Pengembangan Diri',
      'Buku Kuliah & Sekolah',
      'Majalah & Zine',
    ],
    fitLabel: 'Tipe',
    fitOptions: [],
    colorSuggestions: ['Softcover', 'Hardcover', 'Box Set'],
    titlePlaceholder: 'Contoh: Buku Atomic Habits Edisi Bahasa Indonesia Terawat',
    priceRange: [45000, 165000],
  },
  'Sepeda & Olahraga': {
    id: 'Sepeda & Olahraga',
    label: 'Sepeda & Olahraga',
    group: 'Elektronik, Hobi & Umum',
    supportsSize: false,
    supportsGender: false,
    supportsFit: false,
    sizeLabel: 'Varian',
    sizePresets: [],
    defaultSize: '',
    subCategories: [
      'Sepeda Lipat & Roadbike',
      'MTB & Sepeda Harian',
      'Aksesori & Helm Sepeda',
      'Alat Fitness & Yoga',
      'Raket & Bola',
    ],
    fitLabel: 'Tipe',
    fitOptions: [],
    colorSuggestions: ['Hitam', 'Putih', 'Merah', 'Biru', 'Abu-abu'],
    titlePlaceholder: 'Contoh: Sepeda Lipat 20 Inch 9 Speed Siap Gowes',
    priceRange: [350000, 2900000],
  },
  'Perlengkapan Rumah': {
    id: 'Perlengkapan Rumah',
    label: 'Perlengkapan Rumah',
    group: 'Elektronik, Hobi & Umum',
    supportsSize: false,
    supportsGender: false,
    supportsFit: false,
    sizeLabel: 'Varian',
    sizePresets: [],
    defaultSize: '',
    subCategories: [
      'Furnitur & Meja Kursi',
      'Alat Masak & Kopi',
      'Dekorasi & Lampu',
      'Elektronik Rumah Tangga',
      'Organizer & Penyimpanan',
    ],
    fitLabel: 'Tipe',
    fitOptions: [],
    colorSuggestions: ['Kayu Natural', 'Putih', 'Hitam', 'Krem', 'Abu-abu'],
    titlePlaceholder: 'Contoh: Lampu Meja Kerja Minimalis + Bohlam Warm White',
    priceRange: [120000, 680000],
  },
  'Hobi & Koleksi': {
    id: 'Hobi & Koleksi',
    label: 'Hobi & Koleksi',
    group: 'Elektronik, Hobi & Umum',
    supportsSize: false,
    supportsGender: false,
    supportsFit: false,
    sizeLabel: 'Varian',
    sizePresets: [],
    defaultSize: '',
    subCategories: [
      'Action Figure & Gunpla',
      'Alat Musik',
      'Piringan Hitam & Kaset',
      'Board Game & Kartu',
      'Kamera Analog & Film',
    ],
    fitLabel: 'Tipe',
    fitOptions: [],
    colorSuggestions: ['Original / Mint', 'Hitam', 'Multiwarna', 'Vintage'],
    titlePlaceholder: 'Contoh: Gitar Akustik Yamaha F310 + Softcase Mulus',
    priceRange: [180000, 1400000],
  },
  'Kecantikan & Perawatan': {
    id: 'Kecantikan & Perawatan',
    label: 'Kecantikan & Perawatan',
    group: 'Elektronik, Hobi & Umum',
    supportsSize: false,
    supportsGender: false,
    supportsFit: false,
    sizeLabel: 'Varian',
    sizePresets: [],
    defaultSize: '',
    subCategories: [
      'Parfum & Fragrance',
      'Skincare',
      'Makeup & Kosmetik',
      'Perawatan Rambut',
      'Alat Styling & Grooming',
    ],
    fitLabel: 'Tipe',
    fitOptions: [],
    colorSuggestions: ['Full Size', 'Travel Size', 'Refill / Baru Segel'],
    titlePlaceholder: 'Contoh: Parfum EDP 50ml Isi Masih 85% Original Box',
    priceRange: [95000, 420000],
  },
  'Otomotif & Aksesori': {
    id: 'Otomotif & Aksesori',
    label: 'Otomotif & Aksesori',
    group: 'Elektronik, Hobi & Umum',
    supportsSize: false,
    supportsGender: false,
    supportsFit: false,
    sizeLabel: 'Varian',
    sizePresets: [],
    defaultSize: '',
    subCategories: [
      'Helm & Apparel Riding',
      'Aksesori Motor',
      'Aksesori Mobil',
      'Sparepart & Ban',
      'Perawatan Kendaraan',
    ],
    fitLabel: 'Tipe',
    fitOptions: [],
    colorSuggestions: ['Hitam Doff', 'Putih', 'Abu-abu', 'Merah', 'Chrome'],
    titlePlaceholder: 'Contoh: Helm Half Face Visor Clear Size L Busa Bersih',
    priceRange: [180000, 950000],
  },
};

export function getCategorySpec(category?: ProductCategory | string): CategorySpecConfig {
  if (category && category in CATEGORY_SPEC_MAP) {
    return CATEGORY_SPEC_MAP[category as ProductCategory];
  }
  return CATEGORY_SPEC_MAP.Atasan;
}

/**
 * Returns dynamically scoped size options for the catalog filter bar
 * matching the currently selected category and active catalog products.
 */
export function getFilterSizeOptions(
  selectedCategory: 'Semua' | ProductCategory,
  products: Product[]
): string[] {
  if (selectedCategory !== 'Semua') {
    const spec = getCategorySpec(selectedCategory);
    if (!spec.supportsSize) return [];

    const extraSizes = new Set<string>();
    products
      .filter((p) => p.isActive !== false && p.category === selectedCategory)
      .forEach((p) => {
        (p.sizes || []).forEach((s) => {
          const clean = s.trim();
          if (clean && !spec.sizePresets.includes(clean)) {
            extraSizes.add(clean);
          }
        });
      });
    return [...spec.sizePresets, ...Array.from(extraSizes)];
  }

  // When 'Semua' category is active, surface ordered catalog sizes that exist on active fashion listings
  const orderedAllSizes = [
    'XS', 'S', 'M', 'L', 'XL', 'XXL', 'All Size', 'All Size / Oversized', 'One Size (Adjustable)',
    '27', '28', '29', '30', '31', '32', '33', '34', '36',
    '37', '38', '39', '40', '41', '42', '43', '44', '45', '46',
  ];
  const present = new Set<string>();
  products
    .filter((p) => p.isActive !== false && getCategorySpec(p.category).supportsSize)
    .forEach((p) => {
      (p.sizes || []).forEach((s) => {
        const clean = s.trim();
        if (clean) present.add(clean);
      });
    });

  const sortedPresent = orderedAllSizes.filter((s) => present.has(s));
  const leftovers = Array.from(present).filter((s) => !orderedAllSizes.includes(s));
  return [...sortedPresent, ...leftovers];
}

export function doesProductMatchSizeFilter(productSizes: string[], selectedSizes: string[]): boolean {
  if (selectedSizes.length === 0) return true;
  const normalizedProductSizes = (productSizes || []).map((s) => s.trim().toLowerCase());
  return selectedSizes.some((target) => {
    const t = target.trim().toLowerCase();
    return normalizedProductSizes.some(
      (ps) => ps === t || (t === 'all size' && ps.includes('all size')) || (t === 'one size' && ps.includes('one size'))
    );
  });
}

export type GarmentMeasurementGroup = 'top' | 'bottom' | null;

export function getMeasurementType(
  category: ProductCategory | string,
  subCategory?: string
): GarmentMeasurementGroup {
  const sub = (subCategory || '').toLowerCase();

  if (category === 'Atasan' || category === 'Outerwear') {
    return 'top';
  }

  if (category === 'Batik & Etnik') {
    if (sub.includes('kain') || sub.includes('sarung')) return null;
    return 'top';
  }

  if (category === 'Bawahan') {
    if (sub.includes('rok')) return null;
    return 'bottom';
  }

  return null;
}

