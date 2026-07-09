import db, { User, Customer, Assignment, Timelog, Report, Signature, BookingRequest, ShopArticle, ShopOrder, AuditEntry, Role, SipUser, LeaveRequest, DailyClosing } from './index';
import { query, dbConnected } from './pool';
import { randomUUID } from 'crypto';

const useDb = () => dbConnected;

export const UserRepo = {
  async findByUsername(username: string): Promise<User | null> {
    if (!useDb()) return db.users.find(u => u.username === username) || null;
    const res = await query('SELECT * FROM users WHERE username = ? AND deleted_at IS NULL', [username]);
    return res.rows[0] || null;
  },
  async findById(id: string): Promise<User | null> {
    if (!useDb()) return db.users.find(u => u.id === id) || null;
    const res = await query('SELECT * FROM users WHERE id = ?', [id]);
    return res.rows[0] || null;
  },
  async findAll(): Promise<User[]> {
    if (!useDb()) return db.users;
    const res = await query('SELECT id, username, full_name, email, role, address, qualification, permissions, private_email, assigned_cars, assigned_materials, onboarding_status, level, created_at FROM users WHERE deleted_at IS NULL ORDER BY username ASC');
    return res.rows;
  },
  async create(username: string, password_hash: string, full_name: string, email: string, role: string): Promise<User> {
    if (!useDb()) {
      const u = { id: Date.now().toString(), username, password_hash, full_name, email, role: role as any, created_at: new Date().toISOString() };
      db.users.push(u);
      return u;
    }
    const id = randomUUID();
    await query(
      'INSERT INTO users (id, username, password_hash, full_name, email, role) VALUES (?, ?, ?, ?, ?, ?)',
      [id, username, password_hash, full_name, email, role]
    );
    return { id, username, password_hash, full_name, email, role: role as any, created_at: new Date().toISOString() };
  },
  async delete(id: string): Promise<boolean> {
    if (!useDb()) {
      const idx = db.users.findIndex(u => u.id === id);
      if (idx === -1) return false;
      db.users.splice(idx, 1);
      return true;
    }
    // Soft delete: mark deleted_at instead of hard DELETE to preserve FK references
    // (assignments, timelogs, reports all reference users.id with RESTRICT)
    const res = await query('UPDATE users SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL', [id]);
    return res.rowCount > 0;
  },
  async update(id: string, fields: { password_hash?: string; email?: string; full_name?: string; role?: string; address?: string; qualification?: string; permissions?: string; private_email?: string; assigned_cars?: string; assigned_materials?: string; level?: number }): Promise<boolean> {
    if (!useDb()) return false;
    const setClauses: string[] = [];
    const values: unknown[] = [];
    if (fields.password_hash !== undefined) { setClauses.push('password_hash = ?'); values.push(fields.password_hash); }
    if (fields.email !== undefined) { setClauses.push('email = ?'); values.push(fields.email); }
    if (fields.full_name !== undefined) { setClauses.push('full_name = ?'); values.push(fields.full_name); }
    if (fields.role !== undefined) { setClauses.push('role = ?'); values.push(fields.role); }
    if (fields.address !== undefined) { setClauses.push('address = ?'); values.push(fields.address); }
    if (fields.qualification !== undefined) { setClauses.push('qualification = ?'); values.push(fields.qualification); }
    if (fields.permissions !== undefined) { setClauses.push('permissions = ?'); values.push(fields.permissions); }
    if (fields.private_email !== undefined) { setClauses.push('private_email = ?'); values.push(fields.private_email); }
    if (fields.assigned_cars !== undefined) { setClauses.push('assigned_cars = ?'); values.push(fields.assigned_cars); }
    if (fields.assigned_materials !== undefined) { setClauses.push('assigned_materials = ?'); values.push(fields.assigned_materials); }
    if (fields.level !== undefined) { setClauses.push('level = ?'); values.push(fields.level); }
    if (setClauses.length === 0) return false;
    values.push(id);
    const res = await query(`UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`, values);
    return res.rowCount > 0;
  },
  async countAll(): Promise<number> {
    if (!useDb()) return db.users.length;
    const res = await query('SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL');
    return parseInt(res.rows[0].count);
  },

  // EIS-506: Mitarbeiter-Onboarding & Compliance-Workflow
  async createFreelancerRegistration(data: {
    username: string; password_hash: string; full_name: string; email: string;
    birth_date: string; address?: string; criminal_record_upload: string;
  }): Promise<User> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const entry: User = {
      id, username: data.username, password_hash: data.password_hash, full_name: data.full_name,
      email: data.email, role: 'employee', created_at: now,
      birth_date: data.birth_date, address: data.address, onboarding_status: 'pending_review',
      level: 0, criminal_record_upload: data.criminal_record_upload, onboarding_submitted_at: now,
    };
    if (!useDb()) {
      db.users.push(entry);
      return entry;
    }
    await query(
      `INSERT INTO users (id, username, password_hash, full_name, email, role, birth_date, address, onboarding_status, level, criminal_record_upload, onboarding_submitted_at)
       VALUES (?, ?, ?, ?, ?, 'employee', ?, ?, 'pending_review', 0, ?, NOW())`,
      [id, data.username, data.password_hash, data.full_name, data.email, data.birth_date, data.address || null, data.criminal_record_upload]
    );
    return entry;
  },
  async findPendingOnboarding(): Promise<User[]> {
    if (!useDb()) return db.users.filter(u => u.onboarding_status === 'pending_review');
    const res = await query(
      `SELECT id, username, full_name, email, address, birth_date, onboarding_status, onboarding_submitted_at, created_at
       FROM users WHERE onboarding_status = 'pending_review' AND deleted_at IS NULL ORDER BY onboarding_submitted_at ASC`
    );
    return res.rows;
  },
  async findOnboardingDetail(id: string): Promise<User | null> {
    if (!useDb()) return db.users.find(u => u.id === id) || null;
    const res = await query(
      `SELECT id, username, full_name, email, address, qualification, birth_date, onboarding_status, level,
              criminal_record_upload, onboarding_submitted_at, onboarding_reviewed_by, onboarding_review_note, onboarding_reviewed_at
       FROM users WHERE id = ?`,
      [id]
    );
    return res.rows[0] || null;
  },
  async reviewOnboarding(id: string, data: { status: 'active' | 'rejected'; reviewed_by_user_id: string; review_note?: string | null }): Promise<User | null> {
    if (!useDb()) {
      const entry = db.users.find(u => u.id === id);
      if (!entry) return null;
      entry.onboarding_status = data.status;
      entry.onboarding_reviewed_by = data.reviewed_by_user_id;
      entry.onboarding_review_note = data.review_note ?? null;
      entry.onboarding_reviewed_at = new Date().toISOString();
      if (data.status === 'active') entry.level = 0;
      return entry;
    }
    await query(
      `UPDATE users SET onboarding_status = ?, onboarding_reviewed_by = ?, onboarding_review_note = ?, onboarding_reviewed_at = NOW()
       WHERE id = ?`,
      [data.status, data.reviewed_by_user_id, data.review_note ?? null, id]
    );
    return this.findOnboardingDetail(id);
  },
};

