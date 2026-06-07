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
  }
};
