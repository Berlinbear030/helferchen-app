import db, { User, Customer, Assignment, Timelog, Report, Signature, BookingRequest, ShopArticle, AuditEntry, Role, SipUser } from './index';
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
    const res = await query('SELECT id, username, full_name, email, role, address, qualification, permissions, created_at FROM users WHERE deleted_at IS NULL ORDER BY username ASC');
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
  async update(id: string, fields: { password_hash?: string; email?: string; full_name?: string; role?: string; address?: string; qualification?: string; permissions?: string }): Promise<boolean> {
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
    if (setClauses.length === 0) return false;
    values.push(id);
    const res = await query(`UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`, values);
    return res.rowCount > 0;
  },
  async countAll(): Promise<number> {
    if (!useDb()) return db.users.length;
    const res = await query('SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL');
    return parseInt(res.rows[0].count);
  }
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
  async create(customer_id: string, assigned_user_id: string | null, title: string, description: string, scheduled_at: string, booking_request_id: string | null = null, hourly_rate: number = 65.00): Promise<Assignment> {
    if (!useDb()) {
      const a = { id: Date.now().toString(), customer_id, assigned_user_id: assigned_user_id || '', title, description, scheduled_at, status: 'pending' as const, hourly_rate, created_at: new Date().toISOString(), booking_request_id: booking_request_id || '' };
      db.assignments.push(a as any);
      return a as any;
    }
    const id = randomUUID();
    const formattedDate = scheduled_at.replace('T', ' ').slice(0, 19).padEnd(19, ':00').slice(0, 19);
    await query(
      'INSERT INTO assignments (id, customer_id, assigned_user_id, title, description, scheduled_at, booking_request_id, hourly_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, customer_id, assigned_user_id || null, title, description, formattedDate, booking_request_id, hourly_rate]
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
    // €20 first 15 min, +€15 per additional 15-min block (same as MobileApp calcPrice)
    const totalPrice = durationMinutes <= 15 ? 20 : 20 + Math.ceil((durationMinutes - 15) / 15) * 15;
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
