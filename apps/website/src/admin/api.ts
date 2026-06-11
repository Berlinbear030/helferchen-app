const API_BASE = '/api';

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options?.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || res.statusText);
  }
  return res.json();
}

export interface DashboardStats {
  total_users: number;
  total_customers: number;
  total_assignments: number;
  assignments_by_status: Record<string, number>;
  total_timelogs: number;
  active_timers: number;
  total_reports: number;
  signed_reports: number;
  emails_sent: number;
}

export interface User {
  id: string;
  username: string;
  role: string;
  email: string;
  full_name: string;
  address?: string;
  qualification?: string;
  created_at: string;
}

export interface EmployeeStats {
  total_assignments: number;
  completed_assignments: number;
  total_timelogs: number;
  total_earnings: number;
  timelogs: Array<{
    id: string;
    assignment_id: string;
    start_time: string;
    end_time: string | null;
    duration_minutes: number | null;
    blocks_count: number | null;
    total_price: number | null;
    is_signed: boolean;
    assignment_title: string | null;
    customer_name: string | null;
  }>;
  assignments: Array<{
    id: string;
    title: string;
    status: string;
    scheduled_at: string;
    customer_name: string | null;
  }>;
}

export interface AuditEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  performed_by: string;
  description: string;
  timestamp: string;
}

export interface Report {
  id: string;
  assignment_id: string;
  timelog_id: string;
  created_by_user_id: string;
  notes: string;
  signature_id: string | null;
  pdf_generated: boolean;
  email_sent: boolean;
  created_at: string;
  timelog?: { start_time: string; end_time: string | null };
  assignment?: { id: string; customer_id: string };
  customer?: { id: string; name: string };
  signature?: { signed_at: string } | null;
}

export interface Timelog {
  id: string;
  user_id: string;
  assignment_id: string;
  start_time: string;
  end_time: string | null;
  is_signed: boolean;
  created_at: string;
}

export interface Role {
  id: string;
  name: string;
  display_name: string;
  is_system: boolean;
  permissions: string[];
  created_at: string;
}

export const adminApi = {
  getDashboard: () => apiFetch<DashboardStats>('/admin/dashboard'),
  getUsers: () => apiFetch<User[]>('/admin/users'),
  createUser: (data: { username: string; password: string; role: string; email?: string; full_name?: string }) =>
    apiFetch<User>('/admin/users', { method: 'POST', body: JSON.stringify(data) }),
  getUser: (id: string) => apiFetch<User>(`/admin/users/${id}`),
  updateUser: (id: string, data: { role?: string; password?: string; email?: string; full_name?: string; address?: string; qualification?: string }) =>
    apiFetch<void>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  updateUserRole: (id: string, role: string) =>
    apiFetch<void>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  deleteUser: (id: string) =>
    apiFetch<void>(`/admin/users/${id}`, { method: 'DELETE' }),
  getUserStats: (id: string) => apiFetch<EmployeeStats>(`/admin/users/${id}/stats`),
  getAudit: (params?: { entity_type?: string; entity_id?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.entity_type) q.set('entity_type', params.entity_type);
    if (params?.entity_id) q.set('entity_id', params.entity_id);
    if (params?.limit) q.set('limit', String(params.limit));
    return apiFetch<AuditEntry[]>(`/admin/audit?${q}`);
  },
  getExport: () => apiFetch<Record<string, unknown>>('/admin/export'),
  getReports: () => apiFetch<Report[]>('/reports'),
  getTimelogs: () => apiFetch<Timelog[]>('/timelogs/all').catch(() => [] as Timelog[]),
  getRoles: () => apiFetch<Role[]>('/admin/roles'),
  createRole: (data: { name: string; display_name: string; permissions: string[] }) =>
    apiFetch<Role>('/admin/roles', { method: 'POST', body: JSON.stringify(data) }),
  updateRole: (id: string, data: { display_name: string; permissions: string[] }) =>
    apiFetch<void>(`/admin/roles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteRole: (id: string) =>
    apiFetch<void>(`/admin/roles/${id}`, { method: 'DELETE' }),
};
