"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const queries_1 = require("../db/queries");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await queries_1.UserRepo.findByUsername(username);
    if (!user)
        return res.status(401).json({ message: 'Invalid credentials' });
    const valid = await bcryptjs_1.default.compare(password, user.password_hash);
    if (!valid)
        return res.status(401).json({ message: 'Invalid credentials' });
    const permissions = (() => { try {
        return JSON.parse(user.permissions || '[]');
    }
    catch {
        return [];
    } })();
    const payload = { id: user.id, username: user.username, role: user.role, permissions };
    const token = jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '8h' });
    // addAudit('user', user.id, 'login', user.id, 'User logged in');
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, full_name: user.full_name, permissions } });
});
router.get('/me', auth_1.authenticateToken, async (req, res) => {
    const user = await queries_1.UserRepo.findById(req.user?.id || '');
    if (!user)
        return res.status(404).json({ message: 'User not found' });
    const permissions = (() => { try {
        return JSON.parse(user.permissions || '[]');
    }
    catch {
        return [];
    } })();
    res.json({ id: user.id, username: user.username, role: user.role, full_name: user.full_name, email: user.email, permissions });
});
exports.default = router;
