'use strict';
const crypto = require('crypto');
const { db, now } = require('../db');
const { UserError, text } = require('./common');

const SESSION_DAYS = 14;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 32);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}
function verifyPassword(password, stored) {
  const [kind, saltHex, hashHex] = String(stored || '').split('$');
  if (kind !== 'scrypt' || !saltHex || !hashHex) return false;
  const hash = crypto.scryptSync(String(password), Buffer.from(saltHex, 'hex'), 32);
  return crypto.timingSafeEqual(hash, Buffer.from(hashHex, 'hex'));
}

const publicUser = (u) => u && { id: u.id, username: u.username, name: u.name, role: u.role, active: !!u.active };

function login(username, password) {
  const u = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(text(username, 40).toLowerCase());
  if (!u || !verifyPassword(password, u.password_hash)) return null;
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .run(token, u.id, Date.now() + SESSION_DAYS * 86400000);
  return { token, user: publicUser(u) };
}
function userForToken(token) {
  if (!token) return null;
  const row = db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > ? AND u.active = 1`).get(String(token), Date.now());
  return publicUser(row);
}
function logout(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(String(token || ''));
}

// ---- staff accounts (owner only)
const ROLES = ['pemilik', 'kasir'];
function listUsers() {
  return db.prepare('SELECT * FROM users ORDER BY active DESC, role, name').all().map(publicUser);
}
function cleanUsername(v) {
  const u = text(v, 30).toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(u)) throw new UserError('Nama pengguna 3–30 huruf kecil/angka, tanpa spasi.');
  return u;
}
function checkPassword(p) {
  if (String(p || '').length < 6) throw new UserError('Kata sandi minimal 6 karakter.');
  return String(p);
}
function createUser({ username, name, password, role }) {
  const u = cleanUsername(username);
  if (!text(name)) throw new UserError('Nama wajib diisi.');
  if (!ROLES.includes(role)) throw new UserError('Peran tidak dikenal.');
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(u)) throw new UserError('Nama pengguna sudah dipakai.');
  const id = db.prepare('INSERT INTO users (username, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(u, text(name, 60), hashPassword(checkPassword(password)), role, now()).lastInsertRowid;
  return Number(id);
}
function updateUser(id, { name, role, active, password }, actorId) {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!u) throw new UserError('Akun tidak ditemukan.', 404);
  const nextRole = role === undefined ? u.role : role;
  const nextActive = active === undefined ? u.active : (active ? 1 : 0);
  if (!ROLES.includes(nextRole)) throw new UserError('Peran tidak dikenal.');
  // Never lock the shop out: at least one active owner must remain.
  if (u.role === 'pemilik' && (nextRole !== 'pemilik' || !nextActive)) {
    const others = db.prepare("SELECT COUNT(*) n FROM users WHERE role = 'pemilik' AND active = 1 AND id <> ?").get(id).n;
    if (!others) throw new UserError('Harus ada minimal satu akun pemilik yang aktif.');
  }
  if (Number(id) === Number(actorId) && !nextActive) throw new UserError('Anda tidak bisa menonaktifkan akun sendiri.');
  db.prepare('UPDATE users SET name = ?, role = ?, active = ? WHERE id = ?')
    .run(name === undefined ? u.name : (text(name, 60) || u.name), nextRole, nextActive, id);
  if (password) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(checkPassword(password)), id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
  }
  if (!nextActive) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
}

module.exports = { hashPassword, verifyPassword, login, logout, userForToken, listUsers, createUser, updateUser, ROLES };
