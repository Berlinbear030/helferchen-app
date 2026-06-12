import bcrypt from 'bcryptjs';

export interface User {
  id: string;
  username: string;
  password_hash: string;
  role: 'admin' | 'employee';
  email: string;
  full_name: string;
  address?: string;
  qualification?: string;
  permissions?: string; // JSON array of permission strings
  created_at: string;
}

export interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  address: string;
  phone_number: string;
  notes: string;
  created_at: string;
}

export interface Assignment {
  id: string;
  customer_id: string;
  assigned_user_id: string;
  title: string;
  description: string;
  scheduled_at: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
}

export interface Timelog {
  id: string;
  user_id: string;
  assignment_id: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  blocks_count: number | null;
  total_price: number | null;
  is_signed: boolean;
  created_at: string;
}

export interface Signature {
  id: string;
  report_id: string;
  timelog_id: string;
  image_data: string; // base64 blob
  signed_at: string;
  signer_name: string;
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
  invoice_number?: string | null;
  invoice_notes?: string | null;
  invoice_amount_override?: number | null;
  voucher_code?: string | null;
  voucher_label?: string | null;
  voucher_discount_amount?: number | null;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_user_id: string;
  details: string;
  timestamp: string;
}

export interface BookingRequest {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  street?: string;
  house_number?: string;
  zip?: string;
  city?: string;
  service_description: string;
  preferred_date: string;
  preferred_time: string;
  status: 'open' | 'accepted' | 'rejected' | 'assigned';
  assigned_user_id: string | null;
  notes: string;
  created_at: string;
}

export interface ShopArticle {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  stock: number;
  active: boolean;
  created_at: string;
}

export interface Role {
  id: string;
  name: string;
  display_name: string;
  is_system: boolean;
  permissions: string; // JSON array string
  created_at: string;
}

const adminHash = bcrypt.hashSync('admin123', 10);
const boardHash = bcrypt.hashSync('board2026', 10);
const empHash = bcrypt.hashSync('employee123', 10);

const db = {
  users: [
    { id: 'u1', username: 'admin', password_hash: adminHash, role: 'admin' as const, email: 'admin@helferchen.info', full_name: 'Admin User', created_at: new Date().toISOString() },
    { id: 'u3', username: 'board', password_hash: boardHash, role: 'admin' as const, email: 'board@helferchen.info', full_name: 'Board Member', created_at: new Date().toISOString() },
    { id: 'u2', username: 'employee1', password_hash: empHash, role: 'employee' as const, email: 'emp1@helferchen.info', full_name: 'Max Mustermann', created_at: new Date().toISOString() },
  ] as User[],

  customers: [
    { id: 'c1', first_name: 'Erika', last_name: 'Mustermann', address: 'Musterstr. 1, 80333 München', phone_number: '089-123456', notes: 'Erdgeschoss', created_at: new Date().toISOString() },
    { id: 'c2', first_name: 'Hans', last_name: 'Schmidt', address: 'Hauptstr. 5, 80335 München', phone_number: '089-654321', notes: '3. OG', created_at: new Date().toISOString() },
  ] as Customer[],

  assignments: [
    { id: 'a1', customer_id: 'c1', assigned_user_id: 'u2', title: 'TV einrichten', description: 'Samsung TV im Wohnzimmer', scheduled_at: new Date().toISOString(), status: 'pending' as const, created_at: new Date().toISOString() },
    { id: 'a2', customer_id: 'c2', assigned_user_id: 'u2', title: 'Fenster putzen', description: '3 Fenster', scheduled_at: new Date().toISOString(), status: 'pending' as const, created_at: new Date().toISOString() },
  ] as Assignment[],

  timelogs: [] as Timelog[],
  signatures: [] as Signature[],
  reports: [] as Report[],
  audit: [] as AuditEntry[],
  bookingRequests: [] as BookingRequest[],
};

export function addAudit(entity_type: string, entity_id: string, action: string, actor_user_id: string, details: string) {
  db.audit.push({
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    entity_type,
    entity_id,
    action,
    actor_user_id,
    details,
    timestamp: new Date().toISOString(),
  });
}

export default db;