export const CustomerRepo = {
  async findAll(): Promise<Customer[]> {
    if (!useDb()) return db.customers;
    const res = await query('SELECT * FROM customers ORDER BY created_at DESC');
    return res.rows;
  },
  async findById(id: string): Promise<Customer | null> {
    if (!useDb()) return db.customers.find(c => c.id === id) || null;
    const res = await query('SELECT * FROM customers WHERE id = ?', [id]);
    return res.rows[0] || null;
  },
  async create(first_name: string, last_name: string, address: string, phone_number: string, notes: string): Promise<Customer> {
    if (!useDb()) {
      const c = { id: Date.now().toString(), first_name, last_name, address, phone_number, notes, created_at: new Date().toISOString() };
      db.customers.push(c);
      return c;
    }
    const id = randomUUID();
    await query(
      'INSERT INTO customers (id, first_name, last_name, address, phone_number, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [id, first_name, last_name, address, phone_number, notes]
    );
    return { id, first_name, last_name, address, phone_number, notes, created_at: new Date().toISOString() };
  },
  async delete(id: string): Promise<boolean> {
    if (!useDb()) {
      const idx = db.customers.findIndex(c => c.id === id);
      if (idx === -1) return false;
      db.customers.splice(idx, 1);
      return true;
    }
    const res = await query('DELETE FROM customers WHERE id = ?', [id]);
    return res.rowCount > 0;
  },
  // EIS-505: Kunden-Level (Routing) + fester Stamm-Mitarbeiter (Direct-Push Ziel für Level 1/2)
  async updateRouting(id: string, fields: { level?: number; stamm_user_id?: string | null }): Promise<boolean> {
    if (!useDb()) return false;
    const updates: string[] = [];
    const values: unknown[] = [];
    if (fields.level !== undefined) { updates.push('level = ?'); values.push(fields.level); }
    if (fields.stamm_user_id !== undefined) { updates.push('stamm_user_id = ?'); values.push(fields.stamm_user_id); }
    if (updates.length === 0) return false;
    values.push(id);
    const res = await query(`UPDATE customers SET ${updates.join(', ')} WHERE id = ?`, values);
    return res.rowCount > 0;
  }
};

