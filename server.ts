import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import path from 'path';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const EPHEMERAL_ADMIN_SECRET = crypto.randomBytes(32).toString('hex');

function getAdminPasswordExpected(): string {
  const envPass = process.env.SUPERADMIN_PASSWORD?.trim();
  return envPass && envPass.length > 0 ? envPass : 'password123';
}

function getAdminSigningSecret(): string {
  const envSecret = process.env.SUPERADMIN_SESSION_SECRET?.trim();
  return envSecret && envSecret.length >= 16 ? envSecret : EPHEMERAL_ADMIN_SECRET;
}

function timingSafeEqualsText(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function signAdminToken(username: string): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + 12 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ sub: username, role: 'superadmin', exp: expiresAt })).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getAdminSigningSecret())
    .update(payload)
    .digest('base64url');
  return { token: `${payload}.${sig}`, expiresAt };
}

function verifyAdminToken(token: string): { valid: boolean; sub?: string; exp?: number } {
  const parts = token.split('.');
  if (parts.length !== 2) return { valid: false };
  const [payload, sig] = parts;
  if (!payload || !sig) return { valid: false };
  const expectedSig = crypto
    .createHmac('sha256', getAdminSigningSecret())
    .update(payload)
    .digest('base64url');
  if (!timingSafeEqualsText(sig, expectedSig)) return { valid: false };
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub?: string;
      role?: string;
      exp?: number;
    };
    if (parsed.role !== 'superadmin' || typeof parsed.exp !== 'number' || parsed.exp < Date.now()) {
      return { valid: false };
    }
    return { valid: true, sub: parsed.sub, exp: parsed.exp };
  } catch {
    return { valid: false };
  }
}

interface CatalogProductInput {
  id: string;
  name: string;
  brand: string;
  itemBrand?: string;
  brandCity: string;
  category: string;
  subCategory?: string;
  gender?: string;
  fit?: string;
  price: number;
  stock: number;
  sizes: string[];
  colors: string[];
  material: string;
  condition?: string;
  listingStatus?: string;
  allowMeetup?: boolean;
  meetupArea?: string;
  description: string;
}

interface AiSearchResponsePayload {
  summary: string;
  matchedProductIds: string[];
}

const AI_CACHE_TTL_MS = 60_000;
const aiSearchCache = new Map<string, { expiresAt: number; payload: AiSearchResponsePayload }>();

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    const err = new Error('GEMINI_API_KEY belum tersedia. Periksa konfigurasi di Settings > Secrets.');
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs = 25000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error('Pencarian AI melebihi batas waktu respons. Silakan coba lagi.');
      (err as Error & { statusCode?: number }).statusCode = 504;
      reject(err);
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const AI_SEARCH_MODELS: Array<{ model: string; thinkingLevel: ThinkingLevel }> = [
  { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW },
  { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL },
];

async function generateWithRetry<T>(
  runForModel: (cfg: { model: string; thinkingLevel: ThinkingLevel }) => Promise<T>
): Promise<T> {
  let lastError: unknown;

  for (let i = 0; i < AI_SEARCH_MODELS.length; i++) {
    const modelCfg = AI_SEARCH_MODELS[i];
    try {
      return await withTimeout(runForModel(modelCfg), 12000);
    } catch (error: unknown) {
      lastError = error;
      const parsedErr = parseGeminiError(error);
      const isTransient = parsedErr.status === 503 || parsedErr.status === 429 || parsedErr.status >= 500;
      if (!isTransient) {
        throw error;
      }
      if (i < AI_SEARCH_MODELS.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
  }

  throw lastError;
}

function parseGeminiError(error: unknown): { status: number; message: string } {
  const errObj = error as { status?: number; statusCode?: number; message?: string };
  let status = errObj?.statusCode || errObj?.status || 500;
  let rawMessage = errObj?.message || 'Gagal memproses pencarian AI.';

  // @google/genai often sets error.message to a raw JSON string like {"error":{"code":503,"message":"...","status":"UNAVAILABLE"}}
  const trimmed = rawMessage.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as {
        error?: { code?: number; message?: string; status?: string };
        code?: number;
        message?: string;
        status?: string;
      };
      const nested = parsed.error || parsed;
      if (typeof nested.code === 'number') status = nested.code;
      if (typeof nested.message === 'string' && nested.message.trim()) {
        rawMessage = nested.message.trim();
      }
      if (nested.status === 'UNAVAILABLE') status = 503;
      if (nested.status === 'RESOURCE_EXHAUSTED') status = 429;
      if (nested.status === 'PERMISSION_DENIED') status = 403;
      if (nested.status === 'NOT_FOUND') status = 404;
    } catch {
      // Keep original message if JSON parsing fails
    }
  }

  const lower = rawMessage.toLowerCase();
  if (status === 503 || lower.includes('high demand') || lower.includes('unavailable')) {
    return {
      status: 503,
      message: 'Layanan AI sedang sangat sibuk karena lonjakan permintaan. Silakan coba lagi beberapa detik lagi.',
    };
  }
  if (status === 429 || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return {
      status: 429,
      message: 'Batas permintaan AI sementara tercapai. Silakan coba lagi sebentar lagi.',
    };
  }
  if (status === 401 || status === 403 || lower.includes('api_key_invalid') || lower.includes('permission_denied')) {
    return {
      status: status === 403 ? 403 : 400,
      message: 'Konfigurasi kunci API Gemini perlu diperiksa di panel Settings > Secrets.',
    };
  }
  if (status === 404 || lower.includes('not_found')) {
    return {
      status: 404,
      message: 'Model pencarian AI yang dipilih sedang tidak tersedia.',
    };
  }
  if (status === 504) {
    return {
      status: 504,
      message: 'Pencarian AI melebihi batas waktu respons. Silakan coba lagi.',
    };
  }

  return {
    status: status >= 400 && status < 600 ? status : 500,
    message: rawMessage,
  };
}

