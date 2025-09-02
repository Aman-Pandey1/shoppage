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

## API
- GET `/api/categories`
- GET `/api/products?categoryId=<id>`

## License
MIT