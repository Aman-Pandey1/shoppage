import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Site from '../models/Site.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';

dotenv.config();

function getArg(flag, fallback) {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return fallback;
}

function boolArg(flag, defaultValue = false) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return defaultValue;
  const val = process.argv[idx + 1];
  if (val === undefined) return true;
  return /^(1|true|yes)$/i.test(String(val));
}

async function connectMongo() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is not set');
  await mongoose.connect(uri);
}

async function resolveSite({ siteSlug, siteId }) {
  let site = null;
  if (siteId) site = await Site.findById(siteId);
  if (!site && siteSlug) site = await Site.findOne({ slug: siteSlug });
  if (!site) throw new Error('Site not found. Provide --siteSlug or --siteId');
  return site;
}

async function resolveCategory(siteId, { catId, name }) {
  if (catId) {
    const byId = await Category.findOne({ _id: catId, site: siteId });
    if (byId) return byId;
    throw new Error(`Category not found by id: ${catId}`);
  }
  if (!name) throw new Error('Category name or id required');
  let c = await Category.findOne({ site: siteId, name });
  if (!c) c = await Category.findOne({ site: siteId, name: new RegExp(`^${name}$`, 'i') });
  if (!c) {
    const simplified = name.replace(/\s*\(.*?\)\s*/g, '').trim();
    c = await Category.findOne({ site: siteId, name: new RegExp(`^${simplified}`, 'i') });
  }
  if (!c) throw new Error(`Category not found by name: ${name}`);
  return c;
}

async function main() {
  const siteSlug = getArg('--siteSlug');
  const siteId = getArg('--siteId');
  const fromId = getArg('--fromId');
  const toId = getArg('--toId');
  const fromName = getArg('--from', 'Appetizers (Part-2)');
  const toName = getArg('--to', 'Appetizers (Part-1)');
  const dryRun = boolArg('--dryRun', false);
  const keepFrom = boolArg('--keepFrom', false);

  try {
    await connectMongo();
    const site = await resolveSite({ siteSlug, siteId });

    const fromCat = await resolveCategory(site._id, { catId: fromId, name: fromId ? undefined : fromName });
    const toCat = await resolveCategory(site._id, { catId: toId, name: toId ? undefined : toName });

    const countFrom = await Product.countDocuments({ site: site._id, categoryId: fromCat._id });
    const countTo = await Product.countDocuments({ site: site._id, categoryId: toCat._id });

    if (dryRun) {
      console.log(JSON.stringify({
        ok: true,
        dryRun: true,
        site: { id: String(site._id), slug: site.slug },
        from: { id: String(fromCat._id), name: fromCat.name, products: countFrom },
        to: { id: String(toCat._id), name: toCat.name, products: countTo },
      }, null, 2));
      await mongoose.disconnect();
      process.exit(0);
    }

    const moved = await Product.updateMany(
      { site: site._id, categoryId: fromCat._id },
      { $set: { categoryId: toCat._id } }
    );

    let deleted = false;
    if (!keepFrom) {
      const del = await Category.findOneAndDelete({ _id: fromCat._id, site: site._id });
      deleted = !!del;
    }

    const postTo = await Product.countDocuments({ site: site._id, categoryId: toCat._id });

    console.log(JSON.stringify({
      ok: true,
      site: { id: String(site._id), slug: site.slug },
      movedProducts: moved.modifiedCount || 0,
      fromDeleted: deleted,
      toCategoryProducts: postTo,
    }, null, 2));
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Merge categories failed:', err?.message || err);
    try { await mongoose.disconnect(); } catch {}
    process.exit(1);
  }
}

main();
