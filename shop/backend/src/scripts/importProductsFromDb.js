import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { MongoClient } from 'mongodb';
import Site from '../models/Site.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';

dotenv.config();

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return undefined;
}
function boolArg(flag, defaultValue = false) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return defaultValue;
  const val = process.argv[idx + 1];
  if (val === undefined) return true;
  return /^(1|true|yes)$/i.test(String(val));
}

async function connectDest() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is not set');
  await mongoose.connect(uri);
}

async function openSrc() {
  const srcUri = getArg('--srcUri') || process.env.SRC_URI;
  if (!srcUri) throw new Error('SRC_URI is required');
  const client = new MongoClient(srcUri, { maxPoolSize: 5, tlsAllowInvalidCertificates: true, tlsAllowInvalidHostnames: true });
  await client.connect();
  const dbName = (() => {
    try {
      const noProto = srcUri.replace(/^mongodb(\+srv)?:\/\//, '');
      const path = noProto.split('/').slice(1).join('/');
      const beforeQuery = path.split('?')[0] || '';
      return beforeQuery;
    } catch {
      return undefined;
    }
  })();
  if (!dbName) throw new Error('Could not determine source DB name from SRC_URI');
  return { client, db: client.db(dbName) };
}

async function resolveSiteBySlug(db, slug) {
  const sites = db.collection('sites');
  const doc = await sites.findOne({ slug });
  return doc || null;
}

async function main() {
  const destSiteSlug = getArg('--destSiteSlug');
  const destSiteIdArg = getArg('--destSiteId');
  const srcSiteSlug = getArg('--srcSiteSlug');
  const srcSiteIdArg = getArg('--srcSiteId');
  const dryRun = boolArg('--dryRun', false);

  if (!destSiteSlug && !destSiteIdArg) throw new Error('Provide --destSiteSlug or --destSiteId');

  const { client: srcClient, db: srcDb } = await openSrc();
  try {
    await connectDest();

    // Resolve destination site (mongoose)
    let destSite = null;
    if (destSiteIdArg) destSite = await Site.findById(destSiteIdArg);
    if (!destSite && destSiteSlug) destSite = await Site.findOne({ slug: destSiteSlug });
    if (!destSite) throw new Error('Destination site not found');

    // Resolve source site (native driver)
    let srcSite = null;
    if (srcSiteIdArg) srcSite = await srcDb.collection('sites').findOne({ _id: new mongoose.Types.ObjectId(srcSiteIdArg) }).catch(() => null);
    if (!srcSite && srcSiteSlug) srcSite = await resolveSiteBySlug(srcDb, srcSiteSlug);
    if (!srcSite) {
      // Fall back to a site with the same slug as dest (common case)
      srcSite = await resolveSiteBySlug(srcDb, destSite.slug);
    }
    if (!srcSite) throw new Error('Source site not found');

    const srcSiteId = srcSite._id;
    const destSiteId = destSite._id;

    const srcCategories = await srcDb.collection('categories').find({ site: srcSiteId }).toArray();
    const srcProducts = await srcDb.collection('products').find({ site: srcSiteId }).toArray();

    // Build/ensure destination categories by name
    const catNameToDestId = new Map();
    for (const c of srcCategories) {
      const name = String(c.name || '').trim();
      if (!name) continue;
      let destCat = await Category.findOne({ site: destSiteId, name });
      if (!destCat) {
        if (dryRun) {
          catNameToDestId.set(name, new mongoose.Types.ObjectId());
        } else {
          const created = await Category.create({ site: destSiteId, name, imageUrl: c.imageUrl || `https://picsum.photos/seed/${encodeURIComponent(name.toLowerCase())}/400/400`, sortIndex: Number(c.sortIndex) || 0 });
          destCat = created;
        }
      }
      if (destCat) catNameToDestId.set(name, destCat._id);
    }

    let createdCount = 0;
    let updatedCount = 0;

    for (const p of srcProducts) {
      const srcCat = srcCategories.find((c) => String(c._id) === String(p.categoryId));
      const catName = srcCat ? String(srcCat.name || '').trim() : '';
      const destCategoryId = catName ? catNameToDestId.get(catName) : null;
      if (!destCategoryId) continue; // skip products whose category couldn't be mapped

      const payload = {
        site: destSiteId,
        name: String(p.name || '').trim(),
        description: String(p.description || ''),
        imageUrl: String(p.imageUrl || ''),
        price: Number(p.price) || 0,
        categoryId: destCategoryId,
        isVeg: (typeof p.isVeg === 'boolean') ? p.isVeg : true,
        spiceLevels: Array.isArray(p.spiceLevels) ? p.spiceLevels : [],
        variants: Array.isArray(p.variants) ? p.variants.map((v) => ({
          key: String(v.key || v.label || 'default'),
          label: String(v.label || v.key || 'Default'),
          price: Number(v.price != null ? v.price : (v.priceDelta != null ? v.priceDelta : 0)) || 0,
        })) : [],
        extraOptionGroups: Array.isArray(p.extraOptionGroups) ? p.extraOptionGroups : [],
        freeOptionGroups: Array.isArray(p.freeOptionGroups) ? p.freeOptionGroups : [],
      };

      if (!payload.name) continue;

      if (dryRun) {
        // Count-only
        const exists = await Product.exists({ site: destSiteId, name: payload.name, categoryId: destCategoryId });
        if (exists) updatedCount += 1; else createdCount += 1;
        continue;
      }

      const existing = await Product.findOne({ site: destSiteId, name: payload.name, categoryId: destCategoryId });
      if (existing) {
        await Product.updateOne({ _id: existing._id }, { $set: {
          description: payload.description,
          imageUrl: payload.imageUrl,
          price: payload.price,
          isVeg: payload.isVeg,
          spiceLevels: payload.spiceLevels,
          variants: payload.variants,
          extraOptionGroups: payload.extraOptionGroups,
          freeOptionGroups: payload.freeOptionGroups,
        } });
        updatedCount += 1;
      } else {
        await Product.create(payload);
        createdCount += 1;
      }
    }

    console.log(JSON.stringify({ ok: true, site: { id: String(destSiteId), slug: destSite.slug }, created: createdCount, updated: updatedCount }, null, 2));
    await mongoose.disconnect();
  } catch (err) {
    console.error('Import failed:', err?.message || err);
    try { await mongoose.disconnect(); } catch {}
    process.exitCode = 1;
  } finally {
    try { await srcClient.close(); } catch {}
  }
}

main();
