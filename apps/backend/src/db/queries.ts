import db, { User, Customer, Assignment, Timelog, Report, Signature, BookingRequest } from './index';
import { query } from './pool';

const useDb = !!process.env.DATABASE_URL;

export const UserRepo = {
  async findByUsername(username: string): Promise<User | null> {
    if (!useDb) return db.users.find(u => u.username === username) || null;
    const res = await query('SELECT * FROM users WHERE username = $1', [username]);
    return res.rows[0] || null;
  },
  async findById(id: string): Promise<User | null> {
    if (!useDb) return db.users.find(u => u.id === id) || null;
    const res = await query('SELECT * FROM users WHERE id = $1', [id]);
    return res.rows[0] || null;
  },
  async findAll(): Promise<User[]> {
    if (!useDb) return db.users;
    const res = await query('SELECT id, username, full_name, email, role, created_at FROM users ORDER BY username ASC');
    return res.rows;
  },
  async create(username: string, password_hash: string, full_name: string, email: string, role: string): Promise<User> {
    if (!useDb) {
      const u = { id: Date.now().toString(), username, password_hash, full_name, email, role: role as any, created_at: new Date().toISOString() };
      db.users.push(u);
      return u;
    }
    const res = await query(
      'INSERT INTO users (username, password_hash, full_name, email, role) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [username, password_hash, full_name, email, role]
    );
    return res.rows[0];
  },
  async delete(id: string): Promise<boolean> {
    if (!useDb) {
      const idx = db.users.findIndex(u => u.id === id);
      if (idx === -1) return false;
      db.users.splice(idx, 1);
      return true;
    }
    const res = await query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    return (res.rowCount ?? 0) > 0;
  },
  async countAll(): Promise<number> {
    if (!useDb) return db.users.length;
    const res = await query('SELECT COUNT(*) FROM users');
    return parseInt(res.rows[0].count);
  }
};

export const CustomerRepo = {
  async findAll(): Promise<Customer[]> {
    if (!useDb) return db.customers;
    const res = await query('SELECT * FROM customers ORDER BY created_at DESC');
    return res.rows;
  },
  async findById(id: string): Promise<Customer | null> {
    if (!useDb) return db.customers.find(c => c.id === id) || null;
    const res = await query('SELECT * FROM customers WHERE id = $1', [id]);
    return res.rows[0] || null;
  },
  async create(first_name: string, last_name: string, address: string, phone_number: string, notes: string): Promise<Customer> {
    if (!useDb) {
      const c = { id: Date.now().toString(), first_name, last_name, address, phone_number, notes, created_at: new Date().toISOString() };
      db.customers.push(c);
      return c;
    }
    const res = await query(
      'INSERT INTO customers (first_name, last_name, address, phone_number, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [first_name, last_name, address, phone_number, notes]
    );
    return res.rows[0];
  }
};

export const AssignmentRepo = {
  async findAll(): Promise<Assignment[]> {
    if (!useDb) return db.assignments;
    const res = await query('SELECT * FROM assignments ORDER BY scheduled_at DESC');
    return res.rows;
  },
  async findByUserId(userId: string): Promise<Assignment[]> {
    if (!useDb) return db.assignments.filter(a => a.assigned_user_id === userId);
    const res = await query('SELECT * FROM assignments WHERE assigned_user_id = $1 ORDER BY scheduled_at DESC', [userId]);
    return res.rows;
  },
  async findById(id: string): Promise<Assignment | null> {
    if (!useDb) return db.assignments.find(a => a.id === id) || null;
    const res = await query('SELECT * FROM assignments WHERE id = $1', [id]);
    return res.rows[0] || null;
  },
  async create(customer_id: string, assigned_user_id: string, title: string, description: string, scheduled_at: string): Promise<Assignment> {
    if (!useDb) {
      const a = { id: Date.now().toString(), customer_id, assigned_user_id, title, description, scheduled_at, status: 'pending' as const, created_at: new Date().toISOString() };
      db.assignments.push(a);
      return a;
    }
    const res = await query(
      'INSERT INTO assignments (customer_id, assigned_user_id, title, description, scheduled_at) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [customer_id, assigned_user_id, title, description, scheduled_at]
    );
    return res.rows[0];
  },
  async updateStatus(id: string, status: string): Promise<void> {
    if (!useDb) {
      const a = db.assignments.find(x => x.id === id);
      if (a) a.status = status as any;
      return;
    }
    await query('UPDATE assignments SET status = $1 WHERE id = $2', [status, id]);
  },
  async delete(id: string): Promise<boolean> {
    if (!useDb) {
      const idx = db.assignments.findIndex(x => x.id === id);
      if (idx === -1) return false;
      db.assignments.splice(idx, 1);
      return true;
    }
    const res = await query('DELETE FROM assignments WHERE id = $1 RETURNING id', [id]);
    return (res.rowCount ?? 0) > 0;
  },
  async countAll(): Promise<number> {
    if (!useDb) return db.assignments.length;
    const res = await query('SELECT COUNT(*) FROM assignments');
    return parseInt(res.rows[0].count);
  },
  async countByUserId(userId: string): Promise<number> {
    if (!useDb) return db.assignments.filter(a => a.assigned_user_id === userId).length;
    const res = await query('SELECT COUNT(*) FROM assignments WHERE assigned_user_id = $1', [userId]);
    return parseInt(res.rows[0].count);
  }
};