function extractJsonObject(rawText: string): Partial<AiSearchResponsePayload> {
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned) as Partial<AiSearchResponsePayload>;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as Partial<AiSearchResponsePayload>;
    }
    throw new Error('Format respons AI tidak valid.');
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '5mb' }));

  app.post('/api/ai-search', async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    try {
      const { query, products } = req.body as {
        query?: unknown;
        products?: unknown;
      };

      if (typeof query !== 'string' || !query.trim()) {
        res.status(400).json({ error: 'Masukkan kata kunci atau deskripsi pencarian terlebih dahulu.' });
        return;
      }

      const trimmedQuery = query.trim().slice(0, 500);
      const catalog: CatalogProductInput[] = Array.isArray(products) ? products : [];

      if (catalog.length === 0) {
        res.json({
          summary: 'Katalog sedang kosong sehingga belum ada produk yang dapat dicocokkan.',
          matchedProductIds: [],
        });
        return;
      }

      const wantsSold = /\b(sold|habis|terjual)\b/i.test(trimmedQuery);
      const candidateCatalog = wantsSold
        ? catalog
        : catalog.filter((item) => item.stock > 0 && item.listingStatus !== 'sold');

      if (candidateCatalog.length === 0) {
        res.json({
          summary: `Saat ini tidak ada produk tersedia yang cocok dengan pencarian "${trimmedQuery}".`,
          matchedProductIds: [],
        });
        return;
      }

      // Ultra-compact catalog payload for minimal token latency and high precision
      const compactCatalog = candidateCatalog.map((item) => {
        const entry: Record<string, unknown> = {
          id: item.id,
          name: item.name,
          brand: item.brand,
          city: item.brandCity,
          cat: item.category,
          priceIDR: item.price,
          sizes: Array.isArray(item.sizes) ? item.sizes : [],
          colors: Array.isArray(item.colors) ? item.colors : [],
          mat: item.material,
          cond: item.condition || 'Baru',
          desc: (item.description || '').slice(0, 90),
        };
        if (item.subCategory) entry.sub = item.subCategory;
        if (item.gender) entry.gender = item.gender;
        if (item.fit) entry.fit = item.fit;
        if (item.itemBrand) entry.itemBrand = item.itemBrand;
        if (item.listingStatus === 'reserved') entry.status = 'reserved';
        if (item.allowMeetup) entry.cod = item.meetupArea || item.brandCity;
        if (wantsSold) entry.stock = item.stock;
        return entry;
      });

      const cacheKey = `${trimmedQuery.toLowerCase()}::${compactCatalog
        .map((c) => `${c.id}:${c.priceIDR}:${c.cond}`)
        .join('|')}`;
      const cached = aiSearchCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        res.json(cached.payload);
        return;
      }

      const ai = getGeminiClient();

      const prompt = `Query: "${trimmedQuery}"\nCatalog:${JSON.stringify(compactCatalog)}`;

      const response = await generateWithRetry(({ model, thinkingLevel }) =>
        ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            thinkingConfig: { thinkingLevel },
            systemInstruction: [
              'Mesin pencari katalog fashion AROOS Indonesia yang cepat dan presisi.',
              'Cocokkan query pembeli dengan JSON katalog secara KETAT (logika AND untuk semua syarat):',
              '1. Harga: "rb/ribu/k"=x1000, "jt/juta"=x1000000. under/dibawah X => priceIDR < X; maks/maksimal/budget X => priceIDR <= X; diatas/minimal X => priceIDR >= X.',
              '2. Sinonim: sepatu=sneakers/loafers, outer/jaket=kimono/blazer/hoodie, atasan=kemeja/kaos/workshirt/hoodie, bawahan=celana/trouser/kulot, topi=cap, bekas/second/thrift=Pre-loved.',
              '3. Setiap syarat (kategori, ukuran, harga, kondisi, kota, warna, COD) wajib terpenuhi. Jika tidak ada yang cocok, kembalikan [].',
              '4. Urutkan matchedProductIds dari paling relevan. Summary 1-2 kalimat Bahasa Indonesia natural tanpa markdown.',
            ].join('\n'),
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: {
                  type: Type.STRING,
                  description: 'Ringkasan singkat hasil pencarian dalam Bahasa Indonesia (1-2 kalimat, plain text).',
                },
                matchedProductIds: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'ID produk yang memenuhi semua syarat query, urut paling relevan.',
                },
              },
              required: ['summary', 'matchedProductIds'],
            },
          },
        })
      );

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({ error: 'Respons pencarian AI kosong. Silakan coba lagi.' });
        return;
      }

      const parsed = extractJsonObject(rawText);
      const validIds = new Set(candidateCatalog.map((p) => p.id));
      let matchedProductIds = Array.isArray(parsed.matchedProductIds)
        ? Array.from(
            new Set(parsed.matchedProductIds.filter((id): id is string => typeof id === 'string' && validIds.has(id)))
          )
        : [];

      // Graceful fallback: if random query yields 0 AI matches, match products containing query tokens or show popular items
      if (matchedProductIds.length === 0 && candidateCatalog.length > 0) {
        const queryTokens = trimmedQuery.toLowerCase().split(/\s+/).filter(t => t.length > 1);
        const tokenMatched = candidateCatalog.filter(p => {
          const text = `${p.name} ${p.brand} ${p.category} ${p.subCategory || ''} ${p.material || ''}`.toLowerCase();
          return queryTokens.some(token => text.includes(token));
        });
        if (tokenMatched.length > 0) {
          matchedProductIds = tokenMatched.slice(0, 8).map(p => p.id);
        } else {
          matchedProductIds = candidateCatalog.slice(0, 6).map(p => p.id);
        }
      }

      const summary =
        typeof parsed.summary === 'string' && parsed.summary.trim()
          ? parsed.summary.trim()
          : matchedProductIds.length > 0
            ? `Ditemukan ${matchedProductIds.length} produk yang sesuai dengan pencarian "${trimmedQuery}".`
            : `Tidak ditemukan produk yang cocok dengan kriteria "${trimmedQuery}".`;

      const payload: AiSearchResponsePayload = { summary, matchedProductIds };
      aiSearchCache.set(cacheKey, { expiresAt: Date.now() + AI_CACHE_TTL_MS, payload });
      if (aiSearchCache.size > 100) {
        const firstKey = aiSearchCache.keys().next().value;
        if (firstKey) aiSearchCache.delete(firstKey);
      }

      res.json(payload);
    } catch (error: unknown) {
      const formatted = parseGeminiError(error);
      console.error('[/api/ai-search] error:', error);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Superadmin authentication endpoint (server-verified, no client secrets)
  app.post('/api/admin/login', (req: Request, res: Response) => {
    const body = (req.body || {}) as { identifier?: unknown; password?: unknown };
    const identifier = typeof body.identifier === 'string' ? body.identifier.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!identifier || !password) {
      res.status(400).json({ error: 'Username dan kata sandi wajib diisi.' });
      return;
    }

    if (identifier !== 'admin' || !timingSafeEqualsText(password, getAdminPasswordExpected())) {
      res.status(401).json({ error: 'Kredensial Superadmin tidak valid.' });
      return;
    }

    const { token, expiresAt } = signAdminToken('admin');
    res.json({
      token,
      expiresAt,
      admin: {
        id: 'superadmin-root',
        name: 'Superadmin AROOS',
        username: 'admin',
      },
    });
  });

  app.get('/api/admin/verify', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      res.status(401).json({ valid: false, error: 'Token tidak ditemukan.' });
      return;
    }
    const result = verifyAdminToken(token);
    if (!result.valid) {
      res.status(401).json({ valid: false, error: 'Sesi Superadmin tidak valid atau kedaluwarsa.' });
      return;
    }
    res.json({ valid: true, username: result.sub, expiresAt: result.exp });
  });

  // Never let unknown /api/* routes fall through to SPA HTML fallback
  app.all('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint API tidak ditemukan.' });
  });

  // Ensure Express body-parser / middleware errors on /api/* always emit JSON instead of HTML
  app.use('/api', (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const errObj = err as { status?: number; statusCode?: number; message?: string };
    const status = errObj?.statusCode || errObj?.status || 500;
    res.status(status >= 400 && status < 600 ? status : 500).json({
      error: errObj?.message || 'Terjadi kesalahan pada server API.',
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
