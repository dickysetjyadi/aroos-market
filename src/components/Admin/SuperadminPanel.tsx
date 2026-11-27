import React, { useMemo, useState } from 'react';
import {
  Shield, Users, Activity, Flag, Package, ShoppingBag,
  Search, Plus, Edit3, KeyRound, Ban, Lock, Unlock,
  Trash2, MapPin, Smartphone, Monitor, Tablet, LogOut,
  CheckCircle2, ExternalLink, X, Eye, EyeOff, Loader2,
} from 'lucide-react';
import {
  AccountStatus,
  LoginLogEntry,
  Order,
  Product,
  ReportStatus,
  UserAccount,
  UserPresence,
  UserReport,
} from '../../types';
import {
  adminCreateUser,
  adminDeleteUser,
  adminResetUserPassword,
  adminSetUserStatus,
  adminUpdateUser,
} from '../../services/adminService';
import { updateUserReportStatus } from '../../services/reportService';
import { formatPresenceLabel } from '../../services/presenceService';
import { useConfirm } from '../ConfirmDialogContext';

interface SuperadminPanelProps {
  onLogout: () => void;
  users: UserAccount[];
  loginLogs: LoginLogEntry[];
  reports: UserReport[];
  products: Product[];
  orders: Order[];
  presences: Record<string, UserPresence>;
  onToggleProductActive: (productId: string, active: boolean) => void;
  onDeleteProduct: (productId: string) => void;
  onTriggerToast?: (title: string, message: string, type?: 'system' | 'order') => void;
}

type AdminTab = 'overview' | 'users' | 'logs' | 'reports' | 'moderation';

