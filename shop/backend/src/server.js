import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import webhookUberRouter from './routes/webhookUber.js';
import webhookStripeRouter from './routes/webhookStripe.js';
import morgan from 'morgan';
import compression from 'compression';
import categoriesRouter from './routes/categories.js';
import productsRouter from './routes/products.js';
import authRouter, { userAuthRouter } from './routes/auth.js';
import adminSitesRouter, { adminBillingRouter } from './routes/adminSites.js';
import adminCategoriesRouter from './routes/adminCategories.js';
import adminProductsRouter from './routes/adminProducts.js';
import adminOrdersRouter from './routes/adminOrders.js';
import adminCouponsRouter from './routes/adminCoupons.js';
import shopPublicRouter from './routes/shopPublic.js';
import shopOrdersRouter from './routes/shopOrders.js';
import deliveryRouter from './routes/delivery.js';
import adminUberRouter from './routes/adminUber.js';
import paymentsStripeRouter from './routes/paymentsStripe.js';
import Site from './models/Site.js';
import Category from './models/Category.js';
import Product from './models/Product.js';
import { loadMockData, saveMockData } from './utils/mockStore.js';

dotenv.config();

const app = express();

// Robust CORS configuration to support preflight and explicit origins
const defaultAllowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'https://shoppage.onrender.com',
];
const envAllowed = (process.env.CORS_ALLOW_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const allowedOrigins = envAllowed.length ? envAllowed : defaultAllowedOrigins;

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 204,
};
// Always vary by Origin so caches don't mix responses
app.use((req, res, next) => {
  res.header('Vary', 'Origin');
  next();
});
app.use(cors(corsOptions));
// Handle CORS preflight for all routes using a RegExp to avoid
// path-to-regexp string parsing issues in Express 5.
app.options(/.*/, cors(corsOptions));
// Enable gzip/br compression for JSON/text; skip for webhooks/raw bodies
app.use(compression({
  filter: (req, res) => {
    if (req.path.startsWith('/webhook/')) return false; // raw body needed
    return compression.filter(req, res);
  },
  threshold: 1024,
}));
// Mount webhook with raw body BEFORE JSON parser
app.use('/webhook/uber', express.raw({ type: '*/*' }), webhookUberRouter);
app.use('/webhook/stripe', express.raw({ type: 'application/json' }), webhookStripeRouter);
// Increase body limits to avoid 413 errors on larger payloads (e.g., images/base64)
app.use(express.json({ limit: String(process.env.JSON_LIMIT || '25mb') }));
app.use(express.urlencoded({ extended: true, limit: String(process.env.JSON_LIMIT || '25mb') }));
app.use(morgan("dev"));