export const AssignmentRepo = {
  async findAll(): Promise<Assignment[]> {
    if (!useDb()) return db.assignments;
    const res = await query('SELECT * FROM assignments ORDER BY scheduled_at DESC');
    return res.rows;
  },
  async findByUserId(userId: string): Promise<Assignment[]> {
    if (!useDb()) return db.assignments.filter(a => a.assigned_user_id === userId);
    const res = await query('SELECT * FROM assignments WHERE assigned_user_id = ? ORDER BY scheduled_at DESC', [userId]);
    return res.rows;
  },
  async findById(id: string): Promise<Assignment | null> {
    if (!useDb()) return db.assignments.find(a => a.id === id) || null;
    const res = await query('SELECT * FROM assignments WHERE id = ?', [id]);
    return res.rows[0] || null;
  },
  async create(customer_id: string, assigned_user_id: string | null, title: string, description: string, scheduled_at: string, booking_request_id: string | null = null, hourly_rate: number = 65.00, routing?: { promoter_id?: string | null; customer_level?: number | null; boost_visible_until?: string | null; escalation_status?: string | null }): Promise<Assignment> {
    if (!useDb()) {
      const a = { id: Date.now().toString(), customer_id, assigned_user_id: assigned_user_id || '', title, description, scheduled_at, status: 'pending' as const, hourly_rate, created_at: new Date().toISOString(), booking_request_id: booking_request_id || '' };
      db.assignments.push(a as any);
      return a as any;
    }
    const id = randomUUID();
    const formattedDate = scheduled_at.replace('T', ' ').slice(0, 19).padEnd(19, ':00').slice(0, 19);
    await query(
      'INSERT INTO assignments (id, customer_id, assigned_user_id, title, description, scheduled_at, booking_request_id, hourly_rate, promoter_id, customer_level, boost_visible_until, escalation_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, customer_id, assigned_user_id || null, title, description, formattedDate, booking_request_id, hourly_rate, routing?.promoter_id ?? null, routing?.customer_level ?? null, routing?.boost_visible_until ?? null, routing?.escalation_status ?? null]
    );
    return { id, customer_id, assigned_user_id: assigned_user_id || '', title, description, scheduled_at, status: 'pending', hourly_rate, created_at: new Date().toISOString() } as any;
  },
  async findByBookingRequestId(bookingRequestId: string): Promise<Assignment | null> {
    if (!useDb()) return (db.assignments as any).find((a: any) => a.booking_request_id === bookingRequestId) || null;
    const res = await query('SELECT * FROM assignments WHERE booking_request_id = ?', [bookingRequestId]);
    return res.rows[0] || null;
  },
  async updateStatus(id: string, status: string): Promise<void> {
    if (!useDb()) {
      const a = db.assignments.find(x => x.id === id);
      if (a) a.status = status as any;
      return;
    }
    await query('UPDATE assignments SET status = ? WHERE id = ?', [status, id]);
  },
  async delete(id: string): Promise<boolean> {
    if (!useDb()) {
      const idx = db.assignments.findIndex(x => x.id === id);
      if (idx === -1) return false;
      db.assignments.splice(idx, 1);
      return true;
    }
    const res = await query('DELETE FROM assignments WHERE id = ?', [id]);
    return res.rowCount > 0;
  },
  async countAll(): Promise<number> {
    if (!useDb()) return db.assignments.length;
    const res = await query('SELECT COUNT(*) as count FROM assignments');
    return parseInt(res.rows[0].count);
  },
  async countByUserId(userId: string): Promise<number> {
    if (!useDb()) return db.assignments.filter(a => a.assigned_user_id === userId).length;
    const res = await query('SELECT COUNT(*) as count FROM assignments WHERE assigned_user_id = ?', [userId]);
    return parseInt(res.rows[0].count);
  },
  async findUnassigned(): Promise<Assignment[]> {
    if (!useDb()) return db.assignments.filter(a => !a.assigned_user_id);
    const res = await query("SELECT * FROM assignments WHERE assigned_user_id IS NULL OR assigned_user_id = '' ORDER BY scheduled_at DESC");
    return res.rows;
  },
  async reassign(id: string, userId: string | null): Promise<boolean> {
    if (!useDb()) {
      const a = db.assignments.find(x => x.id === id);
      if (!a) return false;
      a.assigned_user_id = userId || '';
      return true;
    }
    const res = await query('UPDATE assignments SET assigned_user_id = ? WHERE id = ?', [userId, id]);
    return res.rowCount > 0;
  },
  // EIS-505: Level 1/2 Direct-Push wird abgelehnt oder der feste Mitarbeiter meldet sich krank ->
  // Auftrag wird frei und zur manuellen Eskalation an den Gebietsleiter markiert.
  async declineDirectPush(id: string, reason: 'declined' | 'krank'): Promise<boolean> {
    if (!useDb()) return false;
    const res = await query(
      "UPDATE assignments SET assigned_user_id = NULL, escalation_status = ? WHERE id = ?",
      [reason, id]
    );
    return res.rowCount > 0;
  },
  async findEscalations(): Promise<Assignment[]> {
    if (!useDb()) return [];
    const res = await query(
      "SELECT * FROM assignments WHERE escalation_status IS NOT NULL AND (assigned_user_id IS NULL OR assigned_user_id = '') ORDER BY scheduled_at ASC"
    );
    return res.rows;
  },
  async resolveEscalation(id: string, userId: string): Promise<boolean> {
    if (!useDb()) return false;
    const res = await query(
      "UPDATE assignments SET assigned_user_id = ?, escalation_status = NULL WHERE id = ?",
      [userId, id]
    );
    return res.rowCount > 0;
  }
};

