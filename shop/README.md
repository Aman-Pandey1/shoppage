# Shop App (React + Vite + Express + MongoDB)

A simple shop with modal-driven add-to-cart flow and persistent cart sidebar.

## Stack
- Frontend: React + Vite (TypeScript)
- Backend: Node.js + Express
- Database: MongoDB via Mongoose (optional). Mock data available.

## Quick Start

### Backend
```
cd backend
# Use mock data (no Mongo needed)
echo "PORT=4000
USE_MOCK_DATA=true
MONGO_URI=mongodb://127.0.0.1:27017/shopdb
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
# Optional: default currency (usd, cad, etc.)
STRIPE_CURRENCY=usd" > .env
npm install
npm run dev
```

#### Restore data from an old MongoDB (site-wise)

Use these scripts to pull categories/products (including descriptions and variants) from an old database and merge categories like “Appetizers (Part-2)” into “Appetizers (Part-1)”. Ensure `USE_MOCK_DATA=false` and `MONGO_URI` is set in `backend/.env`.

```
# In a separate terminal
cd backend

# 1) Import products from old DB into a destination site
#    - Map categories by name, creating any missing categories on the destination site
#    - Upserts products by (name, category)

node src/scripts/importProductsFromDb.js \
  --srcUri "mongodb+srv://user:pass@host/olddb" \
  --destSiteSlug NewAsianVillage \
  --srcSiteSlug NewAsianVillage

# Optional dry-run to see counts only:
node src/scripts/importProductsFromDb.js --srcUri "mongodb://127.0.0.1:27017/olddb" --destSiteSlug default --srcSiteSlug default --dryRun true

# 2) Merge categories by name within a site (e.g., Appetizers Part-2 → Part-1)
node src/scripts/mergeCategories.js --siteSlug NewAsianVillage --from "Appetizers (Part-2)" --to "Appetizers (Part-1)"

# Options: use --siteId, --fromId, --toId; add --dryRun true to preview; add --keepFrom true to retain source category after moving products.
```

#### Per-site settings stored in database

- Each website (site) has its own saved settings in the DB: logo URL, logo link, brand color, Uber/Stripe/DoorDash credentials, currency, minimum order, coupon minimum subtotal, delivery-fee split, max delivery distance, pickup locations, and more.
- Update these in Admin → Site Settings. Changes persist site-wise in MongoDB and are used by all APIs (payments, delivery, public shop).

Delivery provider integration (set these in backend/.env when using real API):

```
# Uber Direct API (Client Credentials)
UBER_CLIENT_ID=your_uber_client_id
UBER_CLIENT_SECRET=your_uber_client_secret
```

Then in the Admin Dashboard → Site Settings, choose a delivery provider per website (Uber Direct or DoorDash Drive). For Uber, set the site's Uber Customer ID and Pickup address. For DoorDash, set the DoorDash Store ID. Only one provider is active per website at a time.

### Frontend
```
cd frontend
echo "VITE_API_URL=http://localhost:4000" > .env
npm install
npm run dev
```
## Stripe Connect (money flow per-restaurant)

- Each site can have its own Stripe connected account. In Admin → Settings, set `Stripe Account ID (acct_...)` for that site.
- Pickup checkout: if `stripeAccountId` is set, payments are created on behalf of that account and funds are routed directly to the restaurant.
- Delivery checkout: if `stripeAccountId` is set, the payment is created on behalf of the restaurant and we collect our delivery fee via `application_fee_amount`. If `splitDeliveryFee` is enabled for the site, the customer pays half and the remainder is charged as an application fee; otherwise, the full delivery fee is charged to the customer and we still collect it via the application fee.

### Required env vars (backend/.env)
- `STRIPE_SECRET_KEY`: Your platform secret key.
- `STRIPE_WEBHOOK_SECRET`: Webhook signing secret from the Stripe Dashboard.
- `STRIPE_CURRENCY`: Optional, like `usd`.
- `FRONTEND_URL`: Public URL of the frontend (used for redirect URLs), optional in dev.
- `MIN_ORDER_CENTS`: Optional minimum order (e.g., 5000 for $50).
- `USE_MOCK_DATA`: `true` to run without MongoDB.
- `MONGO_URI`: Provide when `USE_MOCK_DATA=false`.

### Webhook
- Expose `POST /webhook/stripe` publicly and configure the endpoint in Stripe with the same signing secret.
- On `checkout.session.completed`, the order is marked paid and, for delivery orders, Uber Direct is created if configured.

Open the printed local URL.

## Switch to real MongoDB
- Set `USE_MOCK_DATA=false` in `backend/.env` and provide `MONGO_URI`.

## Custom Domains and Dynamic Endpoints

- Add one or more domains to a site in Admin → Links → Edit site.
- When a domain points to your frontend, any path under that domain will render the shop for the mapped site. Examples:
  - `https://myshop.example.com/` → resolves by host to the site's slug
  - `https://myshop.example.com/anything/here` → still renders the same shop
- The frontend auto-resolves the site by calling `GET /api/shop/host-site` and then loads categories/products from `/api/shop/:slug/*`.

### Relevant API
- GET `/api/shop/host-site` → Resolves current request host to `{ siteId, slug, name }`.
- GET `/api/shop/:slug/categories`
- GET `/api/shop/:slug/products?categoryId=<id>`
- POST `/api/delivery/:slug/quote` (uses selected provider)
- POST `/api/delivery/:slug/create` (uses selected provider)

## API
- GET `/api/categories`
- GET `/api/products?categoryId=<id>`

## License
MIT