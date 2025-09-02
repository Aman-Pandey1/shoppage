import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import morgan from 'morgan';
import categoriesRouter from './routes/categories.js';
import productsRouter from './routes/products.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI;
const USE_MOCK_DATA = process.env.USE_MOCK_DATA === 'true';

if (USE_MOCK_DATA) {
	const mockCategories = [
		{ _id: 'c-1', name: 'Starters', imageUrl: 'https://picsum.photos/seed/starters/400/400', sortIndex: 1 },
		{ _id: 'c-2', name: 'Mains', imageUrl: 'https://picsum.photos/seed/mains/400/400', sortIndex: 2 },
		{ _id: 'c-3', name: 'Beverages', imageUrl: 'https://picsum.photos/seed/beverages/400/400', sortIndex: 3 },
	];

	const mockProducts = [
		{
			_id: 'p-1',
			name: 'Spring Rolls',
			description: 'Crispy veggie rolls with sweet chili sauce',
			imageUrl: 'https://picsum.photos/seed/spring-rolls/800/600',
			price: 6.5,
			categoryId: 'c-1',
			spiceLevels: ['Mild', 'Medium', 'Hot'],
			extraOptionGroups: [
				{
					groupKey: 'sauce',
					groupLabel: 'Sauce',
					minSelect: 0,
					maxSelect: 2,
					options: [
						{ key: 'chili', label: 'Chili', priceDelta: 0 },
						{ key: 'peanut', label: 'Peanut', priceDelta: 0.5 },
					],
				},
			],
		},
		{
			_id: 'p-2',
			name: 'Green Curry',
			description: 'Thai green curry with vegetables',
			imageUrl: 'https://picsum.photos/seed/green-curry/800/600',
			price: 12.0,
			categoryId: 'c-2',
			spiceLevels: ['Mild', 'Medium', 'Hot', 'Extra Hot'],
			extraOptionGroups: [
				{
					groupKey: 'protein',
					groupLabel: 'Protein',
					minSelect: 1,
					maxSelect: 1,
					options: [
						{ key: 'tofu', label: 'Tofu', priceDelta: 0 },
						{ key: 'chicken', label: 'Chicken', priceDelta: 2 },
						{ key: 'shrimp', label: 'Shrimp', priceDelta: 3 },
					],
				},
				{
					groupKey: 'extras',
					groupLabel: 'Extras',
					minSelect: 0,
					maxSelect: 2,
					options: [
						{ key: 'rice', label: 'Extra rice', priceDelta: 2 },
						{ key: 'veggies', label: 'Extra veggies', priceDelta: 1.5 },
					],
				},
			],
		},
		{
			_id: 'p-3',
			name: 'Iced Tea',
			description: 'Refreshing house iced tea',
			imageUrl: 'https://picsum.photos/seed/iced-tea/800/600',
			price: 3.0,
			categoryId: 'c-3',
			extraOptionGroups: [
				{
					groupKey: 'sweetness',
					groupLabel: 'Sweetness',
					minSelect: 1,
					maxSelect: 1,
					options: [
						{ key: '0', label: '0%', priceDelta: 0 },
						{ key: '50', label: '50%', priceDelta: 0 },
						{ key: '100', label: '100%', priceDelta: 0 },
					],
				},
			],
		},
	];

	app.locals.mockData = { categories: mockCategories, products: mockProducts };
	console.log('Running with mock data. Set USE_MOCK_DATA=false to use MongoDB.');
} else {
	if (!MONGO_URI) {
		console.warn('No MONGO_URI set. To run without Mongo, set USE_MOCK_DATA=true.');
	}
}

app.get('/health', (_req, res) => res.json({ ok: true, mock: !!app.locals.mockData }));
app.use('/api/categories', categoriesRouter);
app.use('/api/products', productsRouter);

async function start() {
	if (!USE_MOCK_DATA && MONGO_URI) {
		try {
			await mongoose.connect(MONGO_URI);
			console.log('MongoDB connected');
		} catch (err) {
			console.error('MongoDB connection error:', err);
			process.exit(1);
		}
	}
	app.listen(PORT, () => {
		console.log(`Server listening on port ${PORT}`);
	});
}

start();
