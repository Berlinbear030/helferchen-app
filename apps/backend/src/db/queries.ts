import { query } from './pool';
import { User, Customer, Assignment, Timelog, Report, Signature, BookingRequest } from './index';

export const UserRepo = {
  async findByUsername(username: string): Promise<User | null> {
    const res = await query('SELECT * FROM users WHERE username = $1', [username]);
    return res.rows[0] || null;
  },
  async findById(id: string): Promise<User | null> {
    const res = await query('SELECT * FROM users WHERE id = $1', [id]);
    return res.rows[0] || null;
  }
};

export const CustomerRepo = {
  async findAll(): Promise<Customer[]> {
    const res = await query('SELECT * FROM customers ORDER BY created_at DESC');
    return res.rows;
  },
  async findById(id: string): Promise<Customer | null> {
    const res = await query('SELECT * FROM customers WHERE id = $1', [id]);
    return res.rows[0] || null;
  }
};

export const AssignmentRepo = {
  async findAll(): Promise<Assignment[]> {
    const res = await query('SELECT * FROM assignments ORDER BY scheduled_at DESC');
    return res.rows;
  },
  async findByUserId(userId: string): Promise<Assignment[]> {
    const res = await query('SELECT * FROM assignments WHERE assigned_user_id = $1 ORDER BY scheduled_at DESC', [userId]);
    return res.rows;
  },
  async findById(id: string): Promise<Assignment | null> {
    const res = await query('SELECT * FROM assignments WHERE id = $1', [id]);
    return res.rows[0] || null;
  },
  async create(customer_id: string, assigned_user_id: string, title: string, description: string, scheduled_at: string): Promise<Assignment> {
    const res = await query(
      'INSERT INTO assignments (customer_id, assigned_user_id, title, description, scheduled_at) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [customer_id, assigned_user_id, title, description, scheduled_at]
    );
    return res.rows[0];
  },
  async updateStatus(id: string, status: string): Promise<void> {
    await query('UPDATE assignments SET status = $1 WHERE id = $2', [status, id]);
  },
  async countAll(): Promise<number> {
    const res = await query('SELECT COUNT(*) FROM assignments');
    return parseInt(res.rows[0].count);
  },
  async countByUserId(userId: string): Promise<number> {
    const res = await query('SELECT COUNT(*) FROM assignments WHERE assigned_user_id = $1', [userId]);
    return parseInt(res.rows[0].count);
  }
};

export const TimelogRepo = {
  async findActive(userId: string, assignmentId: string): Promise<Timelog | null> {
    const res = await query(
      'SELECT * FROM time_logs WHERE user_id = $1 AND assignment_id = $2 AND end_time IS NULL',
      [userId, assignmentId]
    );
    return res.rows[0] || null;
  },
  async create(userId: string, assignmentId: string): Promise<Timelog> {
    const res = await query(
      'INSERT INTO time_logs (user_id, assignment_id, start_time) VALUES ($1, $2, CURRENT_TIMESTAMP) RETURNING *',
      [userId, assignmentId]
    );
    return res.rows[0];
  },
  async stop(id: string): Promise<Timelog> {
    const res = await query(
      'UPDATE time_logs SET end_time = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    return res.rows[0];
  },
  async findByUserId(userId: string): Promise<Timelog[]> {
    const res = await query('SELECT * FROM time_logs WHERE user_id = $1 ORDER BY start_time DESC', [userId]);
    return res.rows;
  },
  async updateSignedStatus(id: string, is_signed: boolean): Promise<void> {
    await query('UPDATE time_logs SET is_signed = $1 WHERE id = $2', [is_signed, id]);
  }
};

export const ReportRepo = {
  async create(assignment_id: string, timelog_id: string, created_by_user_id: string, notes: string): Promise<Report> {
    const res = await query(
      'INSERT INTO reports (assignment_id, timelog_id, created_by_user_id, notes) VALUES ($1, $2, $3, $4) RETURNING *',
      [assignment_id, timelog_id, created_by_user_id, notes]
    );
    return res.rows[0];
  },
  async findById(id: string): Promise<Report | null> {
    const res = await query('SELECT * FROM reports WHERE id = $1', [id]);
    return res.rows[0] || null;
  },
  async findAll(): Promise<Report[]> {
    const res = await query('SELECT * FROM reports ORDER BY created_at DESC');
    return res.rows;
  },
  async findByUserId(userId: string): Promise<Report[]> {
    const res = await query('SELECT * FROM reports WHERE created_by_user_id = $1 ORDER BY created_at DESC', [userId]);
    return res.rows;
  },
  async updateSignature(id: string, signature_id: string): Promise<void> {
    await query('UPDATE reports SET signature_id = $1 WHERE id = $2', [signature_id, id]);
  }
};

export const SignatureRepo = {
  async create(timelog_id: string, image_data: string, signer_name: string): Promise<Signature> {
    const res = await query(
      'INSERT INTO signatures (timelog_id, image_data, signer_name) VALUES ($1, $2, $3) RETURNING *',
      [timelog_id, image_data, signer_name]
    );
    return res.rows[0];
  }
};

export const BookingRequestRepo = {
  async countOpen(): Promise<number> {
    const res = await query("SELECT COUNT(*) FROM booking_requests WHERE status = 'open'");
    return parseInt(res.rows[0].count);
  }
};