// Static uploads serving (no top-level await; compatible across Node versions)
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
try {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch {}
app.use('/uploads', express.static(UPLOAD_DIR));

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI;
// Prefer mock data when there is no database configured.
// If USE_MOCK_DATA is explicitly set to false, NEVER fall back to mock.
const RAW_USE_MOCK = String(process.env.USE_MOCK_DATA ?? '').trim().toLowerCase();
const MOCK_EXPLICIT_TRUE = ['true', '1', 'yes'].includes(RAW_USE_MOCK);
const MOCK_EXPLICIT_FALSE = ['false', '0', 'no'].includes(RAW_USE_MOCK);
const EXPLICIT_MOCK_CONFIG = (MOCK_EXPLICIT_TRUE || MOCK_EXPLICIT_FALSE);
const USE_MOCK_DATA = (MOCK_EXPLICIT_TRUE ? true : (MOCK_EXPLICIT_FALSE ? false : !MONGO_URI));

if (USE_MOCK_DATA) {
  try { globalThis.__USE_MOCK_DATA = true; } catch {}
  const persisted = typeof loadMockData === "function" ? loadMockData() : null;
  if (persisted) {
    app.locals.mockData = persisted;
    console.log(
      "Running with mock data (persisted). Set USE_MOCK_DATA=false to use MongoDB."
    );
  } else {
    const mockSites = [
      {
        _id: "mock-site",
        name: "Default Site",
        slug: "default",
        tagline: "Sweets, Catering & Takeout",
        isActive: true,
        locations: [
          {
            name: "Kissan Restaurant & Sweets",
            phone: "+1 555-000-0000",
            address: {
              streetAddress: ["720 Tamarack Way Northwest"],
              city: "Edmonton",
              province: "Alberta",
              postalCode: "T6T 0Y3",
              country: "CA",
            }
          }
        ]
      },
    ];

    const mockCategories = [
      {
        _id: "c-1",
        name: "Starters",
        imageUrl: "https://picsum.photos/seed/starters/400/400",
        sortIndex: 1,
      },
      {
        _id: "c-2",
        name: "Mains",
        imageUrl: "https://picsum.photos/seed/mains/400/400",
        sortIndex: 2,
      },
      {
        _id: "c-3",
        name: "Beverages",
        imageUrl: "https://picsum.photos/seed/beverages/400/400",
        sortIndex: 3,
      },
    ];

    const mockProducts = [
      {
        _id: "p-1",
        name: "Spring Rolls",
        description: "Crispy veggie rolls with sweet chili sauce",
        imageUrl: "https://picsum.photos/seed/spring-rolls/800/600",
        price: 6.5,
        categoryId: "c-1",
        spiceLevels: ["Mild", "Medium", "Hot"],
        extraOptionGroups: [
          {
            groupKey: "sauce",
            groupLabel: "Sauce",
            minSelect: 0,
            maxSelect: 2,
            options: [
              { key: "chili", label: "Chili", priceDelta: 0 },
              { key: "peanut", label: "Peanut", priceDelta: 0.5 },
            ],
          },
        ],
      },
      {
        _id: "p-2",
        name: "Green Curry",
        description: "Thai green curry with vegetables",
        imageUrl: "https://picsum.photos/seed/green-curry/800/600",
        price: 12.0,
        categoryId: "c-2",
        spiceLevels: ["Mild", "Medium", "Hot", "Extra Hot"],
        extraOptionGroups: [
          {
            groupKey: "protein",
            groupLabel: "Protein",
            minSelect: 1,
            maxSelect: 1,
            options: [
              { key: "tofu", label: "Tofu", priceDelta: 0 },
              { key: "chicken", label: "Chicken", priceDelta: 2 },
              { key: "shrimp", label: "Shrimp", priceDelta: 3 },
            ],
          },
          {
            groupKey: "extras",
            groupLabel: "Extras",
            minSelect: 0,
            maxSelect: 2,
            options: [
              { key: "rice", label: "Extra rice", priceDelta: 2 },
              { key: "veggies", label: "Extra veggies", priceDelta: 1.5 },
            ],
          },
        ],
      },
      {
        _id: "p-3",
        name: "Iced Tea",
        description: "Refreshing house iced tea",
        imageUrl: "https://picsum.photos/seed/iced-tea/800/600",
        price: 3.0,
        categoryId: "c-3",
        extraOptionGroups: [
          {
            groupKey: "sweetness",
            groupLabel: "Sweetness",
            minSelect: 1,
            maxSelect: 1,
            options: [
              { key: "0", label: "0%", priceDelta: 0 },
              { key: "50", label: "50%", priceDelta: 0 },
              { key: "100", label: "100%", priceDelta: 0 },
            ],
          },
        ],
      },
    ];

    // Attach mock site to categories/products for admin filtering logic
    const categoriesWithSite = mockCategories.map((c) => ({
      ...c,
      site: "mock-site",
    }));
    const productsWithSite = mockProducts.map((p) => ({
      ...p,
      site: "mock-site",
    }));

    app.locals.mockData = {
      sites: mockSites.map((s) => ({ ...s, cities: ['Edmonton', 'Calgary', 'Sherwood Park'] })),
      categories: categoriesWithSite,
      products: productsWithSite,
      users: [],
      orders: [],
      coupons: [
        { _id: 'cp-1', site: 'mock-site', code: 'WELCOME10', percent: 10 },
      ],
    };
    console.log(
      "Running with mock data. Set USE_MOCK_DATA=false to use MongoDB."
    );
    if (typeof saveMockData === "function") saveMockData(app.locals.mockData);
  }
} else {
  if (!MONGO_URI) {
    if (MOCK_EXPLICIT_FALSE) {
      console.error(
        "USE_MOCK_DATA=false but MONGO_URI is not set. Refusing to enable mock data. Exiting."
      );
      process.exit(1);
    }
    console.warn(
      "MONGO_URI not set; enabling mock mode to allow server startup."
    );
    try { globalThis.__USE_MOCK_DATA = true; } catch {}
    const persisted = typeof loadMockData === "function" ? loadMockData() : null;
    if (persisted) {
      app.locals.mockData = persisted;
      console.log(
        "Running with mock data (persisted). Set USE_MOCK_DATA=false to use MongoDB."
      );
    } else {
      app.locals.mockData = {
        sites: [
          {
            _id: "mock-site",
            name: "Default Site",
            slug: "default",
            tagline: "Sweets, Catering & Takeout",
            isActive: true,
          },
        ],
        categories: [],
        products: [],
        users: [],
        orders: [],
        coupons: [
          { _id: 'cp-1', site: 'mock-site', code: 'WELCOME10', percent: 10 },
        ],
      };
      try { if (typeof saveMockData === "function") saveMockData(app.locals.mockData); } catch {}
      console.log(
        "Running with mock data. Set USE_MOCK_DATA=false to use MongoDB."
      );
    }
  }
}

app.use("/health", (_req, res) =>
  res.json({ ok: true, mock: !!app.locals.mockData })
);
app.use("/api/auth", authRouter);
app.use("/api/user", userAuthRouter);
// Legacy non-tenant endpoints (kept for mock and backwards-compat):
app.use("/api/categories", categoriesRouter);
app.use("/api/products", productsRouter);
// Admin multi-tenant endpoints
app.use('/api/admin/sites', adminSitesRouter);
app.use('/api/admin', adminBillingRouter);
app.use('/api/admin/sites/:siteId/categories', adminCategoriesRouter);
app.use('/api/admin/sites/:siteId/products', adminProductsRouter);
app.use('/api/admin/sites/:siteId/orders', adminOrdersRouter);
app.use('/api/admin/sites/:siteId/coupons', adminCouponsRouter);
app.use('/api/admin', adminUberRouter);
// Public shop endpoints by site slug
app.use("/api/shop", shopPublicRouter);
// Orders (user)
app.use("/api/shop", shopOrdersRouter);
// Payments
app.use('/api/payments/stripe', paymentsStripeRouter);
// Delivery endpoints by site slug (Uber Direct)
app.use("/api/delivery", deliveryRouter);

// Serve React frontend build (Vite output) when present
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIST_DIR = path.resolve(__dirname, '../../frontend/dist');
const HAS_FRONTEND_BUILD = fs.existsSync(FRONTEND_DIST_DIR);
if (HAS_FRONTEND_BUILD) {
  // Serve hashed assets with long cache; index.html with short cache
  const ASSETS_DIR = path.join(FRONTEND_DIST_DIR, 'assets');
  if (fs.existsSync(ASSETS_DIR)) {
    app.use('/assets', express.static(ASSETS_DIR, { maxAge: '1y', immutable: true }));
  }
  app.use(express.static(FRONTEND_DIST_DIR, { maxAge: '1h' }));
  // SPA fallback for non-API routes, but do NOT catch asset paths
  app.get(/^(?!\/(?:api|uploads|webhook|assets|favicon\.ico|favicon\.svg|robots\.txt|manifest\.json)\b).*/, (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIST_DIR, 'index.html'));
  });
}