export const TimelogRepo = {
  async findById(id: string): Promise<Timelog | null> {
    if (!useDb()) return db.timelogs.find(t => t.id === id) || null;
    const res = await query('SELECT * FROM time_logs WHERE id = ?', [id]);
    return res.rows[0] || null;
  },
  async findActive(userId: string, assignmentId: string): Promise<Timelog | null> {
    if (!useDb()) return db.timelogs.find(t => t.user_id === userId && t.assignment_id === assignmentId && !t.end_time) || null;
    const res = await query(
      'SELECT * FROM time_logs WHERE user_id = ? AND assignment_id = ? AND end_time IS NULL',
      [userId, assignmentId]
    );
    return res.rows[0] || null;
  },
  async create(userId: string, assignmentId: string): Promise<Timelog> {
    if (!useDb()) {
      const t = { id: Date.now().toString(), user_id: userId, assignment_id: assignmentId, start_time: new Date().toISOString(), end_time: null, duration_minutes: null, blocks_count: null, total_price: null, is_signed: false, created_at: new Date().toISOString() };
      db.timelogs.push(t);
      return t;
    }
    const id = randomUUID();
    const start_time = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await query(
      'INSERT INTO time_logs (id, user_id, assignment_id, start_time) VALUES (?, ?, ?, NOW())',
      [id, userId, assignmentId]
    );
    return { id, user_id: userId, assignment_id: assignmentId, start_time, end_time: null, duration_minutes: null, blocks_count: null, total_price: null, is_signed: false, created_at: new Date().toISOString() };
  },
  async stop(id: string): Promise<Timelog> {
    if (!useDb()) {
      const t = db.timelogs.find(x => x.id === id);
      if (t) t.end_time = new Date().toISOString();
      return t!;
    }
    const existing = await query('SELECT start_time FROM time_logs WHERE id = ?', [id]);
    if (!existing.rows[0]) throw new Error('Timelog not found');
    const startMs = new Date(existing.rows[0].start_time).getTime();
    const durationMinutes = Math.max(1, Math.round((Date.now() - startMs) / 60000));
    const blocksCount = Math.ceil(durationMinutes / 15);
    // €25 first 15 min (inkl. Anfahrt), +€20 per additional started 15-min block (same as MobileApp calcPrice)
    const totalPrice = durationMinutes <= 15 ? 25 : 25 + Math.ceil((durationMinutes - 15) / 15) * 20;
    await query(
      'UPDATE time_logs SET end_time = NOW(), duration_minutes = ?, blocks_count = ?, total_price = ? WHERE id = ?',
      [durationMinutes, blocksCount, totalPrice, id]
    );
    const res = await query('SELECT * FROM time_logs WHERE id = ?', [id]);
    return res.rows[0];
  },
  async findByUserId(userId: string): Promise<Timelog[]> {
    if (!useDb()) return db.timelogs.filter(t => t.user_id === userId);
    const res = await query('SELECT * FROM time_logs WHERE user_id = ? ORDER BY start_time DESC', [userId]);
    return res.rows;
  },
  async updateSignedStatus(id: string, is_signed: boolean): Promise<void> {
    if (!useDb()) {
      const t = db.timelogs.find(x => x.id === id);
      if (t) t.is_signed = is_signed;
      return;
    }
    await query('UPDATE time_logs SET is_signed = ? WHERE id = ?', [is_signed, id]);
  },
  // EIS-502
  async setCollectionMethod(id: string, collection_method: 'bar' | 'karte_sumup'): Promise<void> {
    if (!useDb()) {
      const t = db.timelogs.find(x => x.id === id);
      if (t) t.collection_method = collection_method;
      return;
    }
    await query('UPDATE time_logs SET collection_method = ? WHERE id = ?', [collection_method, id]);
  }
};

