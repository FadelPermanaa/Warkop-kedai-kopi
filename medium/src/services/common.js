'use strict';

/** An error the person can fix; its message is shown to them as is. */
class UserError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Whole number from user input, or the fallback when empty/invalid. */
function int(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(String(value).replace(/[^\d-]/g, ''));
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function text(value, max = 200) {
  return String(value ?? '').trim().slice(0, max);
}

const rupiah = (n) => 'Rp' + Math.round(n || 0).toLocaleString('id-ID');

module.exports = { UserError, int, text, rupiah };
