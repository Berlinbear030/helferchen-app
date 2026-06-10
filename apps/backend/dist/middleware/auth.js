"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.ROLE_HIERARCHY = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token)
        return res.sendStatus(401);
    jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'secret', (err, user) => {
        if (err)
            return res.sendStatus(403);
        req.user = user;
        next();
    });
};
exports.authenticateToken = authenticateToken;
// Role hierarchy: admin > gebietsleiter > kundenbetreuer|buchhaltung > mitarbeiter
exports.ROLE_HIERARCHY = {
    admin: 100,
    gebietsleiter: 70,
    kundenbetreuer: 50,
    buchhaltung: 50,
    mitarbeiter: 10,
    employee: 10,
};
const requireRole = (...roles) => (req, res, next) => {
    if (!req.user)
        return res.status(403).json({ message: 'Forbidden' });
    if (roles.includes(req.user.role))
        return next();
    // admin always has access
    if (req.user.role === 'admin')
        return next();
    return res.status(403).json({ message: 'Forbidden' });
};
exports.requireRole = requireRole;
