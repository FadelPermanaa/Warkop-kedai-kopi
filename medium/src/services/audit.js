'use strict';
const { db, now } = require('../db');

function audit(userId, action, detail = '') {
  db.prepare('INSERT INTO audit_log (at, user_id, action, detail) VALUES (?, ?, ?, ?)')
    .run(now(), userId ?? null, action, typeof detail === 'string' ? detail : JSON.stringify(detail));
}

function list({ limit = 200 } = {}) {
  return db.prepare(`SELECT a.*, u.name AS user_name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.id DESC LIMIT ?`).all(limit);
}

module.exports = { audit, list };