export const ReportRepo = {
  async create(assignment_id: string, timelog_id: string, created_by_user_id: string, notes: string): Promise<Report> {
    if (!useDb()) {
      const r = { id: Date.now().toString(), assignment_id, timelog_id, created_by_user_id, notes, signature_id: null, pdf_generated: false, email_sent: false, created_at: new Date().toISOString() };
      db.reports.push(r);
      return r;
    }
    const id = randomUUID();
    await query(
      'INSERT INTO reports (id, assignment_id, timelog_id, created_by_user_id, notes) VALUES (?, ?, ?, ?, ?)',
      [id, assignment_id, timelog_id, created_by_user_id, notes]
    );
    return { id, assignment_id, timelog_id, created_by_user_id, notes, signature_id: null, pdf_generated: false, email_sent: false, created_at: new Date().toISOString() };
  },
  async findByTimelogId(timelogId: string): Promise<Report | null> {
    if (!useDb()) return db.reports.find(r => r.timelog_id === timelogId) || null;
    const res = await query('SELECT * FROM reports WHERE timelog_id = ?', [timelogId]);
    return res.rows[0] || null;
  },
  async findById(id: string): Promise<Report | null> {
    if (!useDb()) return db.reports.find(r => r.id === id) || null;
    const res = await query('SELECT * FROM reports WHERE id = ?', [id]);
    return res.rows[0] || null;
  },
  async findAll(): Promise<Report[]> {
    if (!useDb()) return db.reports;
    const res = await query('SELECT * FROM reports ORDER BY created_at DESC');
    return res.rows;
  },
  async findByUserId(userId: string): Promise<Report[]> {
    if (!useDb()) return db.reports.filter(r => r.created_by_user_id === userId);
    const res = await query('SELECT * FROM reports WHERE created_by_user_id = ? ORDER BY created_at DESC', [userId]);
    return res.rows;
  },
  async updateSignature(id: string, signature_id: string): Promise<void> {
    if (!useDb()) {
      const r = db.reports.find(x => x.id === id);
      if (r) r.signature_id = signature_id;
      return;
    }
    await query('UPDATE reports SET signature_id = ? WHERE id = ?', [signature_id, id]);
  },
  async delete(id: string): Promise<boolean> {
    if (!useDb()) {
      const idx = db.reports.findIndex(x => x.id === id);
      if (idx === -1) return false;
      db.reports.splice(idx, 1);
      return true;
    }
    const res = await query('DELETE FROM reports WHERE id = ?', [id]);
    return res.rowCount > 0;
  },
  // EIS-502: Bar vs. Kartenzahlung (SumUp), gewählt vom Helfer nach Auftragsende
  async setCollectionMethod(id: string, collection_method: 'bar' | 'karte_sumup'): Promise<void> {
    if (!useDb()) {
      const r = db.reports.find(x => x.id === id);
      if (r) r.collection_method = collection_method;
      return;
    }
    await query('UPDATE reports SET collection_method = ? WHERE id = ?', [collection_method, id]);
  }
};

export const SignatureRepo = {
  async findById(id: string): Promise<Signature | null> {
    if (!useDb()) return db.signatures.find(s => s.id === id) || null;
    const res = await query('SELECT * FROM signatures WHERE id = ?', [id]);
    return res.rows[0] || null;
  },
  async create(timelog_id: string, image_data: string, signer_name: string): Promise<Signature> {
    if (!useDb()) {
      const s = { id: Date.now().toString(), report_id: '', timelog_id, image_data, signer_name, signed_at: new Date().toISOString() };
      db.signatures.push(s);
      return s;
    }
    const id = randomUUID();
    await query(
      'INSERT INTO signatures (id, timelog_id, image_data, signer_name) VALUES (?, ?, ?, ?)',
      [id, timelog_id, image_data, signer_name]
    );
    return { id, report_id: '', timelog_id, image_data, signer_name, signed_at: new Date().toISOString() };
  }
};

