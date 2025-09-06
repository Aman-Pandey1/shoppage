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
MONGO_URI=mongodb://127.0.0.1:27017/shopdb" > .env
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