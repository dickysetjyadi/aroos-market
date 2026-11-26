import {
  collection,
  doc,
  setDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { LoginLogEntry } from '../types';

const LOCAL_LOGIN_LOGS_KEY = 'aroos_login_logs_v1';

function getLocalLoginLogs(): LoginLogEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_LOGIN_LOGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalLoginLogs(logs: LoginLogEntry[]): void {
  try {
    localStorage.setItem(LOCAL_LOGIN_LOGS_KEY, JSON.stringify(logs.slice(0, 300)));
  } catch {}
}

export function parseDeviceTelemetry(): {
  deviceType: 'Mobile' | 'Tablet' | 'Desktop';
  os: string;
  browser: string;
  userAgent: string;
} {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';

  let deviceType: 'Mobile' | 'Tablet' | 'Desktop' = 'Desktop';
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) {
    deviceType = 'Tablet';
  } else if (/Mobi|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    deviceType = 'Mobile';
  }

  let os = 'Tidak diketahui';
  if (/Android\s*([0-9._]*)/i.test(ua)) {
    const m = ua.match(/Android\s*([0-9._]*)/i);
    os = m?.[1] ? `Android ${m[1].replace(/_/g, '.')}` : 'Android';
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    const m = ua.match(/OS\s*([0-9_]+)/i);
    os = m?.[1] ? `iOS ${m[1].replace(/_/g, '.')}` : 'iOS';
  } else if (/Windows NT\s*([0-9.]+)/i.test(ua)) {
    const m = ua.match(/Windows NT\s*([0-9.]+)/i);
    const ver = m?.[1];
    os = ver === '10.0' ? 'Windows 10/11' : `Windows ${ver || ''}`.trim();
  } else if (/Mac OS X\s*([0-9_]+)/i.test(ua)) {
    const m = ua.match(/Mac OS X\s*([0-9_]+)/i);
    os = m?.[1] ? `macOS ${m[1].replace(/_/g, '.')}` : 'macOS';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
  }

  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/SamsungBrowser/i.test(ua)) browser = 'Samsung Internet';
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';

  return {
    deviceType,
    os: os.slice(0, 80),
    browser: browser.slice(0, 80),
    userAgent: ua.slice(0, 500),
  };
}

export async function requestGpsLocationLabel(fallbackCity: string): Promise<{
  locationLabel: string;
  latitude?: number;
  longitude?: number;
  gpsPermission: 'granted' | 'denied' | 'unavailable';
}> {
  const safeCity = (fallbackCity || 'Indonesia').trim().slice(0, 80);

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return {
      locationLabel: `${safeCity} (Fallback Profil)`,
      gpsPermission: 'unavailable',
    };
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (res: {
      locationLabel: string;
      latitude?: number;
      longitude?: number;
      gpsPermission: 'granted' | 'denied' | 'unavailable';
    }) => {
      if (settled) return;
      settled = true;
      resolve(res);
    };

    const guardTimer = window.setTimeout(() => {
      finish({
        locationLabel: `${safeCity} (Fallback Profil)`,
        gpsPermission: 'unavailable',
      });
    }, 6500);

    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          window.clearTimeout(guardTimer);
          const lat = Number(pos.coords.latitude.toFixed(5));
          const lng = Number(pos.coords.longitude.toFixed(5));
          finish({
            locationLabel: `GPS (${lat.toFixed(4)}, ${lng.toFixed(4)}) · ${safeCity}`.slice(0, 160),
            latitude: lat,
            longitude: lng,
            gpsPermission: 'granted',
          });
        },
        (err) => {
          window.clearTimeout(guardTimer);
          finish({
            locationLabel: `${safeCity} (Fallback Profil)`,
            gpsPermission: err?.code === 1 ? 'denied' : 'unavailable',
          });
        },
        {
          enableHighAccuracy: false,
          timeout: 6000,
          maximumAge: 60000,
        }
      );
    } catch {
      window.clearTimeout(guardTimer);
      finish({
        locationLabel: `${safeCity} (Fallback Profil)`,
        gpsPermission: 'unavailable',
      });
    }
  });
}

export async function recordAuthTelemetryLog(params: {
  userId: string;
  userName: string;
  userEmail: string;
  action: 'login' | 'register';
  fallbackCity?: string;
}): Promise<LoginLogEntry> {
  const telemetry = parseDeviceTelemetry();
  const gps = await requestGpsLocationLabel(params.fallbackCity || 'Indonesia');
  const nowIso = new Date().toISOString();
  const id = `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const entry: LoginLogEntry = {
    id,
    userId: String(params.userId).slice(0, 128),
    userName: String(params.userName || '').slice(0, 100),
    userEmail: String(params.userEmail || '').slice(0, 120),
    action: params.action,
    deviceType: telemetry.deviceType,
    os: telemetry.os,
    browser: telemetry.browser,
    userAgent: telemetry.userAgent,
    locationLabel: gps.locationLabel,
    gpsPermission: gps.gpsPermission,
    createdAtIso: nowIso,
    ...(typeof gps.latitude === 'number' ? { latitude: gps.latitude } : {}),
    ...(typeof gps.longitude === 'number' ? { longitude: gps.longitude } : {}),
  };

  const local = getLocalLoginLogs();
  saveLocalLoginLogs([entry, ...local]);

  try {
    await setDoc(doc(db, 'login_logs', entry.id), entry);
  } catch (err) {
    console.warn('Login log saved locally:', err);
  }

  return entry;
}

export function subscribeToLoginLogs(
  onUpdate: (logs: LoginLogEntry[]) => void
): () => void {
  const mergeAndEmit = (firestoreLogs: LoginLogEntry[]) => {
    const map = new Map<string, LoginLogEntry>();
    getLocalLoginLogs().forEach((l) => {
      if (l && l.id) map.set(l.id, l);
    });
    firestoreLogs.forEach((l) => {
      if (l && l.id) map.set(l.id, l);
    });
    const sorted = Array.from(map.values()).sort((a, b) =>
      (b.createdAtIso || b.id).localeCompare(a.createdAtIso || a.id)
    );
    saveLocalLoginLogs(sorted);
    onUpdate(sorted);
  };

  try {
    return onSnapshot(
      collection(db, 'login_logs'),
      (snapshot) => {
        const list: LoginLogEntry[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as LoginLogEntry;
          list.push({ ...data, id: docSnap.id });
        });
        mergeAndEmit(list);
      },
      () => {
        mergeAndEmit([]);
      }
    );
  } catch {
    mergeAndEmit([]);
    return () => {};
  }
}