export const BookingRequestRepo = {
  async countOpen(): Promise<number> {
    if (!useDb()) return db.bookingRequests.filter(r => r.status === 'open').length;
    const res = await query("SELECT COUNT(*) as count FROM booking_requests WHERE status = 'open'");
    return parseInt(res.rows[0].count);
  },
  async findAll(status?: string): Promise<BookingRequest[]> {
    if (!useDb()) {
      let list = [...db.bookingRequests];
      if (status) list = list.filter(r => r.status === status);
      return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    let sql = 'SELECT * FROM booking_requests';
    const values: any[] = [];
    if (status) {
      sql += ' WHERE status = ?';
      values.push(status);
    }
    sql += ' ORDER BY created_at DESC';
    const res = await query(sql, values);
    return res.rows;
  },
  async create(data: Partial<BookingRequest>): Promise<BookingRequest> {
    const fullAddress = data.street
      ? `${data.street} ${data.house_number}, ${data.zip} ${data.city}`.trim()
      : data.address || '';

    if (!useDb()) {
      const entry: BookingRequest = {
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        name: data.name!,
        phone: data.phone!,
        email: data.email || '',
        address: fullAddress,
        street: data.street,
        house_number: data.house_number,
        zip: data.zip,
        city: data.city,
        service_description: data.service_description!,
        preferred_date: data.preferred_date!,
        preferred_time: data.preferred_time!,
        status: 'open',
        assigned_user_id: null,
        notes: '',
        created_at: new Date().toISOString(),
      };
      db.bookingRequests.push(entry);
      return entry;
    }
    const id = randomUUID();
    await query(
      'INSERT INTO booking_requests (id, name, phone, email, address, street, house_number, zip, city, service_description, preferred_date, preferred_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, data.name, data.phone, data.email || '', fullAddress, data.street || null, data.house_number || null, data.zip || null, data.city || null, data.service_description, data.preferred_date, data.preferred_time]
    );
    return {
      id,
      name: data.name!,
      phone: data.phone!,
      email: data.email || '',
      address: fullAddress,
      street: data.street,
      house_number: data.house_number,
      zip: data.zip,
      city: data.city,
      service_description: data.service_description!,
      preferred_date: data.preferred_date!,
      preferred_time: data.preferred_time!,
      status: 'open',
      assigned_user_id: null,
      notes: '',
      created_at: new Date().toISOString(),
    };
  },
  async findById(id: string): Promise<BookingRequest | null> {
    if (!useDb()) return db.bookingRequests.find(r => r.id === id) || null;
    const res = await query('SELECT * FROM booking_requests WHERE id = ?', [id]);
    return res.rows[0] || null;
  },
  async update(id: string, data: Partial<BookingRequest>): Promise<BookingRequest | null> {
    if (!useDb()) {
      const entry = db.bookingRequests.find(r => r.id === id);
      if (!entry) return null;
      if (data.status) entry.status = data.status;
      if (data.assigned_user_id !== undefined) entry.assigned_user_id = data.assigned_user_id;
      if (data.notes !== undefined) entry.notes = data.notes;
      return entry;
    }
    const fields: string[] = [];
    const values: any[] = [];
    if (data.status) {
      fields.push('status = ?');
      values.push(data.status);
    }
    if (data.assigned_user_id !== undefined) {
      fields.push('assigned_user_id = ?');
      values.push(data.assigned_user_id);
    }
    if (data.notes !== undefined) {
      fields.push('notes = ?');
      values.push(data.notes);
    }
    if (fields.length === 0) return this.findById(id);
    values.push(id);
    await query(`UPDATE booking_requests SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  },
  async delete(id: string): Promise<boolean> {
    if (!useDb()) {
      const idx = db.bookingRequests.findIndex(x => x.id === id);
      if (idx === -1) return false;
      db.bookingRequests.splice(idx, 1);
      return true;
    }
    const res = await query('DELETE FROM booking_requests WHERE id = ?', [id]);
    return res.rowCount > 0;
  }
};

export const RoleRepo = {
  async findAll(): Promise<Role[]> {
    if (!useDb()) return [];
    const res = await query('SELECT * FROM roles ORDER BY is_system DESC, name ASC');
    return res.rows;
  },
  async findByName(name: string): Promise<Role | null> {
    if (!useDb()) return null;
    const res = await query('SELECT * FROM roles WHERE name = ?', [name]);
    return res.rows[0] || null;
  },
  async findById(id: string): Promise<Role | null> {
    if (!useDb()) return null;
    const res = await query('SELECT * FROM roles WHERE id = ?', [id]);
    return res.rows[0] || null;
  },
  async create(name: string, display_name: string, permissions: string[]): Promise<Role> {
    const id = randomUUID();
    const permsJson = JSON.stringify(permissions);
    await query(
      'INSERT INTO roles (id, name, display_name, is_system, permissions) VALUES (?, ?, ?, FALSE, ?)',
      [id, name, display_name, permsJson]
    );
    return { id, name, display_name, is_system: false, permissions: permsJson, created_at: new Date().toISOString() };
  },
  async update(id: string, display_name: string, permissions: string[]): Promise<boolean> {
    const res = await query(
      'UPDATE roles SET display_name = ?, permissions = ? WHERE id = ?',
      [display_name, JSON.stringify(permissions), id]
    );
    return res.rowCount > 0;
  },
  async delete(id: string): Promise<boolean> {
    const res = await query('DELETE FROM roles WHERE id = ? AND is_system = FALSE', [id]);
    return res.rowCount > 0;
  }
};

export const AuditRepo = {
  async create(entity_type: string, entity_id: string, action: string, actor_user_id: string, details: string): Promise<void> {
    if (!useDb()) {
      db.audit.push({
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        entity_type,
        entity_id,
        action,
        actor_user_id,
        details,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    const id = randomUUID();
    await query(
      'INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, details) VALUES (?, ?, ?, ?, ?, ?)',
      [id, entity_type, entity_id, action, actor_user_id, details]
    );
  },
  async findAll(params?: { entity_type?: string, entity_id?: string, limit?: number }): Promise<any[]> {
    if (!useDb()) {
      let entries = [...db.audit].reverse();
      if (params?.entity_type) entries = entries.filter(e => e.entity_type === params.entity_type);
      if (params?.entity_id) entries = entries.filter(e => e.entity_id === params.entity_id);
      if (params?.limit) entries = entries.slice(0, params.limit);
      return entries.map(e => ({ ...e, performed_by: e.actor_user_id, description: e.details }));
    }
    let sql = 'SELECT id, entity_type, entity_id, action, actor_user_id AS performed_by, details AS description, created_at AS timestamp FROM audit_logs';
    const conditions: string[] = [];
    const values: any[] = [];
    if (params?.entity_type) {
      conditions.push('entity_type = ?');
      values.push(params.entity_type);
    }
    if (params?.entity_id) {
      conditions.push('entity_id = ?');
      values.push(params.entity_id);
    }
    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY created_at DESC';
    if (params?.limit) {
      sql += ' LIMIT ?';
      values.push(params.limit);
    }
    const res = await query(sql, values);
    return res.rows;
  }
};

export const ShopArticleRepo = {
  async findAll(activeOnly = false): Promise<ShopArticle[]> {
    if (!useDb()) return [];
    const sql = activeOnly
      ? 'SELECT * FROM shop_articles WHERE active = TRUE ORDER BY name ASC'
      : 'SELECT * FROM shop_articles ORDER BY name ASC';
    const res = await query(sql);
    return res.rows;
  },
  async findById(id: string): Promise<ShopArticle | null> {
    if (!useDb()) return null;
    const res = await query('SELECT * FROM shop_articles WHERE id = ?', [id]);
    return res.rows[0] || null;
  },
  async create(data: { name: string; description: string; price: number; image_url?: string; stock: number }): Promise<ShopArticle> {
    const id = randomUUID();
    await query(
      'INSERT INTO shop_articles (id, name, description, price, image_url, stock) VALUES (?, ?, ?, ?, ?, ?)',
      [id, data.name, data.description, data.price, data.image_url || '', data.stock]
    );
    return { id, name: data.name, description: data.description, price: data.price, image_url: data.image_url || '', stock: data.stock, active: true, created_at: new Date().toISOString() };
  },
  async update(id: string, data: Partial<ShopArticle>): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
    if (data.price !== undefined) { fields.push('price = ?'); values.push(data.price); }
    if (data.image_url !== undefined) { fields.push('image_url = ?'); values.push(data.image_url); }
    if (data.stock !== undefined) { fields.push('stock = ?'); values.push(data.stock); }
    if (data.active !== undefined) { fields.push('active = ?'); values.push(data.active); }
    if (fields.length === 0) return false;
    values.push(id);
    const res = await query(`UPDATE shop_articles SET ${fields.join(', ')} WHERE id = ?`, values);
    return res.rowCount > 0;
  },
  async delete(id: string): Promise<boolean> {
    const res = await query('DELETE FROM shop_articles WHERE id = ?', [id]);
    return res.rowCount > 0;
  }
};

export const SipUserRepo = {
  async findAll(): Promise<SipUser[]> {
    if (!useDb()) return db.sipUsers || [];
    const res = await query('SELECT * FROM sip_users ORDER BY username ASC');
    return res.rows;
  },
  async findById(id: string): Promise<SipUser | null> {
    if (!useDb()) return (db.sipUsers || []).find(u => u.id === id) || null;
    const res = await query('SELECT * FROM sip_users WHERE id = ?', [id]);
    return res.rows[0] || null;
  },
  async findByUsername(username: string): Promise<SipUser | null> {
    if (!useDb()) return (db.sipUsers || []).find(u => u.username === username) || null;
    const res = await query('SELECT * FROM sip_users WHERE username = ?', [username]);
    return res.rows[0] || null;
  },
  async create(username: string, password_hash: string, full_name: string): Promise<SipUser> {
    const id = randomUUID();
    const created_at = new Date().toISOString();
    if (!useDb()) {
      const u = { id, username, password: password_hash, full_name, created_at };
      if (!db.sipUsers) db.sipUsers = [];
      db.sipUsers.push(u);
      return u;
    }
    await query(
      'INSERT INTO sip_users (id, username, password, full_name) VALUES (?, ?, ?, ?)',
      [id, username, password_hash, full_name]
    );
    return { id, username, password: password_hash, full_name, created_at };
  },
  async delete(id: string): Promise<boolean> {
    if (!useDb()) {
      if (!db.sipUsers) return false;
      const idx = db.sipUsers.findIndex(u => u.id === id);
      if (idx === -1) return false;
      db.sipUsers.splice(idx, 1);
      return true;
    }
    const res = await query('DELETE FROM sip_users WHERE id = ?', [id]);
    return res.rowCount > 0;
  }
};

// EIS-500: Abwesenheits-/Urlaubsantrag Self-Service
export const LeaveRequestRepo = {
  async findByUserId(userId: string): Promise<LeaveRequest[]> {
    if (!useDb()) {
      return db.leaveRequests
        .filter(r => r.user_id === userId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    const res = await query('SELECT * FROM leave_requests WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    return res.rows;
  },
  async findAll(status?: string): Promise<(LeaveRequest & { user_name?: string })[]> {
    if (!useDb()) {
      let list = [...db.leaveRequests];
      if (status) list = list.filter(r => r.status === status);
      return list
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .map(r => ({ ...r, user_name: db.users.find(u => u.id === r.user_id)?.full_name }));
    }
    let sql = 'SELECT lr.*, u.full_name as user_name FROM leave_requests lr JOIN users u ON u.id = lr.user_id';
    const values: any[] = [];
    if (status) {
      sql += ' WHERE lr.status = ?';
      values.push(status);
    }
    sql += ' ORDER BY lr.created_at DESC';
    const res = await query(sql, values);
    return res.rows;
  },
  async countPending(): Promise<number> {
    if (!useDb()) return db.leaveRequests.filter(r => r.status === 'pending').length;
    const res = await query("SELECT COUNT(*) as count FROM leave_requests WHERE status = 'pending'");
    return parseInt(res.rows[0].count);
  },
  async findById(id: string): Promise<LeaveRequest | null> {
    if (!useDb()) return db.leaveRequests.find(r => r.id === id) || null;
    const res = await query('SELECT * FROM leave_requests WHERE id = ?', [id]);
    return res.rows[0] || null;
  },
  async create(data: { user_id: string; type: 'urlaub' | 'krankmeldung'; start_date: string; end_date: string; reason?: string | null }): Promise<LeaveRequest> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const entry: LeaveRequest = {
      id,
      user_id: data.user_id,
      type: data.type,
      start_date: data.start_date,
      end_date: data.end_date,
      reason: data.reason || null,
      status: 'pending',
      reviewed_by_user_id: null,
      review_note: null,
      created_at: now,
      reviewed_at: null,
    };
    if (!useDb()) {
      db.leaveRequests.push(entry);
      return entry;
    }
    await query(
      'INSERT INTO leave_requests (id, user_id, type, start_date, end_date, reason) VALUES (?, ?, ?, ?, ?, ?)',
      [id, data.user_id, data.type, data.start_date, data.end_date, data.reason || null]
    );
    return entry;
  },
  async updateStatus(id: string, data: { status: 'approved' | 'rejected'; reviewed_by_user_id: string; review_note?: string | null }): Promise<LeaveRequest | null> {
    const reviewed_at = new Date().toISOString();
    if (!useDb()) {
      const entry = db.leaveRequests.find(r => r.id === id);
      if (!entry) return null;
      entry.status = data.status;
      entry.reviewed_by_user_id = data.reviewed_by_user_id;
      entry.review_note = data.review_note ?? null;
      entry.reviewed_at = reviewed_at;
      return entry;
    }
    await query(
      'UPDATE leave_requests SET status = ?, reviewed_by_user_id = ?, review_note = ?, reviewed_at = NOW() WHERE id = ?',
      [data.status, data.reviewed_by_user_id, data.review_note ?? null, id]
    );
    return this.findById(id);
  },
};

// EIS-507: persist shop orders so admins have an overview (previously email-only)
export const ShopOrderRepo = {
  async findAll(): Promise<ShopOrder[]> {
    if (!useDb()) {
      return [...db.shopOrders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    const res = await query('SELECT * FROM shop_orders ORDER BY created_at DESC');
    return res.rows;
  },
  async findById(id: string): Promise<ShopOrder | null> {
    if (!useDb()) return db.shopOrders.find(o => o.id === id) || null;
    const res = await query('SELECT * FROM shop_orders WHERE id = ?', [id]);
    return res.rows[0] || null;
  },
  async create(data: { customer_name: string; customer_email: string; items: { name: string; quantity: number; price: number }[]; total: number }): Promise<ShopOrder> {
    const id = randomUUID();
    const entry: ShopOrder = {
      id,
      customer_name: data.customer_name,
      customer_email: data.customer_email,
      items: JSON.stringify(data.items),
      total: data.total,
      status: 'new',
      created_at: new Date().toISOString(),
    };
    if (!useDb()) {
      db.shopOrders.push(entry);
      return entry;
    }
    await query(
      'INSERT INTO shop_orders (id, customer_name, customer_email, items, total, status) VALUES (?, ?, ?, ?, ?, ?)',
      [id, data.customer_name, data.customer_email, entry.items, data.total, 'new']
    );
    return entry;
  },
  async updateStatus(id: string, status: 'new' | 'done'): Promise<ShopOrder | null> {
    if (!useDb()) {
      const entry = db.shopOrders.find(o => o.id === id);
      if (!entry) return null;
      entry.status = status;
      return entry;
    }
    const res = await query('UPDATE shop_orders SET status = ? WHERE id = ?', [status, id]);
    if (res.rowCount === 0) return null;
    return this.findById(id);
  },
};
