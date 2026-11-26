import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ReportStatus, UserReport } from '../types';

const LOCAL_REPORTS_KEY = 'aroos_user_reports_v1';

function getLocalReports(): UserReport[] {
  try {
    const raw = localStorage.getItem(LOCAL_REPORTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalReports(reports: UserReport[]): void {
  try {
    localStorage.setItem(LOCAL_REPORTS_KEY, JSON.stringify(reports.slice(0, 200)));
  } catch {}
}

export async function submitUserReport(params: {
  reportedUserId: string;
  reportedUserName: string;
  reporterUserId: string;
  reporterUserName: string;
  source: 'chat' | 'storefront' | 'product';
  targetProductId?: string;
  targetProductName?: string;
  reason: string;
  details: string;
}): Promise<UserReport> {
  const nowIso = new Date().toISOString();
  const id = `rep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const entry: UserReport = {
    id,
    reportedUserId: String(params.reportedUserId || 'unknown-user').slice(0, 128),
    reportedUserName: String(params.reportedUserName || 'Pengguna AROOS').slice(0, 100),
    reporterUserId: String(params.reporterUserId).slice(0, 128),
    reporterUserName: String(params.reporterUserName || 'Pengguna AROOS').slice(0, 100),
    source: params.source,
    reason: String(params.reason).trim().slice(0, 160),
    details: String(params.details || '').trim().slice(0, 1000),
    status: 'pending',
    createdAtIso: nowIso,
    ...(params.targetProductId
      ? { targetProductId: String(params.targetProductId).slice(0, 128) }
      : {}),
    ...(params.targetProductName
      ? { targetProductName: String(params.targetProductName).slice(0, 200) }
      : {}),
  };

  saveLocalReports([entry, ...getLocalReports()]);

  try {
    await setDoc(doc(db, 'user_reports', entry.id), entry);
  } catch (err) {
    console.warn('Report saved locally:', err);
  }

  return entry;
}

export async function updateUserReportStatus(
  reportId: string,
  status: ReportStatus,
  adminNote?: string
): Promise<void> {
  const updates: Partial<UserReport> = {
    status,
    ...(adminNote !== undefined ? { adminNote: adminNote.slice(0, 400) } : {}),
    ...(status === 'resolved' ? { resolvedAt: new Date().toISOString() } : {}),
  };

  const local = getLocalReports().map((r) =>
    r.id === reportId ? { ...r, ...updates } : r
  );
  saveLocalReports(local);

  try {
    await updateDoc(doc(db, 'user_reports', reportId), updates);
  } catch (err) {
    console.warn('Report status update saved locally:', err);
  }
}

export function subscribeToUserReports(
  onUpdate: (reports: UserReport[]) => void
): () => void {
  const mergeAndEmit = (firestoreReports: UserReport[]) => {
    const map = new Map<string, UserReport>();
    getLocalReports().forEach((r) => {
      if (r && r.id) map.set(r.id, r);
    });
    firestoreReports.forEach((r) => {
      if (r && r.id) map.set(r.id, r);
    });
    const sorted = Array.from(map.values()).sort((a, b) =>
      (b.createdAtIso || b.id).localeCompare(a.createdAtIso || a.id)
    );
    saveLocalReports(sorted);
    onUpdate(sorted);
  };

  try {
    return onSnapshot(
      collection(db, 'user_reports'),
      (snapshot) => {
        const list: UserReport[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as UserReport;
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