function formatShortDateTime(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const SuperadminPanel: React.FC<SuperadminPanelProps> = ({
  onLogout,
  users,
  loginLogs,
  reports,
  products,
  orders,
  presences,
  onToggleProductActive,
  onDeleteProduct,
  onTriggerToast,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const confirm = useConfirm();

  const handleLogoutClick = async () => {
    const ok = await confirm({
      title: 'Keluar Superadmin',
      message: 'Apakah Anda yakin ingin mengakhiri sesi Superadmin?',
      confirmLabel: 'Ya, Keluar',
      tone: 'danger',
    });
    if (!ok) return;
    onLogout();
  };

  // Users filters & modals
  const [userSearch, setUserSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | AccountStatus>('all');
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);

  // User form fields (create/edit)
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCity, setFormCity] = useState('Jakarta Selatan');
  const [formAddress, setFormAddress] = useState('');
  const [formBrandName, setFormBrandName] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formStatus, setFormStatus] = useState<AccountStatus>('active');
  const [userFormError, setUserFormError] = useState('');
  const [isSavingUser, setIsSavingUser] = useState(false);

  // Reset Password Modal
  const [resetTargetUser, setResetTargetUser] = useState<UserAccount | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Block / Ban Reason Modal
  const [statusModalTarget, setStatusModalTarget] = useState<{
    user: UserAccount;
    nextStatus: AccountStatus;
  } | null>(null);
  const [statusReasonInput, setStatusReasonInput] = useState('');

  // Inline Delete Confirm
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null);
  const [confirmDeleteProductId, setConfirmDeleteProductId] = useState<string | null>(null);

  // Logs filter
  const [logSearch, setLogSearch] = useState('');
  const [logDeviceFilter, setLogDeviceFilter] = useState<'all' | 'Mobile' | 'Tablet' | 'Desktop'>('all');

  // Reports filter
  const [reportFilter, setReportFilter] = useState<'all' | ReportStatus>('all');

  // Moderation subtab
  const [modSubTab, setModSubTab] = useState<'products' | 'orders'>('products');
  const [modSearch, setModSearch] = useState('');

  const stats = useMemo(() => {
    const activeUsers = users.filter((u) => (u.accountStatus || 'active') === 'active').length;
    const blockedUsers = users.filter((u) => u.accountStatus === 'blocked').length;
    const bannedUsers = users.filter((u) => u.accountStatus === 'banned').length;
    const pendingReports = reports.filter((r) => r.status === 'pending').length;
    const todayKey = new Date().toISOString().split('T')[0];
    const loginsToday = loginLogs.filter((l) => l.createdAtIso?.startsWith(todayKey)).length;
    return {
      totalUsers: users.length,
      activeUsers,
      blockedUsers,
      bannedUsers,
      pendingReports,
      loginsToday,
      totalProducts: products.length,
      totalOrders: orders.length,
    };
  }, [users, reports, loginLogs, products, orders]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return users.filter((u) => {
      const status = u.accountStatus || 'active';
      if (userStatusFilter !== 'all' && status !== userStatusFilter) return false;
      if (!q) return true;
      const hay = `${u.name} ${u.email} ${u.phone || ''} ${u.sellerProfile?.brandName || ''} ${u.buyerProfile?.city || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [users, userSearch, userStatusFilter]);

  const filteredLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    return loginLogs.filter((l) => {
      if (logDeviceFilter !== 'all' && l.deviceType !== logDeviceFilter) return false;
      if (!q) return true;
      const hay = `${l.userName} ${l.userEmail} ${l.os} ${l.browser} ${l.locationLabel}`.toLowerCase();
      return hay.includes(q);
    });
  }, [loginLogs, logSearch, logDeviceFilter]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => reportFilter === 'all' || r.status === reportFilter);
  }, [reports, reportFilter]);

  const filteredProducts = useMemo(() => {
    const q = modSearch.trim().toLowerCase();
    return products.filter((p) => {
      if (!q) return true;
      return `${p.name} ${p.sellerBrandName || p.brand} ${p.category}`.toLowerCase().includes(q);
    });
  }, [products, modSearch]);

  const filteredOrders = useMemo(() => {
    const q = modSearch.trim().toLowerCase();
    return orders.filter((o) => {
      if (!q) return true;
      return `${o.orderNumber} ${o.customerName} ${o.sellerBrandName || ''} ${o.trackingNumber || ''}`
        .toLowerCase()
        .includes(q);
    });
  }, [orders, modSearch]);

  const openAddModal = () => {
    setEditingUser(null);
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormCity('Jakarta Selatan');
    setFormAddress('');
    setFormBrandName('');
    setFormPassword('');
    setFormStatus('active');
    setUserFormError('');
    setIsAddUserOpen(true);
  };

  const openEditModal = (u: UserAccount) => {
    setEditingUser(u);
    setFormName(u.name || '');
    setFormEmail(u.email || '');
    setFormPhone(u.phone || '');
    setFormCity(u.buyerProfile?.city || u.sellerProfile?.brandCity || 'Jakarta Selatan');
    setFormAddress(u.buyerProfile?.address || '');
    setFormBrandName(u.sellerProfile?.brandName || u.name || '');
    setFormPassword('');
    setFormStatus(u.accountStatus || 'active');
    setUserFormError('');
    setIsAddUserOpen(true);
  };

  const handleSaveUserForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError('');
    if (!formName.trim() || !formEmail.trim()) {
      setUserFormError('Nama dan email wajib diisi.');
      return;
    }
    if (!editingUser && formPassword.trim().length < 4) {
      setUserFormError('Kata sandi minimal 4 karakter untuk akun baru.');
      return;
    }

    setIsSavingUser(true);
    try {
      if (editingUser) {
        await adminUpdateUser(editingUser, {
          name: formName,
          email: formEmail,
          phone: formPhone,
          city: formCity,
          address: formAddress,
          brandName: formBrandName || formName,
          accountStatus: formStatus,
          ...(formPassword.trim() ? { password: formPassword.trim() } : {}),
        });
        onTriggerToast?.('User Diperbarui', `Data ${formName.trim()} berhasil disimpan.`, 'system');
      } else {
        await adminCreateUser({
          name: formName,
          email: formEmail,
          phone: formPhone,
          city: formCity,
          address: formAddress,
          brandName: formBrandName || formName,
          password: formPassword.trim(),
          accountStatus: formStatus,
        });
        onTriggerToast?.('User Ditambahkan', `Akun ${formName.trim()} berhasil dibuat.`, 'system');
      }
      setIsAddUserOpen(false);
    } catch {
      setUserFormError('Gagal menyimpan data pengguna.');
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleSubmitResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser || newPasswordInput.trim().length < 4) return;
    setIsSavingUser(true);
    try {
      await adminResetUserPassword(resetTargetUser, newPasswordInput.trim());
      onTriggerToast?.(
        'Kata Sandi Direset',
        `Sandi baru untuk ${resetTargetUser.name} berhasil diperbarui.`,
        'system'
      );
      setResetTargetUser(null);
      setNewPasswordInput('');
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleSubmitStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModalTarget) return;
    setIsSavingUser(true);
    try {
      await adminSetUserStatus(
        statusModalTarget.user,
        statusModalTarget.nextStatus,
        statusReasonInput.trim()
      );
      const label =
        statusModalTarget.nextStatus === 'blocked'
          ? 'Diblokir'
          : statusModalTarget.nextStatus === 'banned'
            ? 'Dibanned'
            : 'Diaktifkan';
      onTriggerToast?.(
        `Status User ${label}`,
        `Akun ${statusModalTarget.user.name} kini ${label.toLowerCase()}.`,
        'system'
      );
      setStatusModalTarget(null);
      setStatusReasonInput('');
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleModerateReportAccount = async (
    report: UserReport,
    nextStatus: 'blocked' | 'banned'
  ) => {
    const targetUser = users.find((u) => u.id === report.reportedUserId);
    if (!targetUser) {
      onTriggerToast?.('Akun Tidak Ditemukan', 'User mungkin sudah dihapus.', 'system');
      return;
    }
    await adminSetUserStatus(targetUser, nextStatus, report.reason);
    await updateUserReportStatus(
      report.id,
      'resolved',
      `Tindakan: Akun ${nextStatus === 'banned' ? 'dibanned permanen' : 'diblokir'}`
    );
    onTriggerToast?.(
      nextStatus === 'banned' ? 'User Dibanned' : 'User Diblokir',
      `${targetUser.name} telah ${nextStatus === 'banned' ? 'dibanned' : 'diblokir'} dari laporan.`,
      'system'
    );
  };

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'overview', label: 'Ringkasan', icon: <Shield className="w-4 h-4 shrink-0" /> },
    { id: 'users', label: 'Pengguna', icon: <Users className="w-4 h-4 shrink-0" />, badge: users.length },
    { id: 'logs', label: 'Log Login', icon: <Activity className="w-4 h-4 shrink-0" />, badge: loginLogs.length },
    {
      id: 'reports',
      label: 'Laporan',
      icon: <Flag className="w-4 h-4 shrink-0" />,
      badge: stats.pendingReports > 0 ? stats.pendingReports : undefined,
    },
    { id: 'moderation', label: 'Moderasi', icon: <Package className="w-4 h-4 shrink-0" /> },
  ];

  return (
    <div className="min-h-screen bg-[#f5f5f4] text-neutral-900 flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-neutral-950 text-white border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-white text-neutral-950 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-extrabold tracking-tight truncate">
                AROOS Superadmin
              </p>
              <p className="text-[10px] text-neutral-400 truncate">
                Panel Kontrol Pengguna &amp; Keamanan
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogoutClick}
            className="min-h-[38px] px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>

        {/* Horizontal scrollable mobile-first navigation tabs */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 pb-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  active
                    ? 'bg-white text-neutral-950'
                    : 'bg-neutral-900 text-neutral-300 hover:text-white hover:bg-neutral-800'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums ${
                      tab.id === 'reports'
                        ? 'bg-red-600 text-white'
                        : active
                          ? 'bg-neutral-200 text-neutral-900'
                          : 'bg-neutral-800 text-neutral-300'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3.5 sm:px-6 py-4 sm:py-6 space-y-5">
        {activeTab === 'overview' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-1">
                <p className="text-[11px] font-medium text-neutral-500">Total User</p>
                <p className="text-2xl font-extrabold tabular-nums text-neutral-900">
                  {stats.totalUsers}
                </p>
                <p className="text-[11px] text-emerald-700 font-medium tabular-nums">
                  {stats.activeUsers} aktif
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-1">
                <p className="text-[11px] font-medium text-neutral-500">Diblokir / Banned</p>
                <p className="text-2xl font-extrabold tabular-nums text-red-600">
                  {stats.blockedUsers + stats.bannedUsers}
                </p>
                <p className="text-[11px] text-neutral-500 tabular-nums">
                  {stats.blockedUsers} blokir · {stats.bannedUsers} banned
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-1">
                <p className="text-[11px] font-medium text-neutral-500">Laporan Masuk</p>
                <p className="text-2xl font-extrabold tabular-nums text-amber-600">
                  {stats.pendingReports}
                </p>
                <p className="text-[11px] text-neutral-500 tabular-nums">
                  {reports.length} total laporan
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-1">
                <p className="text-[11px] font-medium text-neutral-500">Log Login Hari Ini</p>
                <p className="text-2xl font-extrabold tabular-nums text-neutral-900">
                  {stats.loginsToday}
                </p>
                <p className="text-[11px] text-neutral-500 tabular-nums">
                  {stats.totalProducts} listing · {stats.totalOrders} pesanan
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Pending Reports Quick View */}
              <div className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-neutral-900">Laporan Terbaru</h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('reports')}
                    className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 underline cursor-pointer"
                  >
                    Semua ({reports.length})
                  </button>
                </div>
                {reports.length === 0 ? (
                  <p className="text-xs text-neutral-400 py-4 text-center">Belum ada laporan user.</p>
                ) : (
                  <div className="space-y-2">
                    {reports.slice(0, 5).map((r) => (
                      <div
                        key={r.id}
                        className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/80 flex items-start justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-neutral-900 truncate">
                            {r.reportedUserName}
                          </p>
                          <p className="text-[11px] text-red-600 font-medium truncate">{r.reason}</p>
                          <p className="text-[10px] text-neutral-500 mt-0.5">
                            Pelapor: {r.reporterUserName} · {formatShortDateTime(r.createdAtIso)}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                            r.status === 'pending'
                              ? 'bg-red-100 text-red-700'
                              : r.status === 'reviewed'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {r.status === 'pending'
                            ? 'Pending'
                            : r.status === 'reviewed'
                              ? 'Ditinjau'
                              : 'Selesai'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Login Telemetry Quick View */}
              <div className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-neutral-900">Aktivitas Login &amp; GPS</h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('logs')}
                    className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 underline cursor-pointer"
                  >
                    Semua ({loginLogs.length})
                  </button>
                </div>
                {loginLogs.length === 0 ? (
                  <p className="text-xs text-neutral-400 py-4 text-center">Belum ada catatan login.</p>
                ) : (
                  <div className="space-y-2">
                    {loginLogs.slice(0, 5).map((l) => (
                      <div
                        key={l.id}
                        className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/80 flex items-start justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-neutral-900 truncate">
                            {l.userName} ({l.action === 'register' ? 'Daftar' : 'Login'})
                          </p>
                          <p className="text-[11px] text-neutral-600 truncate">
                            {l.deviceType} · {l.os} · {l.browser}
                          </p>
                          <p className="text-[10px] text-neutral-500 truncate mt-0.5">
                            {l.locationLabel}
                          </p>
                        </div>
                        <span className="text-[10px] text-neutral-400 shrink-0 tabular-nums">
                          {formatShortDateTime(l.createdAtIso)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-neutral-200 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div className="flex flex-1 items-center gap-2 min-w-0">
                <div className="relative flex-1 min-w-0">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Cari nama, email, HP, kota..."
                    className="w-full min-h-[42px] pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-neutral-900 focus:outline-none"
                  />
                </div>
                <select
                  value={userStatusFilter}
                  onChange={(e) => setUserStatusFilter(e.target.value as 'all' | AccountStatus)}
                  className="min-h-[42px] px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  <option value="all">Semua ({users.length})</option>
                  <option value="active">Aktif</option>
                  <option value="blocked">Diblokir</option>
                  <option value="banned">Banned</option>
                </select>
              </div>

              <button
                type="button"
                onClick={openAddModal}
                className="min-h-[42px] px-4 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah User</span>
              </button>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="bg-white rounded-2xl border border-neutral-200 p-10 text-center text-xs text-neutral-400">
                Tidak ada pengguna yang cocok.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredUsers.map((u) => {
                  const status: AccountStatus = u.accountStatus || 'active';
                  const presenceInfo = formatPresenceLabel(presences[u.id]);
                  return (
                    <div
                      key={u.id}
                      className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold text-xs uppercase shrink-0">
                            {(u.name || 'U').slice(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-neutral-900 truncate">{u.name}</p>
                            <p className="text-xs text-neutral-500 truncate">{u.email}</p>
                            <p className="text-[11px] text-neutral-500 truncate">
                              {u.phone || '-'} · {u.buyerProfile?.city || u.sellerProfile?.brandCity || '-'}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 ${
                            status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : status === 'blocked'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {status === 'active' ? 'Aktif' : status === 'blocked' ? 'Diblokir' : 'Banned'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 text-[11px] text-neutral-500 bg-neutral-50 rounded-xl px-3 py-2">
                        <span className="inline-flex items-center gap-1.5 truncate">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              presenceInfo.isOnline ? 'bg-emerald-500' : 'bg-neutral-300'
                            }`}
                          />
                          <span className="truncate">{presenceInfo.label}</span>
                        </span>
                        <span className="tabular-nums shrink-0">ID: {u.id.slice(0, 12)}</span>
                      </div>

                      {u.statusReason && status !== 'active' && (
                        <p className="text-[11px] text-red-600 bg-red-50/70 border border-red-100 rounded-xl px-3 py-1.5">
                          Alasan: {u.statusReason}
                        </p>
                      )}

                      {/* Responsive Action Cluster */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(u)}
                          className="min-h-[36px] px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setResetTargetUser(u);
                            setNewPasswordInput('');
                            setShowNewPassword(false);
                          }}
                          className="min-h-[36px] px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Reset Sandi</span>
                        </button>

                        {status === 'active' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setStatusModalTarget({ user: u, nextStatus: 'blocked' });
                              setStatusReasonInput('');
                            }}
                            className="min-h-[36px] px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>Blokir</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void adminSetUserStatus(u, 'active', '')}
                            className="min-h-[36px] px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                            <span>Aktifkan</span>
                          </button>
                        )}

                        {status !== 'banned' && (
                          <button
                            type="button"
                            onClick={() => {
                              setStatusModalTarget({ user: u, nextStatus: 'banned' });
                              setStatusReasonInput('');
                            }}
                            className="min-h-[36px] px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Banned</span>
                          </button>
                        )}

                        {confirmDeleteUserId === u.id ? (
                          <div className="flex items-center gap-1 ml-auto">
                            <button
                              type="button"
                              onClick={async () => {
                                await adminDeleteUser(u.id, u.email);
                                setConfirmDeleteUserId(null);
                                onTriggerToast?.('User Dihapus', `Akun ${u.name} telah dihapus.`, 'system');
                              }}
                              className="min-h-[36px] px-2.5 py-1.5 bg-red-600 text-white rounded-xl text-[11px] font-bold cursor-pointer"
                            >
                              Konfirmasi Hapus
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteUserId(null)}
                              className="min-h-[36px] px-2 py-1.5 bg-neutral-100 text-neutral-600 rounded-xl text-[11px] cursor-pointer"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteUserId(u.id)}
                            className="min-h-[36px] px-2.5 py-1.5 bg-neutral-100 hover:bg-red-50 text-neutral-500 hover:text-red-600 rounded-xl text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer ml-auto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-neutral-200 p-3.5 sm:p-4 flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  placeholder="Cari nama, email, OS, lokasi GPS..."
                  className="w-full min-h-[42px] pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-neutral-900 focus:outline-none"
                />
              </div>
              <select
                value={logDeviceFilter}
                onChange={(e) =>
                  setLogDeviceFilter(e.target.value as 'all' | 'Mobile' | 'Tablet' | 'Desktop')
                }
                className="min-h-[42px] px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold cursor-pointer"
              >
                <option value="all">Semua Perangkat</option>
                <option value="Mobile">Mobile</option>
                <option value="Tablet">Tablet</option>
                <option value="Desktop">Desktop</option>
              </select>
            </div>

            {filteredLogs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-neutral-200 p-10 text-center text-xs text-neutral-400">
                Belum ada catatan login atau pendaftaran.
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className="bg-white rounded-2xl border border-neutral-200 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-neutral-100 text-neutral-700 flex items-center justify-center shrink-0">
                        {log.deviceType === 'Mobile' ? (
                          <Smartphone className="w-4 h-4" />
                        ) : log.deviceType === 'Tablet' ? (
                          <Tablet className="w-4 h-4" />
                        ) : (
                          <Monitor className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs sm:text-sm font-bold text-neutral-900 truncate">
                            {log.userName}
                          </p>
                          <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700 text-[10px] font-semibold">
                            {log.action === 'register' ? 'Daftar Baru' : 'Login'}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-500 truncate">{log.userEmail}</p>
                        <p className="text-xs text-neutral-700">
                          {log.deviceType} · {log.os} · {log.browser}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap pt-0.5 text-[11px]">
                          <span className="inline-flex items-center gap-1 text-neutral-600">
                            <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                            <span>{log.locationLabel}</span>
                          </span>
                          {typeof log.latitude === 'number' && typeof log.longitude === 'number' && (
                            <a
                              href={`https://maps.google.com/?q=${log.latitude},${log.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 hover:underline font-semibold"
                            >
                              <span>Buka Peta</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-neutral-100">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                          log.gpsPermission === 'granted'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-neutral-100 text-neutral-600'
                        }`}
                      >
                        {log.gpsPermission === 'granted' ? 'GPS Aktif' : 'Fallback Kota'}
                      </span>
                      <span className="text-[11px] text-neutral-400 tabular-nums">
                        {formatShortDateTime(log.createdAtIso)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-4">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {(['all', 'pending', 'reviewed', 'resolved'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setReportFilter(st)}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer whitespace-nowrap ${
                    reportFilter === st
                      ? 'bg-neutral-900 text-white border-neutral-900'
                      : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  {st === 'all'
                    ? `Semua (${reports.length})`
                    : st === 'pending'
                      ? 'Pending'
                      : st === 'reviewed'
                        ? 'Ditinjau'
                        : 'Selesai'}
                </button>
              ))}
            </div>

            {filteredReports.length === 0 ? (
              <div className="bg-white rounded-2xl border border-neutral-200 p-10 text-center text-xs text-neutral-400">
                Tidak ada laporan pada filter ini.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredReports.map((rep) => (
                  <div
                    key={rep.id}
                    className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-neutral-900">
                            {rep.reportedUserName}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600 text-[10px] font-semibold">
                            {rep.source === 'chat'
                              ? 'Dari Chat'
                              : rep.source === 'storefront'
                                ? 'Dari Toko'
                                : 'Dari Produk'}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-red-600 mt-1">{rep.reason}</p>
                        {rep.targetProductName && (
                          <p className="text-[11px] text-neutral-600 mt-0.5">
                            Produk: {rep.targetProductName}
                          </p>
                        )}
                        {rep.details && (
                          <p className="text-xs text-neutral-700 mt-1.5 bg-neutral-50 border border-neutral-200/70 rounded-xl p-2.5">
                            {rep.details}
                          </p>
                        )}
                        <p className="text-[11px] text-neutral-400 mt-1.5">
                          Dilaporkan oleh {rep.reporterUserName} · {formatShortDateTime(rep.createdAtIso)}
                        </p>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 ${
                          rep.status === 'pending'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : rep.status === 'reviewed'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {rep.status === 'pending'
                          ? 'Pending'
                          : rep.status === 'reviewed'
                            ? 'Ditinjau'
                            : 'Selesai'}
                      </span>
                    </div>

                    {rep.adminNote && (
                      <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5">
                        {rep.adminNote}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-neutral-100">
                      <button
                        type="button"
                        onClick={() => void handleModerateReportAccount(rep, 'blocked')}
                        className="min-h-[36px] px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Blokir Akun</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleModerateReportAccount(rep, 'banned')}
                        className="min-h-[36px] px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Banned Akun</span>
                      </button>
                      {rep.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => void updateUserReportStatus(rep.id, 'reviewed')}
                          className="min-h-[36px] px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-[11px] font-semibold cursor-pointer"
                        >
                          Tandai Ditinjau
                        </button>
                      )}
                      {rep.status !== 'resolved' && (
                        <button
                          type="button"
                          onClick={() => void updateUserReportStatus(rep.id, 'resolved', 'Ditinjau Superadmin')}
                          className="min-h-[36px] px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer ml-auto"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Selesai</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'moderation' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-neutral-200 p-3.5 sm:p-4 flex flex-col sm:flex-row gap-2.5 justify-between">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setModSubTab('products')}
                  className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                    modSubTab === 'products'
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-100 text-neutral-700'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Listing ({products.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setModSubTab('orders')}
                  className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                    modSubTab === 'orders'
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-100 text-neutral-700'
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Pesanan ({orders.length})</span>
                </button>
              </div>

              <div className="relative flex-1 sm:max-w-xs">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={modSearch}
                  onChange={(e) => setModSearch(e.target.value)}
                  placeholder="Cari produk atau nomor pesanan..."
                  className="w-full min-h-[40px] pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:bg-white focus:border-neutral-900 focus:outline-none"
                />
              </div>
            </div>

            {modSubTab === 'products' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredProducts.map((p) => (
                  <div
                    key={p.id}
                    className="bg-white rounded-2xl border border-neutral-200 p-3.5 flex items-center gap-3"
                  >
                    <img
                      src={p.image}
                      alt={p.name}
                      className="w-14 h-16 rounded-xl object-cover bg-neutral-100 border border-neutral-200 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-xs font-bold text-neutral-900 truncate">{p.name}</p>
                      <p className="text-[11px] text-neutral-500 truncate">
                        {p.sellerBrandName || p.brand} · Rp {p.price.toLocaleString('id-ID')} · Stok {p.stock}
                      </p>
                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            void Promise.resolve(
                              onToggleProductActive(p.id, p.isActive === false)
                            ).catch(() => {})
                          }
                          className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                            p.isActive !== false
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                          }`}
                        >
                          {p.isActive !== false ? 'Aktif (Tampil)' : 'Disembunyikan'}
                        </button>
                        {confirmDeleteProductId === p.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                void Promise.resolve(onDeleteProduct(p.id)).catch(() => {});
                                setConfirmDeleteProductId(null);
                              }}
                              className="min-h-[32px] px-2.5 py-1 bg-red-600 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                            >
                              Hapus
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteProductId(null)}
                              className="min-h-[32px] px-2 py-1 bg-neutral-100 text-neutral-600 rounded-lg text-[11px] cursor-pointer"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteProductId(p.id)}
                            className="min-h-[32px] px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-[11px] font-semibold cursor-pointer"
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredOrders.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-neutral-200 p-8 text-center text-xs text-neutral-400">
                    Belum ada pesanan.
                  </div>
                ) : (
                  filteredOrders.map((o) => (
                    <div
                      key={o.id}
                      className="bg-white rounded-2xl border border-neutral-200 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-neutral-900">
                          #{o.orderNumber} · {o.customerName}
                        </p>
                        <p className="text-[11px] text-neutral-500 truncate">
                          Penjual: {o.sellerBrandName || '-'} · Kurir: {o.courier}
                          {o.trackingNumber ? ` · Resi: ${o.trackingNumber}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-bold tabular-nums text-neutral-900">
                          Rp {o.totalAmount.toLocaleString('id-ID')}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700 text-[10px] font-semibold uppercase">
                          {o.orderStatus}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ADD / EDIT USER MODAL */}
      {isAddUserOpen && (
        <div
          className="fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setIsAddUserOpen(false)}
        >
          <div
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl border border-neutral-200 p-4 sm:p-6 space-y-4 max-h-[92dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-sm font-bold text-neutral-900">
                {editingUser ? `Edit User: ${editingUser.name}` : 'Tambah User Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddUserOpen(false)}
                className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {userFormError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                {userFormError}
              </p>
            )}

            <form onSubmit={handleSaveUserForm} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-neutral-700 block mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl"
                />
              </div>
              <div>
                <label className="font-semibold text-neutral-700 block mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">No. HP</label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">Kota</label>
                  <input
                    type="text"
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="font-semibold text-neutral-700 block mb-1">Nama Toko / Lapak</label>
                <input
                  type="text"
                  value={formBrandName}
                  onChange={(e) => setFormBrandName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl"
                />
              </div>
              <div>
                <label className="font-semibold text-neutral-700 block mb-1">Alamat</label>
                <textarea
                  rows={2}
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl resize-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">
                    {editingUser ? 'Sandi Baru (Opsional)' : 'Kata Sandi'}
                  </label>
                  <input
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder={editingUser ? 'Biarkan kosong jika tetap' : 'Minimal 4 karakter'}
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">Status Akun</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as AccountStatus)}
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl"
                  >
                    <option value="active">Aktif</option>
                    <option value="blocked">Diblokir</option>
                    <option value="banned">Banned</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="flex-1 min-h-[44px] py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingUser}
                  className="flex-1 min-h-[44px] py-2.5 bg-neutral-900 hover:bg-black text-white font-bold rounded-xl cursor-pointer inline-flex items-center justify-center gap-1.5"
                >
                  {isSavingUser && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Simpan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetTargetUser && (
        <div
          className="fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setResetTargetUser(null)}
        >
          <div
            className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl border border-neutral-200 p-4 sm:p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900">
                Reset Sandi · {resetTargetUser.name}
              </h3>
              <button
                type="button"
                onClick={() => setResetTargetUser(null)}
                className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitResetPassword} className="space-y-3 text-xs">
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  minLength={4}
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Kata sandi baru (min. 4 karakter)"
                  className="w-full pl-3.5 pr-10 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 cursor-pointer"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setResetTargetUser(null)}
                  className="flex-1 min-h-[42px] bg-neutral-100 text-neutral-700 font-semibold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingUser || newPasswordInput.trim().length < 4}
                  className="flex-1 min-h-[42px] bg-neutral-900 text-white font-bold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  Simpan Sandi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BLOCK / BAN REASON MODAL */}
      {statusModalTarget && (
        <div
          className="fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setStatusModalTarget(null)}
        >
          <div
            className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl border border-neutral-200 p-4 sm:p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900">
                {statusModalTarget.nextStatus === 'banned' ? 'Banned Akun' : 'Blokir Akun'} ·{' '}
                {statusModalTarget.user.name}
              </h3>
              <button
                type="button"
                onClick={() => setStatusModalTarget(null)}
                className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitStatusChange} className="space-y-3 text-xs">
              <textarea
                rows={3}
                value={statusReasonInput}
                onChange={(e) => setStatusReasonInput(e.target.value)}
                placeholder="Alasan tindakan (ditampilkan ke pengguna saat login)..."
                className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl resize-none"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStatusModalTarget(null)}
                  className="flex-1 min-h-[42px] bg-neutral-100 text-neutral-700 font-semibold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingUser}
                  className={`flex-1 min-h-[42px] text-white font-bold rounded-xl cursor-pointer ${
                    statusModalTarget.nextStatus === 'banned' ? 'bg-red-600' : 'bg-amber-600'
                  }`}
                >
                  {statusModalTarget.nextStatus === 'banned' ? 'Konfirmasi Banned' : 'Konfirmasi Blokir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
