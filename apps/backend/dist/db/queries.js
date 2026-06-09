"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditRepo = exports.BookingRequestRepo = exports.SignatureRepo = exports.ReportRepo = exports.TimelogRepo = exports.AssignmentRepo = exports.CustomerRepo = exports.UserRepo = void 0;
const index_1 = __importDefault(require("./index"));
const pool_1 = require("./pool");
const useDb = !!process.env.DATABASE_URL;
exports.UserRepo = {
    async findByUsername(username) {
        if (!useDb)
            return index_1.default.users.find(u => u.username === username) || null;
        const res = await (0, pool_1.query)('SELECT * FROM users WHERE username = $1', [username]);
        return res.rows[0] || null;
    },
    async findById(id) {
        if (!useDb)
            return index_1.default.users.find(u => u.id === id) || null;
        const res = await (0, pool_1.query)('SELECT * FROM users WHERE id = $1', [id]);
        return res.rows[0] || null;
    },
    async findAll() {
        if (!useDb)
            return index_1.default.users;
        const res = await (0, pool_1.query)('SELECT id, username, full_name, email, role, created_at FROM users ORDER BY username ASC');
        return res.rows;
    },
    async create(username, password_hash, full_name, email, role) {
        if (!useDb) {
            const u = { id: Date.now().toString(), username, password_hash, full_name, email, role: role, created_at: new Date().toISOString() };
            index_1.default.users.push(u);
            return u;
        }
        const res = await (0, pool_1.query)('INSERT INTO users (username, password_hash, full_name, email, role) VALUES ($1, $2, $3, $4, $5) RETURNING *', [username, password_hash, full_name, email, role]);
        return res.rows[0];
    },
    async delete(id) {
        if (!useDb) {
            const idx = index_1.default.users.findIndex(u => u.id === id);
            if (idx === -1)
                return false;
            index_1.default.users.splice(idx, 1);
            return true;
        }
        const res = await (0, pool_1.query)('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
        return (res.rowCount ?? 0) > 0;
    },
    async countAll() {
        if (!useDb)
            return index_1.default.users.length;
        const res = await (0, pool_1.query)('SELECT COUNT(*) FROM users');
        return parseInt(res.rows[0].count);
    }
};
exports.CustomerRepo = {
    async findAll() {
        if (!useDb)
            return index_1.default.customers;
        const res = await (0, pool_1.query)('SELECT * FROM customers ORDER BY created_at DESC');
        return res.rows;
    },
    async findById(id) {
        if (!useDb)
            return index_1.default.customers.find(c => c.id === id) || null;
        const res = await (0, pool_1.query)('SELECT * FROM customers WHERE id = $1', [id]);
        return res.rows[0] || null;
    },
    async create(first_name, last_name, address, phone_number, notes) {
        if (!useDb) {
            const c = { id: Date.now().toString(), first_name, last_name, address, phone_number, notes, created_at: new Date().toISOString() };
            index_1.default.customers.push(c);
            return c;
        }
        const res = await (0, pool_1.query)('INSERT INTO customers (first_name, last_name, address, phone_number, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *', [first_name, last_name, address, phone_number, notes]);
        return res.rows[0];
    }
};
exports.AssignmentRepo = {
    async findAll() {
        if (!useDb)
            return index_1.default.assignments;
        const res = await (0, pool_1.query)('SELECT * FROM assignments ORDER BY scheduled_at DESC');
        return res.rows;
    },
    async findByUserId(userId) {
        if (!useDb)
            return index_1.default.assignments.filter(a => a.assigned_user_id === userId);
        const res = await (0, pool_1.query)('SELECT * FROM assignments WHERE assigned_user_id = $1 ORDER BY scheduled_at DESC', [userId]);
        return res.rows;
    },
    async findById(id) {
        if (!useDb)
            return index_1.default.assignments.find(a => a.id === id) || null;
        const res = await (0, pool_1.query)('SELECT * FROM assignments WHERE id = $1', [id]);
        return res.rows[0] || null;
    },
    async create(customer_id, assigned_user_id, title, description, scheduled_at) {
        if (!useDb) {
            const a = { id: Date.now().toString(), customer_id, assigned_user_id, title, description, scheduled_at, status: 'pending', created_at: new Date().toISOString() };
            index_1.default.assignments.push(a);
            return a;
        }
        const res = await (0, pool_1.query)('INSERT INTO assignments (customer_id, assigned_user_id, title, description, scheduled_at) VALUES ($1, $2, $3, $4, $5) RETURNING *', [customer_id, assigned_user_id, title, description, scheduled_at]);
        return res.rows[0];
    },
    async updateStatus(id, status) {
        if (!useDb) {
            const a = index_1.default.assignments.find(x => x.id === id);
            if (a)
                a.status = status;
            return;
        }
        await (0, pool_1.query)('UPDATE assignments SET status = $1 WHERE id = $2', [status, id]);
    },
    async delete(id) {
        if (!useDb) {
            const idx = index_1.default.assignments.findIndex(x => x.id === id);
            if (idx === -1)
                return false;
            index_1.default.assignments.splice(idx, 1);
            return true;
        }
        const res = await (0, pool_1.query)('DELETE FROM assignments WHERE id = $1 RETURNING id', [id]);
        return (res.rowCount ?? 0) > 0;
    },
    async countAll() {
        if (!useDb)
            return index_1.default.assignments.length;
        const res = await (0, pool_1.query)('SELECT COUNT(*) FROM assignments');
        return parseInt(res.rows[0].count);
    },
    async countByUserId(userId) {
        if (!useDb)
            return index_1.default.assignments.filter(a => a.assigned_user_id === userId).length;
        const res = await (0, pool_1.query)('SELECT COUNT(*) FROM assignments WHERE assigned_user_id = $1', [userId]);
        return parseInt(res.rows[0].count);
    }
};
exports.TimelogRepo = {
    async findById(id) {
        if (!useDb)
            return index_1.default.timelogs.find(t => t.id === id) || null;
        const res = await (0, pool_1.query)('SELECT * FROM time_logs WHERE id = $1', [id]);
        return res.rows[0] || null;
    },
    async findActive(userId, assignmentId) {
        if (!useDb)
            return index_1.default.timelogs.find(t => t.user_id === userId && t.assignment_id === assignmentId && !t.end_time) || null;
        const res = await (0, pool_1.query)('SELECT * FROM time_logs WHERE user_id = $1 AND assignment_id = $2 AND end_time IS NULL', [userId, assignmentId]);
        return res.rows[0] || null;
    },
    async create(userId, assignmentId) {
        if (!useDb) {
            const t = { id: Date.now().toString(), user_id: userId, assignment_id: assignmentId, start_time: new Date().toISOString(), end_time: null, is_signed: false, created_at: new Date().toISOString() };
            index_1.default.timelogs.push(t);
            return t;
        }
        const res = await (0, pool_1.query)('INSERT INTO time_logs (user_id, assignment_id, start_time) VALUES ($1, $2, CURRENT_TIMESTAMP) RETURNING *', [userId, assignmentId]);
        return res.rows[0];
    },
    async stop(id) {
        if (!useDb) {
            const t = index_1.default.timelogs.find(x => x.id === id);
            if (t)
                t.end_time = new Date().toISOString();
            return t;
        }
        const res = await (0, pool_1.query)('UPDATE time_logs SET end_time = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *', [id]);
        return res.rows[0];
    },
    async findByUserId(userId) {
        if (!useDb)
            return index_1.default.timelogs.filter(t => t.user_id === userId);
        const res = await (0, pool_1.query)('SELECT * FROM time_logs WHERE user_id = $1 ORDER BY start_time DESC', [userId]);
        return res.rows;
    },
    async updateSignedStatus(id, is_signed) {
        if (!useDb) {
            const t = index_1.default.timelogs.find(x => x.id === id);
            if (t)
                t.is_signed = is_signed;
            return;
        }
        await (0, pool_1.query)('UPDATE time_logs SET is_signed = $1 WHERE id = $2', [is_signed, id]);
    }
};
exports.ReportRepo = {
    async create(assignment_id, timelog_id, created_by_user_id, notes) {
        if (!useDb) {
            const r = { id: Date.now().toString(), assignment_id, timelog_id, created_by_user_id, notes, signature_id: null, pdf_generated: false, email_sent: false, created_at: new Date().toISOString() };
            index_1.default.reports.push(r);
            return r;
        }
        const res = await (0, pool_1.query)('INSERT INTO reports (assignment_id, timelog_id, created_by_user_id, notes) VALUES ($1, $2, $3, $4) RETURNING *', [assignment_id, timelog_id, created_by_user_id, notes]);
        return res.rows[0];
    },
    async findByTimelogId(timelogId) {
        if (!useDb)
            return index_1.default.reports.find(r => r.timelog_id === timelogId) || null;
        const res = await (0, pool_1.query)('SELECT * FROM reports WHERE timelog_id = $1', [timelogId]);
        return res.rows[0] || null;
    },
    async findById(id) {
        if (!useDb)
            return index_1.default.reports.find(r => r.id === id) || null;
        const res = await (0, pool_1.query)('SELECT * FROM reports WHERE id = $1', [id]);
        return res.rows[0] || null;
    },
    async findAll() {
        if (!useDb)
            return index_1.default.reports;
        const res = await (0, pool_1.query)('SELECT * FROM reports ORDER BY created_at DESC');
        return res.rows;
    },
    async findByUserId(userId) {
        if (!useDb)
            return index_1.default.reports.filter(r => r.created_by_user_id === userId);
        const res = await (0, pool_1.query)('SELECT * FROM reports WHERE created_by_user_id = $1 ORDER BY created_at DESC', [userId]);
        return res.rows;
    },
    async updateSignature(id, signature_id) {
        if (!useDb) {
            const r = index_1.default.reports.find(x => x.id === id);
            if (r)
                r.signature_id = signature_id;
            return;
        }
        await (0, pool_1.query)('UPDATE reports SET signature_id = $1 WHERE id = $2', [signature_id, id]);
    }
};
exports.SignatureRepo = {
    async findById(id) {
        if (!useDb)
            return index_1.default.signatures.find(s => s.id === id) || null;
        const res = await (0, pool_1.query)('SELECT * FROM signatures WHERE id = $1', [id]);
        return res.rows[0] || null;
    },
    async create(timelog_id, image_data, signer_name) {
        if (!useDb) {
            const s = { id: Date.now().toString(), report_id: '', timelog_id, image_data, signer_name, signed_at: new Date().toISOString() };
            index_1.default.signatures.push(s);
            return s;
        }
        const res = await (0, pool_1.query)('INSERT INTO signatures (timelog_id, image_data, signer_name) VALUES ($1, $2, $3) RETURNING *', [timelog_id, image_data, signer_name]);
        return res.rows[0];
    }
};
exports.BookingRequestRepo = {
    async countOpen() {
        if (!useDb)
            return index_1.default.bookingRequests.filter(r => r.status === 'open').length;
        const res = await (0, pool_1.query)("SELECT COUNT(*) FROM booking_requests WHERE status = 'open'");
        return parseInt(res.rows[0].count);
    },
    async findAll(status) {
        if (!useDb) {
            let list = [...index_1.default.bookingRequests];
            if (status)
                list = list.filter(r => r.status === status);
            return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }
        let sql = 'SELECT * FROM booking_requests';
        const values = [];
        if (status) {
            sql += ' WHERE status = $1';
            values.push(status);
        }
        sql += ' ORDER BY created_at DESC';
        const res = await (0, pool_1.query)(sql, values);
        return res.rows;
    },
    async create(data) {
        if (!useDb) {
            const entry = {
                id: Date.now().toString() + Math.random().toString(36).slice(2),
                name: data.name,
                phone: data.phone,
                email: data.email || '',
                service_description: data.service_description,
                preferred_date: data.preferred_date,
                preferred_time: data.preferred_time,
                status: 'open',
                assigned_user_id: null,
                notes: '',
                created_at: new Date().toISOString(),
            };
            index_1.default.bookingRequests.push(entry);
            return entry;
        }
        const res = await (0, pool_1.query)('INSERT INTO booking_requests (name, phone, email, service_description, preferred_date, preferred_time) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [data.name, data.phone, data.email, data.service_description, data.preferred_date, data.preferred_time]);
        return res.rows[0];
    },
    async findById(id) {
        if (!useDb)
            return index_1.default.bookingRequests.find(r => r.id === id) || null;
        const res = await (0, pool_1.query)('SELECT * FROM booking_requests WHERE id = $1', [id]);
        return res.rows[0] || null;
    },
    async update(id, data) {
        if (!useDb) {
            const entry = index_1.default.bookingRequests.find(r => r.id === id);
            if (!entry)
                return null;
            if (data.status)
                entry.status = data.status;
            if (data.assigned_user_id !== undefined)
                entry.assigned_user_id = data.assigned_user_id;
            if (data.notes !== undefined)
                entry.notes = data.notes;
            return entry;
        }
        const fields = [];
        const values = [];
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
        if (fields.length === 0)
            return this.findById(id);
        values.push(id);
        const res = await (0, pool_1.query)(`UPDATE booking_requests SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`, values);
        return res.rows[0];
    }
};
exports.AuditRepo = {
    async create(entity_type, entity_id, action, actor_user_id, details) {
        if (!useDb) {
            index_1.default.audit.push({
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
        await (0, pool_1.query)('INSERT INTO audit_logs (entity_type, entity_id, action, actor_user_id, details) VALUES ($1, $2, $3, $4, $5)', [entity_type, entity_id, action, actor_user_id, details]);
    },
    async findAll(params) {
        if (!useDb) {
            let entries = [...index_1.default.audit].reverse();
            if (params?.entity_type)
                entries = entries.filter(e => e.entity_type === params.entity_type);
            if (params?.entity_id)
                entries = entries.filter(e => e.entity_id === params.entity_id);
            if (params?.limit)
                entries = entries.slice(0, params.limit);
            return entries;
        }
        let sql = 'SELECT id, entity_type, entity_id, action, actor_user_id, details, created_at as timestamp FROM audit_logs';
        const conditions = [];
        const values = [];
        if (params?.entity_type) {
            conditions.push(`entity_type = $${values.length + 1}`);
            values.push(params.entity_type);
        }
        if (params?.entity_id) {
            conditions.push(`entity_id = $${values.length + 1}`);
            values.push(params.entity_id);
        }
        if (conditions.length > 0)
            sql += ' WHERE ' + conditions.join(' AND ');
        sql += ' ORDER BY created_at DESC';
        if (params?.limit) {
            sql += ` LIMIT $${values.length + 1}`;
            values.push(params.limit);
        }
        const res = await (0, pool_1.query)(sql, values);
        return res.rows;
    }
};
