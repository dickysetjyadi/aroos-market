export interface IndonesianCourierOption {
  id: string;
  name: string;
  category:
    | 'Reguler & Express'
    | 'Instan & Sameday'
    | 'Kargo & Logistik'
    | 'Internasional'
    | 'Lainnya';
  aliases?: string[];
}

export const INDONESIAN_COURIERS: IndonesianCourierOption[] = [
  // Reguler & Express Nasional
  { id: 'jne-reg', name: 'JNE Express (Reguler / YES / OKE)', category: 'Reguler & Express', aliases: ['jne', 'yes', 'oke'] },
  { id: 'jnt-express', name: 'J&T Express (EZ / Super)', category: 'Reguler & Express', aliases: ['j&t', 'jnt'] },
  { id: 'sicepat', name: 'SiCepat Ekspres (REG / BEST / HALU)', category: 'Reguler & Express', aliases: ['sicepat', 'best', 'halu'] },
  { id: 'anteraja', name: 'AnterAja (Reguler / Next Day / Same Day)', category: 'Reguler & Express', aliases: ['anteraja'] },
  { id: 'spx-express', name: 'SPX Express (Shopee Express)', category: 'Reguler & Express', aliases: ['spx', 'shopee express'] },
  { id: 'ninja-xpress', name: 'Ninja Xpress', category: 'Reguler & Express', aliases: ['ninja'] },
  { id: 'id-express', name: 'ID Express', category: 'Reguler & Express', aliases: ['idx', 'id express'] },
  { id: 'lion-parcel', name: 'Lion Parcel (REGPACK / ONEPACK / JAGOPACK)', category: 'Reguler & Express', aliases: ['lion'] },
  { id: 'pos-indonesia', name: 'Pos Indonesia (Pos Reguler / Pos Nextday / Kilat)', category: 'Reguler & Express', aliases: ['pos', 'kantor pos'] },
  { id: 'tiki', name: 'TIKI (REG / ONS / TDS)', category: 'Reguler & Express', aliases: ['tiki', 'ons'] },
  { id: 'wahana', name: 'Wahana Prestasi Logistik', category: 'Reguler & Express', aliases: ['wahana'] },
  { id: 'sap-express', name: 'SAP Express Courier', category: 'Reguler & Express', aliases: ['sap'] },
  { id: 'paxel', name: 'Paxel (Sameday / Nextday Cold Chain)', category: 'Reguler & Express', aliases: ['paxel'] },
  { id: 'rpx', name: 'RPX Domestic Express', category: 'Reguler & Express', aliases: ['rpx'] },
  { id: 'first-logistics', name: 'First Logistics', category: 'Reguler & Express', aliases: ['first logistics'] },
  { id: 'ncs', name: 'NCS (Nusantara Card Semesta)', category: 'Reguler & Express', aliases: ['ncs'] },
  { id: 'pcp-express', name: 'PCP Express', category: 'Reguler & Express', aliases: ['pcp'] },
  { id: 'j-express', name: 'JX (J-Express)', category: 'Reguler & Express', aliases: ['jx', 'j-express'] },
  { id: 'lex', name: 'LEX (Lazada Express)', category: 'Reguler & Express', aliases: ['lex', 'lazada'] },
  { id: 'kgxpress', name: 'KGXpress (Kompas Gramedia Express)', category: 'Reguler & Express', aliases: ['kgx'] },
  { id: 'kurir-rekomendasi', name: 'GTL / Kurir Ritel Nasional', category: 'Reguler & Express', aliases: ['gtl'] },
  { id: 'pandu-logistics', name: 'Pandu Logistics', category: 'Reguler & Express', aliases: ['pandu'] },
  { id: 'citoxpress', name: 'CitoXpress', category: 'Reguler & Express', aliases: ['cito'] },
  { id: 'esl-express', name: 'ESL Express', category: 'Reguler & Express', aliases: ['esl'] },
  { id: 'pahala-express', name: 'Pahala Express', category: 'Reguler & Express', aliases: ['pahala'] },
  { id: 'atlas-express', name: 'Atlas Express', category: 'Reguler & Express', aliases: ['atlas'] },
  { id: 'kalibesar', name: 'Kargo Kalibesar / KBE', category: 'Reguler & Express', aliases: ['kalibesar'] },

  // Instan & Sameday
  { id: 'gosend', name: 'GoSend (Instant / SameDay)', category: 'Instan & Sameday', aliases: ['gojek', 'gosend'] },
  { id: 'grabexpress', name: 'GrabExpress (Instant / SameDay)', category: 'Instan & Sameday', aliases: ['grab', 'grabexpress'] },
  { id: 'lalamove', name: 'Lalamove (Motor / Mobil / Van)', category: 'Instan & Sameday', aliases: ['lalamove'] },
  { id: 'maxim-delivery', name: 'Maxim Delivery', category: 'Instan & Sameday', aliases: ['maxim'] },
  { id: 'indrive-courier', name: 'inDrive Kurir', category: 'Instan & Sameday', aliases: ['indrive'] },
  { id: 'borzo', name: 'Borzo (MrSpeedy)', category: 'Instan & Sameday', aliases: ['borzo', 'mrspeedy'] },
  { id: 'deliveree', name: 'Deliveree (Instant / FTL)', category: 'Instan & Sameday', aliases: ['deliveree'] },
  { id: 'bluemart-biteship', name: 'Bluebird Kirim', category: 'Instan & Sameday', aliases: ['bluebird'] },

  // Kargo & Logistik Berat
  { id: 'jne-jtr', name: 'JNE Trucking (JTR)', category: 'Kargo & Logistik', aliases: ['jtr', 'jne trucking'] },
  { id: 'jnt-cargo', name: 'J&T Cargo', category: 'Kargo & Logistik', aliases: ['j&t cargo', 'jnt cargo'] },
  { id: 'sicepat-gokil', name: 'SiCepat GOKIL (Cargo)', category: 'Kargo & Logistik', aliases: ['gokil', 'sicepat cargo'] },
  { id: 'spx-kargo', name: 'SPX Kargo', category: 'Kargo & Logistik', aliases: ['spx kargo'] },
  { id: 'sentral-cargo', name: 'Sentral Cargo', category: 'Kargo & Logistik', aliases: ['sentral'] },
  { id: 'indah-logistik', name: 'Indah Logistik Cargo', category: 'Kargo & Logistik', aliases: ['indah cargo'] },
  { id: 'dakota-cargo', name: 'Dakota Cargo', category: 'Kargo & Logistik', aliases: ['dakota'] },
  { id: 'baraka-express', name: 'Baraka Express', category: 'Kargo & Logistik', aliases: ['baraka'] },
  { id: 'rosalia-express', name: 'Rosalia Express', category: 'Kargo & Logistik', aliases: ['rosalia'] },
  { id: 'cobra-express', name: 'Cobra Express', category: 'Kargo & Logistik', aliases: ['cobra'] },
  { id: 'tam-cargo', name: 'TAM Cargo', category: 'Kargo & Logistik', aliases: ['tam'] },
  { id: 'kalog', name: 'KAI Logistik (KALOG Express)', category: 'Kargo & Logistik', aliases: ['kalog', 'kai'] },
  { id: 'herona-express', name: 'Herona Express', category: 'Kargo & Logistik', aliases: ['herona'] },
  { id: 'kib-cepat', name: 'KIB Cepat', category: 'Kargo & Logistik', aliases: ['kib'] },
  { id: 'redex', name: 'RedEx (REX Kiriman Express)', category: 'Kargo & Logistik', aliases: ['rex', 'redex'] },
  { id: 'adam-cargo', name: 'Adam Cargo', category: 'Kargo & Logistik', aliases: ['adam'] },
  { id: 'karya-indah-buana', name: 'Star Cargo', category: 'Kargo & Logistik', aliases: ['star cargo'] },
  { id: 'mitra-kargo', name: 'Maxi / Mitra Kargo Nusantara', category: 'Kargo & Logistik', aliases: ['mitra kargo'] },

  // Internasional
  { id: 'dhl-express', name: 'DHL Express', category: 'Internasional', aliases: ['dhl'] },
  { id: 'fedex', name: 'FedEx Express', category: 'Internasional', aliases: ['fedex'] },
  { id: 'ups', name: 'UPS Express', category: 'Internasional', aliases: ['ups'] },
  { id: 'aramex', name: 'Aramex', category: 'Internasional', aliases: ['aramex'] },
  { id: 'tnt', name: 'TNT Express', category: 'Internasional', aliases: ['tnt'] },
  { id: 'rayspeed', name: 'RaySpeed Asia', category: 'Internasional', aliases: ['rayspeed'] },
  { id: 'janio', name: 'Janio Asia', category: 'Internasional', aliases: ['janio'] },

  // Lainnya (Non-COD)
  { id: 'kurir-toko', name: 'Kurir Pribadi Toko (Non-COD)', category: 'Lainnya', aliases: ['kurir pribadi', 'antar sendiri'] },
  { id: 'travel-bus', name: 'Titipan Kilat Travel / Bus AKAP', category: 'Lainnya', aliases: ['travel', 'bus', 'akap'] },
];

export const NON_COD_PAYMENT_OPTIONS: { id: 'transfer_langsung' | 'qris' | 'bca_va' | 'mandiri_va' | 'bri_va' | 'bni_va' | 'gopay' | 'ovo' | 'dana' | 'shopeepay'; label: string }[] = [
  { id: 'transfer_langsung', label: 'Transfer Bank Langsung' },
  { id: 'qris', label: 'QRIS' },
  { id: 'bca_va', label: 'BCA Virtual Account' },
  { id: 'mandiri_va', label: 'Mandiri Virtual Account' },
  { id: 'bri_va', label: 'BRI Virtual Account' },
  { id: 'bni_va', label: 'BNI Virtual Account' },
  { id: 'gopay', label: 'GoPay' },
  { id: 'ovo', label: 'OVO' },
  { id: 'dana', label: 'DANA' },
  { id: 'shopeepay', label: 'ShopeePay' },
];
