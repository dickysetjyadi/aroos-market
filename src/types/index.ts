export type ProductGender = 'Pria' | 'Wanita' | 'Unisex';

export type ProductCategory =
  | 'Atasan'
  | 'Outerwear'
  | 'Bawahan'
  | 'Batik & Etnik'
  | 'Sepatu'
  | 'Aksesoris'
  | 'Elektronik & Gadget'
  | 'Komputer & Laptop'
  | 'Buku & Majalah'
  | 'Sepeda & Olahraga'
  | 'Perlengkapan Rumah'
  | 'Hobi & Koleksi'
  | 'Kecantikan & Perawatan'
  | 'Otomotif & Aksesori';

export interface GarmentMeasurements {
  panjangBaju?: number;
  lebarDada?: number;
  lebarBahu?: number;
  panjangCelana?: number;
  lebarPinggang?: number;
  openLeg?: number;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  itemBrand?: string;
  brandCity: string;
  category: ProductCategory;
  subCategory?: string;
  gender?: ProductGender;
  fit?: string;
  measurements?: GarmentMeasurements;
  price: number;
  originalPrice?: number;
  stock: number;
  sku: string;
  barcode: string;
  sizes: string[];
  colors: string[];
  material?: string;
  image: string;
  images?: string[];
  condition?: 'Baru' | 'Pre-loved';
  listingStatus?: 'available' | 'reserved' | 'sold';
  reservedByUserId?: string;
  reservedByUserName?: string;
  likesCount?: number;
  allowMeetup?: boolean;
  meetupArea?: string;
  description: string;
  rating: number;
  reviewsCount: number;
  verifiedBrand: boolean;
  isFeatured?: boolean;
  sellerId?: string;
  sellerBrandName?: string;
  sellerAvatar?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Review {
  id: string;
  productId: string;
  author: string;
  city: string;
  rating: number;
  comment: string;
  sizePurchased: string;
  fitFeedback: 'Pas' | 'Agak Kecil' | 'Agak Longgar';
  verifiedPurchase: boolean;
  date: string;
  helpfulCount: number;
  images?: string[];
  userStats?: string;
  createdAtIso?: string;
}

export interface ChatProductContext {
  id: string;
  name: string;
  price: number;
  image: string;
  brand: string;
  sellerId?: string;
  status?: 'Tersedia' | 'Sold Out' | 'Nego';
}

export type OfferStatus = 'accepted' | 'pending' | 'rejected' | 'countered';

export type ChatMessageType =
  | 'text'
  | 'offer'
  | 'counter_offer'
  | 'offer_response'
  | 'system'
  | 'image'
  | 'address'
  | 'deal';

export interface ChatMessage {
  id: string;
  conversationId?: string;
  sender: 'user' | 'store' | 'system';
  senderId?: string;
  senderName?: string;
  storeId: string;
  storeName: string;
  text: string;
  timestamp: string;
  image?: string;
  isRead?: boolean;
  messageType?: ChatMessageType;
  offerAmount?: number;
  counterAmount?: number;
  offerStatus?: OfferStatus;
  productContext?: ChatProductContext;
  createdAtIso?: string;
}

export interface ChatConversation {
  id: string;
  storeId: string;
  storeName: string;
  storeAvatar?: string;
  buyerId?: string;
  buyerName?: string;
  buyerPhone?: string;
  buyerCity?: string;
  buyerAddress?: string;
  sellerId?: string;
  isVerified?: boolean;
  onlineStatus?: string;
  buyerTypingAt?: number;
  sellerTypingAt?: number;

  product: ChatProductContext;
  offerStatus?: OfferStatus | null;
  offeredPrice?: number;
  counterPrice?: number;
  offerUpdatedBy?: 'buyer' | 'seller';
  itemStatus?: 'Tersedia' | 'Sold Out' | 'Pending';
  dealOrderId?: string;

