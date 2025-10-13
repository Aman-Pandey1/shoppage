import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import Site from '../models/Site.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import Coupon from '../models/Coupon.js';
import Order from '../models/Order.js';

dotenv.config();

function readMockData() {
  const file = process.env.MOCK_DB_FILE
    ? path.resolve(process.env.MOCK_DB_FILE)
    : path.resolve(process.cwd(), 'data', 'mockData.json');
  if (!fs.existsSync(file)) {
    throw new Error(`mockData.json not found at ${file}`);
  }
  const text = fs.readFileSync(file, 'utf-8');
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object') throw new Error('Invalid mock data');
  return data;
}

async function connectMongo() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is not set');
  await mongoose.connect(uri);
}

function isNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

async function seed() {
  const data = readMockData();

  const siteIdMap = new Map();
  const categoryIdMap = new Map();
  const userEmailToId = new Map();

  const sites = Array.isArray(data.sites) ? data.sites : [];
  const categories = Array.isArray(data.categories) ? data.categories : [];
  const products = Array.isArray(data.products) ? data.products : [];
  const coupons = Array.isArray(data.coupons) ? data.coupons : [];
  const orders = Array.isArray(data.orders) ? data.orders : [];
  const users = Array.isArray(data.users) ? data.users : [];

  // 1) Upsert Sites and build ID map
  let upsertedSites = 0;
  for (const s of sites) {
    const payload = {
      name: s.name,
      slug: s.slug,
      domains: Array.isArray(s.domains) ? s.domains : [],
      isActive: s.isActive !== false,
      brandColor: s.brandColor || '#0ea5e9',
      logoUrl: s.logoUrl || undefined,
      uberCustomerId: s.uberCustomerId || undefined,
      deliveryFeeCents: Number(s.deliveryFeeCents) || 0,
      splitDeliveryFee: !!s.splitDeliveryFee,
      locations: Array.isArray(s.locations) ? s.locations : [],
      cities: Array.isArray(s.cities) ? s.cities : [],
      hours: s.hours || undefined,
      pickup: s.pickup || undefined,
    };
    const doc = await Site.findOneAndUpdate(
      { slug: s.slug },
      { $set: payload },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    siteIdMap.set(String(s._id), doc._id);
    upsertedSites += 1;
  }

  // 2) Upsert Users and build email map
  let upsertedUsers = 0;
  for (const u of users) {
    if (!u.email || !u.passwordHash) continue;
    const update = {
      name: u.name || undefined,
      passwordHash: u.passwordHash,
    };
    const doc = await User.findOneAndUpdate(
      { email: String(u.email).toLowerCase() },
      { $set: update },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    userEmailToId.set(String(doc.email).toLowerCase(), doc._id);
    upsertedUsers += 1;
  }

  // 3) For each site, replace Categories and Products
  let replacedCategories = 0;
  let replacedProducts = 0;
  for (const s of sites) {
    const newSiteId = siteIdMap.get(String(s._id));
    if (!newSiteId) continue;

    const siteCategories = categories.filter((c) => String(c.site) === String(s._id));
    const siteProducts = products.filter((p) => String(p.site) === String(s._id));

    await Category.deleteMany({ site: newSiteId });
    await Product.deleteMany({ site: newSiteId });

    for (const c of siteCategories) {
      const fallbackImg = `https://picsum.photos/seed/${encodeURIComponent(c.name || 'category')}/400/400`;
      const created = await Category.create({
        site: newSiteId,
        name: c.name,
        imageUrl: (typeof c.imageUrl === 'string' && c.imageUrl.trim().length) ? c.imageUrl : fallbackImg,
        sortIndex: Number(c.sortIndex) || 0,
      });
      categoryIdMap.set(String(c._id), created._id);
      replacedCategories += 1;
    }

    for (const p of siteProducts) {
      const mappedCategoryId = categoryIdMap.get(String(p.categoryId));
      if (!mappedCategoryId) continue;
      await Product.create({
        site: newSiteId,
        name: p.name,
        description: p.description || '',
        imageUrl: p.imageUrl || '',
        price: Number(p.price) || 0,
        categoryId: mappedCategoryId,
        isVeg: typeof p.isVeg === 'boolean' ? p.isVeg : true,
        spiceLevels: Array.isArray(p.spiceLevels) ? p.spiceLevels : [],
        variants: Array.isArray(p.variants) ? p.variants.map((v) => ({
          key: String(v.key || v.label || 'default'),
          label: String(v.label || v.key || 'Default'),
          // Support absolute price (preferred) or fallback to delta
          ...(typeof v.price === 'number' ? { price: Number(v.price) } : { priceDelta: Number(v.priceDelta) || 0 }),
        })) : [],
        extraOptionGroups: Array.isArray(p.extraOptionGroups) ? p.extraOptionGroups.map((g) => ({
          groupKey: String(g.groupKey || g.groupLabel || 'options'),
          groupLabel: String(g.groupLabel || g.groupKey || 'Options'),
          minSelect: Number(g.minSelect) || 0,
          maxSelect: Number(g.maxSelect) || 0,
          options: isNonEmptyArray(g.options) ? g.options.map((o) => ({
            key: String(o.key || o.label || 'option'),
            label: String(o.label || o.key || 'Option'),
            priceDelta: Number(o.priceDelta) || 0,
          })) : [],
        })) : [],
      });
      replacedProducts += 1;
    }
  }

  // 4) Upsert Coupons
  let upsertedCoupons = 0;
  for (const c of coupons) {
    const newSiteId = siteIdMap.get(String(c.site));
    if (!newSiteId || !c.code) continue;
    await Coupon.findOneAndUpdate(
      { site: newSiteId, code: String(c.code).toUpperCase() },
      { $set: { percent: Number(c.percent) || 0 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    upsertedCoupons += 1;
  }

  // 5) Insert Orders (non-destructive: do not delete existing)
  let insertedOrders = 0;
  for (const o of orders) {
    const newSiteId = siteIdMap.get(String(o.site));
    if (!newSiteId) continue;

    const maybeUserId = o.userEmail ? userEmailToId.get(String(o.userEmail).toLowerCase()) : undefined;

    const items = Array.isArray(o.items) ? o.items.map((it) => ({
      productId: undefined,
      name: it.name,
      quantity: Number(it.quantity) || 1,
      priceCents: Number(it.priceCents) || 0,
      size: it.size || undefined,
      spiceLevel: it.spiceLevel || undefined,
    })) : [];

    try {
      await Order.create({
        site: newSiteId,
        userId: maybeUserId,
        userEmail: o.userEmail || undefined,
        fulfillmentType: o.fulfillmentType || 'created',
        items,
        totalCents: Number(o.totalCents) || 0,
        taxCents: Number(o.taxCents) || 0,
        tipCents: Number(o.tipCents) || 0,
        deliveryFeeCents: Number(o.deliveryFeeCents) || 0,
        deliveryFeeRestaurantCents: Number(o.deliveryFeeRestaurantCents) || 0,
        notes: o.notes || undefined,
        externalId: o.externalId || undefined,
        uberDeliveryId: o.uberDeliveryId || undefined,
        uberTrackingUrl: o.uberTrackingUrl || undefined,
        uberStatus: o.uberStatus || undefined,
        status: o.status || 'created',
        pickup: o.pickup || undefined,
        dropoff: o.dropoff || undefined,
        meta: o.meta || undefined,
        createdAt: o.createdAt ? new Date(o.createdAt) : undefined,
        updatedAt: o.updatedAt ? new Date(o.updatedAt) : undefined,
      });
      insertedOrders += 1;
    } catch {
      // Skip invalid orders silently
    }
  }

  return {
    sites: upsertedSites,
    users: upsertedUsers,
    categories: replacedCategories,
    products: replacedProducts,
    coupons: upsertedCoupons,
    orders: insertedOrders,
  };
}

async function main() {
  try {
    await connectMongo();
    const result = await seed();
    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err?.message || err);
    try { await mongoose.disconnect(); } catch {}
    process.exit(1);
  }
}

main();

