import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import morgan from 'morgan';
import categoriesRouter from './routes/categories.js';
import productsRouter from './routes/products.js';
import authRouter, { userAuthRouter } from './routes/auth.js';
import adminSitesRouter, { adminBillingRouter } from './routes/adminSites.js';
import adminCategoriesRouter from './routes/adminCategories.js';
import adminProductsRouter from './routes/adminProducts.js';
import shopPublicRouter from './routes/shopPublic.js';
import shopOrdersRouter from './routes/shopOrders.js';
import deliveryRouter from './routes/delivery.js';
import adminUberRouter from './routes/adminUber.js';
import Site from './models/Site.js';
import Category from './models/Category.js';
import Product from './models/Product.js';
import { loadMockData, saveMockData } from './utils/mockStore.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI;
const USE_MOCK_DATA = process.env.USE_MOCK_DATA === "true";

if (USE_MOCK_DATA) {
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
    };
    console.log(
      "Running with mock data. Set USE_MOCK_DATA=false to use MongoDB."
    );
    if (typeof saveMockData === "function") saveMockData(app.locals.mockData);
  }
} else {
  if (!MONGO_URI) {
    console.warn(
      "No MONGO_URI set. To run without Mongo, set USE_MOCK_DATA=true."
    );
  }
}

app.get("/health", (_req, res) =>
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
app.use('/api/admin', adminUberRouter);
// Public shop endpoints by site slug
app.use("/api/shop", shopPublicRouter);
// Orders (user)
app.use("/api/shop", shopOrdersRouter);
// Delivery endpoints by site slug (Uber Direct)
app.use("/api/delivery", deliveryRouter);

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
      console.error("MongoDB connection error:", err);
      process.exit(1);
    }
  }
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

start();