  lastMessage: string;
  lastTimestamp: string;
  unreadCount: number;
  buyerUnreadCount?: number;
  sellerUnreadCount?: number;
  isPinned?: boolean;
  pinnedAt?: number;
  hiddenBy?: string[];
  createdAtIso?: string;
  updatedAtIso?: string;
}

export type PaymentMethod =
  | 'chat_direct'
  | 'cod'
  | 'transfer_langsung'
  | 'qris'
  | 'bca_va'
  | 'mandiri_va'
  | 'bri_va'
  | 'bni_va'
  | 'gopay'
  | 'ovo'
  | 'dana'
  | 'shopeepay';

export type OrderStatus = 'menunggu_pembayaran' | 'diproses' | 'dikirim' | 'selesai';

export interface OrderItem {
  productId: string;
  productName: string;
  brand: string;
  sellerId?: string;
  sellerBrandName?: string;
  price: number;
  quantity: number;
  size: string;
  color: string;
  image: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  buyerId?: string;
  buyerName?: string;
  buyerEmail?: string;
  sellerId?: string;
  sellerBrandName?: string;
  customerName: string;
  customerPhone: string;
  customerCity: string;
  customerAddress: string;
  items: OrderItem[];
  totalAmount: number;
  shippingFee: number;
  courier: string;
  paymentMethod: PaymentMethod;
  paymentStatus: 'paid' | 'pending';
  orderStatus: OrderStatus;
  buyerConfirmedAt?: string;
  negotiatedFromOffer?: boolean;
  trackingNumber: string;
  createdAt: string;
  createdAtIso?: string;
}

export interface SocialSyncConfig {
  id: 'instagram' | 'tiktok' | 'whatsapp';
  platformName: string;
  accountHandle: string;
  connected: boolean;
  autoSync: boolean;
  lastSyncedAt: string;
  syncedProductsCount: number;
  status: 'synced' | 'syncing' | 'paused';
}

export interface SubscriptionPlan {
  id: 'starter' | 'pro' | 'atelier';
  name: string;
  subtitle: string;
  priceMonthly: number;
  adminFee: 0;
  productLimitText: string;
  maxProducts: number;
  features: string[];
  isPopular?: boolean;
}

export type UserRole = 'buyer' | 'seller';
export type AccountStatus = 'active' | 'blocked' | 'banned';

export interface BuyerProfile {
  address?: string;
  city?: string;
  postalCode?: string;
  savedAddresses?: string[];
  totalOrdersCount?: number;
}

export interface SellerProfile {
  brandName: string;
  brandCity: string;
  brandDescription?: string;
  planId: 'starter' | 'pro' | 'atelier';
  registeredAt: string;
  verifiedBrand: boolean;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  phone?: string;
  password?: string;
  roles: UserRole[];
  activeRole: UserRole;
  accountStatus?: AccountStatus;
  statusReason?: string;
  statusUpdatedAt?: string;
  buyerProfile?: BuyerProfile;
  sellerProfile?: SellerProfile;
  createdAt: string;
  updatedAt?: string;
}

export interface UserProfile {
  isRegistered: boolean;
  name: string;
  avatarUrl?: string;
  phone: string;
  email: string;
  isSeller: boolean;
  brandName?: string;
  brandCity?: string;
  id?: string;
  roles?: UserRole[];
  activeRole?: UserRole;
  accountStatus?: AccountStatus;
  statusReason?: string;
  buyerProfile?: BuyerProfile;
  sellerProfile?: SellerProfile;
}

export interface NotificationItem {
  id: string;
  type: 'order' | 'low_stock' | 'social_sync' | 'system' | 'chat';
  title: string;
  message: string;
  time: string;
  read: boolean;
  actionUrl?: string;
  recipientUserId?: string;
  recipientBrandName?: string;
  orderId?: string;
  targetRole?: 'buyer' | 'seller';
  createdAtIso?: string;
}

export interface UserPresence {
  userId: string;
  isOnline: boolean;
  lastActiveAt: number;
  updatedAtIso: string;
}

export interface LoginLogEntry {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: 'login' | 'register';
  deviceType: 'Mobile' | 'Tablet' | 'Desktop';
  os: string;
  browser: string;
  userAgent: string;
  locationLabel: string;
  latitude?: number;
  longitude?: number;
  gpsPermission: 'granted' | 'denied' | 'unavailable';
  createdAtIso: string;
}

export type ReportStatus = 'pending' | 'reviewed' | 'resolved';

export interface UserReport {
  id: string;
  reportedUserId: string;
  reportedUserName: string;
  reporterUserId: string;
  reporterUserName: string;
  source: 'chat' | 'storefront' | 'product';
  targetProductId?: string;
  targetProductName?: string;
  reason: string;
  details: string;
  status: ReportStatus;
  adminNote?: string;
  createdAtIso: string;
  resolvedAt?: string;
}
