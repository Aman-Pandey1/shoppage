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

Uber Direct integration (set these in backend/.env when using real API):

```
# Uber Direct API (Client Credentials)
UBER_CLIENT_ID=your_uber_client_id
UBER_CLIENT_SECRET=your_uber_client_secret
```

Then in the Admin Dashboard → Site Settings, set the site's Uber Customer ID and Pickup address. Use "Test Uber" to validate.

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
- POST `/api/delivery/:slug/quote` (Uber Direct)
- POST `/api/delivery/:slug/create` (Uber Direct)

## API
- GET `/api/categories`
- GET `/api/products?categoryId=<id>`

## License
MIT