// Health checks and default root handler for environments without a built frontend
// Elastic Beanstalk (and many load balancers) hit "/" by default for health.
// Previously this returned 404 leading to unhealthy status. Keep it after
// API mounts but before server start, and only when there's no SPA build.
if (!HAS_FRONTEND_BUILD) {
  app.get('/', (_req, res) => {
    res
      .status(200)
      .type('html')
      .send(
        [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<meta charset="utf-8" />',
          '<meta name="viewport" content="width=device-width, initial-scale=1" />',
          '<title>Order Online API</title>',
          '<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Helvetica,Arial,sans-serif;padding:2rem;line-height:1.5}code{background:#f2f4f8;padding:.1rem .3rem;border-radius:.25rem}</style>',
          '</head>',
          '<body>',
          '<h1>Service running</h1>',
          '<p>Backend is up and responding.</p>',
          '<ul>',
          '<li>Health: <a href="/health">/health</a></li>',
          '<li>Categories API: <a href="/api/categories">/api/categories</a></li>',
          '<li>Products API: <a href="/api/products">/api/products</a></li>',
          '</ul>',
          '<p>Add a built frontend to <code>shop/frontend/dist</code> to serve the app here.</p>',
          '</body></html>'
        ].join('')
      );
  });
}

async function start() {
  if (!USE_MOCK_DATA && MONGO_URI) {
    try {
      await mongoose.connect(MONGO_URI);
      console.log("MongoDB connected");
      // Ensure default site and backfill existing data without site
      let defaultSite = await Site.findOne({ slug: "default" });
      if (!defaultSite) {
        defaultSite = await Site.create({
          name: "Default Site",
          slug: "default",
          isActive: true,
        });
        console.log("Created default site");
      }
      const backfillCategories = await Category.updateMany(
        { site: { $exists: false } },
        { $set: { site: defaultSite._id } }
      );
      const backfillProducts = await Product.updateMany(
        { site: { $exists: false } },
        { $set: { site: defaultSite._id } }
      );
      if (backfillCategories.modifiedCount || backfillProducts.modifiedCount) {
        console.log(
          `Backfilled site on categories: ${backfillCategories.modifiedCount}, products: ${backfillProducts.modifiedCount}`
        );
      }
    } catch (err) {
      console.error("MongoDB connection error:", err?.message || err);
      if (MOCK_EXPLICIT_FALSE) {
        console.error(
          "USE_MOCK_DATA=false; refusing to fall back to mock data. Exiting."
        );
        process.exit(1);
      }
      console.warn(
        "Falling back to mock data mode due to MongoDB connection failure."
      );
      try { globalThis.__USE_MOCK_DATA = true; } catch {}
      const persisted = typeof loadMockData === "function" ? loadMockData() : null;
      if (persisted) {
        app.locals.mockData = persisted;
        console.log(
          "Running with mock data (persisted). Set USE_MOCK_DATA=false to use MongoDB."
        );
      } else {
        app.locals.mockData = {
          sites: [
            {
              _id: "mock-site",
              name: "Default Site",
              slug: "default",
              tagline: "Sweets, Catering & Takeout",
              isActive: true,
            },
          ],
          categories: [],
          products: [],
          users: [],
          orders: [],
          coupons: [
            { _id: 'cp-1', site: 'mock-site', code: 'WELCOME10', percent: 10 },
          ],
        };
        try { if (typeof saveMockData === "function") saveMockData(app.locals.mockData); } catch {}
        console.log(
          "Running with mock data. Set USE_MOCK_DATA=false to use MongoDB."
        );
      }
    }
  }
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

start();
