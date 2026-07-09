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
  // EIS-506: onboarding & compliance
  birth_date?: string | null;
  onboarding_status?: 'active' | 'pending_review' | 'approved' | 'rejected';
  level?: number;
  criminal_record_upload?: string | null; // base64 blob
  onboarding_submitted_at?: string | null;
  onboarding_reviewed_by?: string | null;
  onboarding_review_note?: string | null;
  onboarding_reviewed_at?: string | null;
  // EIS-505: Mitarbeiter-Stufe für First-Match-Boost-Sichtbarkeit (Level-0-Pool)
  employee_tier?: 'standard' | 'premium_flex' | 'senior_crew';
  // EIS-498: Pluspunkte aus positivem Kunden-Feedback (Care-Call)
  positive_points?: number;
}

// EIS-505: Promoter-Code, dauerhaft mit einem Kunden verknüpft bei Auftragseingang
export interface Promoter {
  id: string;
  code: string;
  name: string;
  active: boolean;
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
  // EIS-505: Kunden-Level-Routing (0=Starter,1=Trust,2=Premium), permanenter Promoter-Link,
  // fester Stamm-Mitarbeiter für Level 1/2 Direct-Push
  level?: number;
  promoter_id?: string | null;
  stamm_user_id?: string | null;
  // EIS-498: Buchungssperre nach eskaliertem Mahnwesen
  booking_blocked?: boolean;
  booking_blocked_reason?: string | null;
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
  // EIS-505: Routing-Snapshot zum Zeitpunkt der Vergabe (stabil für Provisions-Split) +
  // First-Match-Boost-Fenster + Eskalationsstatus (Level 1/2 Direct-Push Ablehnung/Krankheit)
  promoter_id?: string | null;
  customer_level?: number | null;
  boost_visible_until?: string | null;
  escalation_status?: 'needs_manual_assignment' | 'declined' | 'krank' | null;
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
  // EIS-502: Bar / Kartenzahlung (SumUp) am Auftragsende
  collection_method?: 'bar' | 'karte_sumup' | null;
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
  // EIS-502: Bar / Kartenzahlung (SumUp) am Auftragsende — nicht zu verwechseln mit `payment_method`
  // (Rechnungs-Zahlungsbedingungen, admin-gepflegt).
  collection_method?: 'bar' | 'karte_sumup' | null;
  created_at: string;
  // EIS-505: Zahlungsstatus + Provisions-Split bei bezahlten Rechnungen
  is_paid?: boolean;
  paid_at?: string | null;
  commission_helper_pct?: number | null;
  commission_helferchen_pct?: number | null;
  commission_promoter_pct?: number | null;
  commission_helper_amount?: number | null;
  commission_helferchen_amount?: number | null;
  commission_promoter_amount?: number | null;
  // EIS-498: Finance & Billing Freigabe vor Versand + Druckauftrag (Post) + Mahnwesen
  approval_status?: 'draft' | 'approved';
  approved_by_user_id?: string | null;
  approved_at?: string | null;
  print_status?: 'none' | 'requested' | 'printed';
  print_requested_at?: string | null;
  printed_at?: string | null;
  dunning_stage?: 'offen' | 'mahnung_1' | 'mahnung_2' | 'gesperrt';
  dunning_last_sent_at?: string | null;
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

export interface ShopOrder {
  id: string;
  customer_name: string;
  customer_email: string;
  items: string; // JSON array of { name, quantity, price }
  total: number;
  status: 'new' | 'done';
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

export interface SipUser {
  id: string;
  username: string;
  password: string;
  full_name: string;
  created_at: string;
}

export interface LeaveRequest {
  id: string;
  user_id: string;
  type: 'urlaub' | 'krankmeldung';
  start_date: string;
  end_date: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by_user_id: string | null;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

// EIS-502: Daily-Closing Wechselgeld-Logik — Helfer startet Schicht mit privatem Wechselgeld
// (starting_change), das System fordert beim Abschluss nur den reinen Bar-Tagesumsatz (bar_revenue)
// als Einzahlungssumme.
export interface DailyClosing {
  id: string;
  user_id: string;
  closing_date: string; // YYYY-MM-DD
  starting_change: number;
  bar_revenue: number | null;
  deposited_amount: number | null;
  closed_at: string | null;
  created_at: string;
}

// EIS-504: generisches, rollenbasiertes Aktions-/To-Do-System (Fundament für den Action-Slider)
export interface Action {
  id: string;
  type: string;
  title: string;
  body: string | null;
  target_role: string | null;
  target_user_id: string | null;
  severity: 'normal' | 'required';
  link_tab: string | null;
  entity_type: string | null;
  entity_id: string | null;
  status: 'open' | 'done' | 'dismissed';
  created_by_user_id: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
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

  sipUsers: [] as SipUser[],

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
  leaveRequests: [] as LeaveRequest[],
  shopOrders: [] as ShopOrder[],
  dailyClosings: [] as DailyClosing[],
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