export const TimelogRepo = {
  async findById(id: string): Promise<Timelog | null> {
    if (!useDb) return db.timelogs.find(t => t.id === id) || null;
    const res = await query('SELECT * FROM time_logs WHERE id = $1', [id]);
    return res.rows[0] || null;
  },
  async findActive(userId: string, assignmentId: string): Promise<Timelog | null> {
    if (!useDb) return db.timelogs.find(t => t.user_id === userId && t.assignment_id === assignmentId && !t.end_time) || null;
    const res = await query(
      'SELECT * FROM time_logs WHERE user_id = $1 AND assignment_id = $2 AND end_time IS NULL',
      [userId, assignmentId]
    );
    return res.rows[0] || null;
  },
  async create(userId: string, assignmentId: string): Promise<Timelog> {
    if (!useDb) {
      const t = { id: Date.now().toString(), user_id: userId, assignment_id: assignmentId, start_time: new Date().toISOString(), end_time: null, is_signed: false, created_at: new Date().toISOString() };
      db.timelogs.push(t);
      return t;
    }
    const res = await query(
      'INSERT INTO time_logs (user_id, assignment_id, start_time) VALUES ($1, $2, CURRENT_TIMESTAMP) RETURNING *',
      [userId, assignmentId]
    );
    return res.rows[0];
  },
  async stop(id: string): Promise<Timelog> {
    if (!useDb) {
      const t = db.timelogs.find(x => x.id === id);
      if (t) t.end_time = new Date().toISOString();
      return t!;
    }
    const res = await query(
      'UPDATE time_logs SET end_time = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    return res.rows[0];
  },
  async findByUserId(userId: string): Promise<Timelog[]> {
    if (!useDb) return db.timelogs.filter(t => t.user_id === userId);
    const res = await query('SELECT * FROM time_logs WHERE user_id = $1 ORDER BY start_time DESC', [userId]);
    return res.rows;
  },
  async updateSignedStatus(id: string, is_signed: boolean): Promise<void> {
    if (!useDb) {
      const t = db.timelogs.find(x => x.id === id);
      if (t) t.is_signed = is_signed;
      return;
    }
    await query('UPDATE time_logs SET is_signed = $1 WHERE id = $2', [is_signed, id]);
  }
};

export const ReportRepo = {
  async create(assignment_id: string, timelog_id: string, created_by_user_id: string, notes: string): Promise<Report> {
    if (!useDb) {
      const r = { id: Date.now().toString(), assignment_id, timelog_id, created_by_user_id, notes, signature_id: null, pdf_generated: false, email_sent: false, created_at: new Date().toISOString() };
      db.reports.push(r);
      return r;
    }
    const res = await query(
      'INSERT INTO reports (assignment_id, timelog_id, created_by_user_id, notes) VALUES ($1, $2, $3, $4) RETURNING *',
      [assignment_id, timelog_id, created_by_user_id, notes]
    );
    return res.rows[0];
  },
  async findByTimelogId(timelogId: string): Promise<Report | null> {
    if (!useDb) return db.reports.find(r => r.timelog_id === timelogId) || null;
    const res = await query('SELECT * FROM reports WHERE timelog_id = $1', [timelogId]);
    return res.rows[0] || null;
  },
  async findById(id: string): Promise<Report | null> {
    if (!useDb) return db.reports.find(r => r.id === id) || null;
    const res = await query('SELECT * FROM reports WHERE id = $1', [id]);
    return res.rows[0] || null;
  },
  async findAll(): Promise<Report[]> {
    if (!useDb) return db.reports;
    const res = await query('SELECT * FROM reports ORDER BY created_at DESC');
    return res.rows;
  },
  async findByUserId(userId: string): Promise<Report[]> {
    if (!useDb) return db.reports.filter(r => r.created_by_user_id === userId);
    const res = await query('SELECT * FROM reports WHERE created_by_user_id = $1 ORDER BY created_at DESC', [userId]);
    return res.rows;
  },
  async updateSignature(id: string, signature_id: string): Promise<void> {
    if (!useDb) {
      const r = db.reports.find(x => x.id === id);
      if (r) r.signature_id = signature_id;
      return;
    }
    await query('UPDATE reports SET signature_id = $1 WHERE id = $2', [signature_id, id]);
  }
};

export const SignatureRepo = {
  async findById(id: string): Promise<Signature | null> {
    if (!useDb) return db.signatures.find(s => s.id === id) || null;
    const res = await query('SELECT * FROM signatures WHERE id = $1', [id]);
    return res.rows[0] || null;
  },
  async create(timelog_id: string, image_data: string, signer_name: string): Promise<Signature> {
    if (!useDb) {
      const s = { id: Date.now().toString(), report_id: '', timelog_id, image_data, signer_name, signed_at: new Date().toISOString() };
      db.signatures.push(s);
      return s;
    }
    const res = await query(
      'INSERT INTO signatures (timelog_id, image_data, signer_name) VALUES ($1, $2, $3) RETURNING *',
      [timelog_id, image_data, signer_name]
    );
    return res.rows[0];
  }
};

export const BookingRequestRepo = {
  async countOpen(): Promise<number> {
    if (!useDb) return db.bookingRequests.filter(r => r.status === 'open').length;
    const res = await query("SELECT COUNT(*) FROM booking_requests WHERE status = 'open'");
    return parseInt(res.rows[0].count);
  },
  async findAll(status?: string): Promise<BookingRequest[]> {
    if (!useDb) {
      let list = [...db.bookingRequests];
      if (status) list = list.filter(r => r.status === status);
      return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    let sql = 'SELECT * FROM booking_requests';
    const values: any[] = [];
    if (status) {
      sql += ' WHERE status = $1';
      values.push(status);
    }
    sql += ' ORDER BY created_at DESC';
    const res = await query(sql, values);
    return res.rows;
  },
  async create(data: Partial<BookingRequest>): Promise<BookingRequest> {
    if (!useDb) {
      const entry = {
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        name: data.name!,
        phone: data.phone!,
        email: data.email || '',
        service_description: data.service_description!,
        preferred_date: data.preferred_date!,
        preferred_time: data.preferred_time!,
        status: 'open' as const,
        assigned_user_id: null,
        notes: '',
        created_at: new Date().toISOString(),
      };
      db.bookingRequests.push(entry);
      return entry;
    }
    const res = await query(
      'INSERT INTO booking_requests (name, phone, email, service_description, preferred_date, preferred_time) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [data.name, data.phone, data.email, data.service_description, data.preferred_date, data.preferred_time]
    );
    return res.rows[0];
  },
  async findById(id: string): Promise<BookingRequest | null> {
    if (!useDb) return db.bookingRequests.find(r => r.id === id) || null;
    const res = await query('SELECT * FROM booking_requests WHERE id = $1', [id]);
    return res.rows[0] || null;
  },
  async update(id: string, data: Partial<BookingRequest>): Promise<BookingRequest | null> {
    if (!useDb) {
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
      fields.push(`status = $${values.length + 1}`);
      values.push(data.status);
    }
    if (data.assigned_user_id !== undefined) {
      fields.push(`assigned_user_id = $${values.length + 1}`);
      values.push(data.assigned_user_id);
    }
    if (data.notes !== undefined) {
      fields.push(`notes = $${values.length + 1}`);
      values.push(data.notes);
    }
    if (fields.length === 0) return this.findById(id);
    values.push(id);
    const res = await query(
      `UPDATE booking_requests SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    return res.rows[0];
  }
};

export const AuditRepo = {
  async create(entity_type: string, entity_id: string, action: string, actor_user_id: string, details: string): Promise<void> {
    if (!useDb) {
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
    await query(
      'INSERT INTO audit_logs (entity_type, entity_id, action, actor_user_id, details) VALUES ($1, $2, $3, $4, $5)',
      [entity_type, entity_id, action, actor_user_id, details]
    );
  },
  async findAll(params?: { entity_type?: string, entity_id?: string, limit?: number }): Promise<AuditEntry[]> {
    if (!useDb) {
      let entries = [...db.audit].reverse();
      if (params?.entity_type) entries = entries.filter(e => e.entity_type === params.entity_type);
      if (params?.entity_id) entries = entries.filter(e => e.entity_id === params.entity_id);
      if (params?.limit) entries = entries.slice(0, params.limit);
      return entries;
    }
    let sql = 'SELECT id, entity_type, entity_id, action, actor_user_id, details, created_at as timestamp FROM audit_logs';
    const conditions: string[] = [];
    const values: any[] = [];
    if (params?.entity_type) {
      conditions.push(`entity_type = $${values.length + 1}`);
      values.push(params.entity_type);
    }
    if (params?.entity_id) {
      conditions.push(`entity_id = $${values.length + 1}`);
      values.push(params.entity_id);
    }
    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY created_at DESC';
    if (params?.limit) {
      sql += ` LIMIT $${values.length + 1}`;
      values.push(params.limit);
    }
    const res = await query(sql, values);
    return res.rows;
  }
};
