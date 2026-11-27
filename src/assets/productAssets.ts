import heroLocalFashion from './images/hero_local_fashion_1792948051901.jpg';
import nordenJacketsRack from './images/norden_jackets_rack_1793259557282.jpg';
import productBatikOuter from './images/product_batik_outer_1792948052474.jpg';
import productCanvasSneakers from './images/product_canvas_sneakers_1792948053981.jpg';
import productDenimJacket from './images/product_denim_jacket_1792948053731.jpg';
import productOversizedLinen from './images/product_oversized_linen_1792948053165.jpg';
import studioHeavyweightHoodie from './images/studio_heavyweight_hoodie_1793086667293.jpg';
import studioPleatedTrouser from './images/studio_pleated_trouser_1793086667321.jpg';
import studioStreetwearCap from './images/studio_streetwear_cap_1793086667463.jpg';

export const PRODUCT_ASSETS = {
  heroLocalFashion,
  nordenJacketsRack,
  productBatikOuter,
  productCanvasSneakers,
  productDenimJacket,
  productOversizedLinen,
  studioHeavyweightHoodie,
  studioPleatedTrouser,
  studioStreetwearCap,
} as const;

const LEGACY_ASSET_MAP: Record<string, string> = {
  '/src/assets/images/hero_local_fashion_1792948051901.jpg': heroLocalFashion,
  '/src/assets/images/norden_jackets_rack_1793259557282.jpg': nordenJacketsRack,
  '/src/assets/images/product_batik_outer_1792948052474.jpg': productBatikOuter,
  '/src/assets/images/product_canvas_sneakers_1792948053981.jpg': productCanvasSneakers,
  '/src/assets/images/product_denim_jacket_1792948053731.jpg': productDenimJacket,
  '/src/assets/images/product_oversized_linen_1792948053165.jpg': productOversizedLinen,
  '/src/assets/images/studio_heavyweight_hoodie_1793086667293.jpg': studioHeavyweightHoodie,
  '/src/assets/images/studio_pleated_trouser_1793086667321.jpg': studioPleatedTrouser,
  '/src/assets/images/studio_streetwear_cap_1793086667463.jpg': studioStreetwearCap,
  // Fallbacks for legacy preset names that pointed to old demo filenames
  '/src/assets/images/product_sneakers_cream_1792948053896.jpg': productCanvasSneakers,
  '/src/assets/images/product_tenun_blazer_1792948054611.jpg': productDenimJacket,
  '/src/assets/images/product_batik_shirt_1792948055416.jpg': productBatikOuter,
  '/src/assets/images/product_linen_pants_1792948056157.jpg': studioPleatedTrouser,
};

/**
 * Resolves any legacy /src/assets/images/... literal path (e.g. from older Firestore documents)
 * to the Vite-bundled hashed asset URL so images render identically in dev and dist builds.
 */
export function resolveBundledAssetUrl(url?: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (LEGACY_ASSET_MAP[trimmed]) {
    return LEGACY_ASSET_MAP[trimmed];
  }
  const normalizedKey = trimmed.startsWith('src/assets/images/') ? `/${trimmed}` : trimmed;
  if (LEGACY_ASSET_MAP[normalizedKey]) {
    return LEGACY_ASSET_MAP[normalizedKey];
  }
  return trimmed;
}

export function resolveBundledAssetList(urls?: string[]): string[] | undefined {
  if (!Array.isArray(urls)) return undefined;
  return urls.map((u) => resolveBundledAssetUrl(u)).filter(Boolean);
}
