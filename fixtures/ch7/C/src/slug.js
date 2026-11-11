'use strict';

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function slugify(title, { maxLength = 80, separator = '-' } = {}) {
  const sep = escapeRegExp(separator);
  let slug = String(title)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // drop accents: é -> e
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`^${sep}|${sep}$`), '');

  if (slug.length > maxLength) {
    const cut = slug.slice(0, maxLength + 1);
    const lastSep = cut.lastIndexOf(separator);
    slug = lastSep > 0 ? cut.slice(0, lastSep) : slug.slice(0, maxLength);
  }
  return slug;
}

module.exports = { slugify };
