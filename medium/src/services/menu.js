'use strict';
const { db } = require('../db');
const { UserError, int, text } = require('./common');

const TAGS = ['', 'Favorit', 'Baru', 'Klasik', 'Pedas'];

/** A product can be sold when it is switched on and (if stock is tracked) has stock left. */
const sellable = (p) => !!p.available && !p.deleted && (!p.track_stock || p.stock > 0);
const shape = (p) => ({ ...p, available: !!p.available, track_stock: !!p.track_stock, sellable: sellable(p), low_stock: !!p.track_stock && p.stock <= p.min_stock });

function categories() {
  return db.prepare('SELECT * FROM categories ORDER BY sort, id').all();
}
function products({ includeDeleted = false } = {}) {
  return db.prepare(`SELECT * FROM products ${includeDeleted ? '' : 'WHERE deleted = 0'} ORDER BY sort, id`).all().map(shape);
}
function product(id) {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  return p ? shape(p) : null;
}
function menu() {
  return { categories: categories(), products: products() };
}

// ---- categories
function saveCategory({ id, name, sort }) {
  const n = text(name, 40);
  if (!n) throw new UserError('Nama kategori wajib diisi.');
  if (id) {
    const r = db.prepare('UPDATE categories SET name = ?, sort = ? WHERE id = ?').run(n, int(sort, 0), id);
    if (!r.changes) throw new UserError('Kategori tidak ditemukan.', 404);
    return Number(id);
  }
  const next = db.prepare('SELECT COALESCE(MAX(sort), 0) + 1 AS s FROM categories').get().s;
  return Number(db.prepare('INSERT INTO categories (name, sort) VALUES (?, ?)').run(n, int(sort, next)).lastInsertRowid);
}
function deleteCategory(id) {
  const used = db.prepare('SELECT COUNT(*) n FROM products WHERE category_id = ? AND deleted = 0').get(id).n;
  if (used) throw new UserError(`Kategori masih dipakai ${used} menu. Pindahkan menunya dulu.`);
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
}

// ---- products
function cleanProduct(input) {
  const name = text(input.name, 60);
  if (!name) throw new UserError('Nama menu wajib diisi.');
  const price = int(input.price);
  if (price === null || price < 0) throw new UserError('Harga belum benar.');
  const categoryId = int(input.category_id);
  if (categoryId && !db.prepare('SELECT 1 FROM categories WHERE id = ?').get(categoryId)) throw new UserError('Kategori tidak ditemukan.');
  const tag = text(input.tag, 20);
  return {
    name, price, category_id: categoryId || null,
    description: text(input.description, 160),
    tag: TAGS.includes(tag) ? tag : '',
    available: input.available === undefined ? 1 : (input.available ? 1 : 0),
    track_stock: input.track_stock ? 1 : 0,
    min_stock: Math.max(0, int(input.min_stock, 0)),
  };
}
function createProduct(input) {
  const p = cleanProduct(input);
  const next = db.prepare('SELECT COALESCE(MAX(sort), 0) + 1 AS s FROM products').get().s;
  const id = db.prepare(`INSERT INTO products (category_id, name, description, price, tag, available, track_stock, min_stock, sort)
    VALUES (@category_id, @name, @description, @price, @tag, @available, @track_stock, @min_stock, @sort)`).run({ ...p, sort: next }).lastInsertRowid;
  return Number(id);
}
function updateProduct(id, input) {
  const old = product(id);
  if (!old || old.deleted) throw new UserError('Menu tidak ditemukan.', 404);
  const p = cleanProduct({ ...old, ...input });
  db.prepare(`UPDATE products SET category_id = @category_id, name = @name, description = @description, price = @price,
    tag = @tag, available = @available, track_stock = @track_stock, min_stock = @min_stock WHERE id = @id`).run({ ...p, id });
  return { before: old, after: product(id) };
}
function deleteProduct(id) {
  // Soft delete: old receipts and reports keep pointing at it.
  const r = db.prepare('UPDATE products SET deleted = 1, available = 0 WHERE id = ? AND deleted = 0').run(id);
  if (!r.changes) throw new UserError('Menu tidak ditemukan.', 404);
}

module.exports = { TAGS, sellable, categories, products, product, menu, saveCategory, deleteCategory, createProduct, updateProduct, deleteProduct };
