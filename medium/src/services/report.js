'use strict';
// Sales reports over a date range (by the day the bill was paid).
const { db, today } = require('../db');

const DAY = /^\d{4}-\d{2}-\d{2}$/;
function range(from, to) {
  let a = DAY.test(from || '') ? from : today();
  let b = DAY.test(to || '') ? to : a;
  if (a > b) [a, b] = [b, a];
  return [a, b];
}
const PAID = "o.status = 'paid' AND substr(o.paid_at, 1, 10) BETWEEN ? AND ?";

function summary(fromIn, toIn) {
  const [from, to] = range(fromIn, toIn);
  const r = [from, to];
  const tot = db.prepare(`SELECT COUNT(*) n, COALESCE(SUM(total), 0) total, COALESCE(SUM(discount), 0) discount FROM orders o WHERE ${PAID}`).get(...r);
  const voided = db.prepare("SELECT COUNT(*) n, COALESCE(SUM(total), 0) total FROM orders o WHERE o.status = 'void' AND substr(o.voided_at, 1, 10) BETWEEN ? AND ?").get(...r);
  const methods = db.prepare(`SELECT p.method, SUM(p.amount) amount, COUNT(DISTINCT p.order_id) n FROM payments p JOIN orders o ON o.id = p.order_id WHERE ${PAID} GROUP BY p.method`).all(...r);
  const days = db.prepare(`SELECT substr(o.paid_at, 1, 10) day, COUNT(*) n, SUM(o.total) total FROM orders o WHERE ${PAID} GROUP BY day ORDER BY day`).all(...r);
  const hours = db.prepare(`SELECT CAST(substr(o.paid_at, 12, 2) AS INTEGER) hour, COUNT(*) n, SUM(o.total) total FROM orders o WHERE ${PAID} GROUP BY hour ORDER BY hour`).all(...r);
  const items = db.prepare(`SELECT i.product_id, i.name, c.name AS category, SUM(i.qty) qty, SUM(i.qty * i.price) total
    FROM order_items i JOIN orders o ON o.id = i.order_id LEFT JOIN products p ON p.id = i.product_id LEFT JOIN categories c ON c.id = p.category_id
    WHERE ${PAID} GROUP BY i.product_id, i.name ORDER BY qty DESC, total DESC`).all(...r);
  const categories = db.prepare(`SELECT COALESCE(c.name, 'Lainnya') name, SUM(i.qty) qty, SUM(i.qty * i.price) total
    FROM order_items i JOIN orders o ON o.id = i.order_id LEFT JOIN products p ON p.id = i.product_id LEFT JOIN categories c ON c.id = p.category_id
    WHERE ${PAID} GROUP BY c.id ORDER BY total DESC`).all(...r);
  const cashiers = db.prepare(`SELECT COALESCE(u.name, '-') name, COUNT(*) n, SUM(o.total) total FROM orders o LEFT JOIN users u ON u.id = o.paid_by
    WHERE ${PAID} GROUP BY o.paid_by ORDER BY total DESC`).all(...r);
  const sources = db.prepare(`SELECT o.source, o.type, COUNT(*) n, SUM(o.total) total FROM orders o WHERE ${PAID} GROUP BY o.source, o.type`).all(...r);
  return {
    from, to,
    total: tot.total, count: tot.n, average: tot.n ? Math.round(tot.total / tot.n) : 0, discount: tot.discount,
    void_count: voided.n, void_total: voided.total,
    methods, days, hours, items, categories, cashiers, sources,
  };
}

/** Rows for the CSV export. */
function transactions(fromIn, toIn) {
  const [from, to] = range(fromIn, toIn);
  return db.prepare(`SELECT o.code, o.paid_at, o.voided_at, o.status, o.type, t.name AS table_name, o.customer_name, o.subtotal, o.discount, o.total,
      (SELECT GROUP_CONCAT(p.method || ':' || p.amount, ' + ') FROM payments p WHERE p.order_id = o.id) AS payments,
      (SELECT GROUP_CONCAT(i.qty || 'x ' || i.name, ', ') FROM order_items i WHERE i.order_id = o.id) AS items,
      u.name AS cashier, o.void_reason
    FROM orders o LEFT JOIN tables t ON t.id = o.table_id LEFT JOIN users u ON u.id = o.paid_by
    WHERE (o.status = 'paid' AND substr(o.paid_at, 1, 10) BETWEEN ? AND ?) OR (o.status = 'void' AND substr(o.voided_at, 1, 10) BETWEEN ? AND ?)
    ORDER BY COALESCE(o.paid_at, o.voided_at)`).all(from, to, from, to);
}

/** Excel in Indonesia expects ";" between columns; the BOM keeps accents readable. */
function csv(rows, columns) {
  const cell = (v) => {
    if (typeof v === 'number') return String(v);
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? "'" : '') + s.replace(/"/g, '""')}"` : s;
  };
  return '\uFEFF' + [columns.map((c) => cell(c[1])).join(';'), ...rows.map((r) => columns.map((c) => cell(r[c[0]])).join(';'))].join('\r\n') + '\r\n';
}

module.exports = { range, summary, transactions, csv };
