'use strict';

// Days are plain strings, 'YYYY-MM-DD', in local time. Keeping them as strings means they sort and
// compare correctly as text and survive the round trip through worklog.json unchanged.

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

function isDay(value) {
  if (typeof value !== 'string') return false;
  const m = DAY.exec(value);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]);
}

function toDate(day) {
  if (!isDay(day)) throw new Error(`not a day: ${day}`);
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function fromDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function today(now = new Date()) {
  return fromDate(now);
}

// shift('2026-11-30', 1) === '2026-12-01'; negative counts go back.
function shift(day, count) {
  const d = toDate(day);
  d.setDate(d.getDate() + count);
  return fromDate(d);
}

// 1 = Monday ... 7 = Sunday (ISO numbering).
function weekday(day) {
  return toDate(day).getDay() || 7;
}

// The Monday of the week the day falls in.
function mondayOf(day) {
  return shift(day, 1 - weekday(day));
}

// Inclusive on both ends: inRange('2026-11-03', '2026-11-01', '2026-11-03') === true.
function inRange(day, first, last) {
  return day >= first && day <= last;
}

module.exports = { isDay, toDate, fromDate, today, shift, weekday, mondayOf, inRange };
