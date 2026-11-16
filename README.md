# E-Commerce Management System

Integrated Express + TypeScript + MongoDB backend for all six project members.

## Setup
1. `npm install`
2. Copy `.env.example` to `.env` and set your MongoDB URI and a long random JWT secret.
3. Run `npm run dev`.
4. In another terminal, create the admin account with `npm run seed:admin`.
5. Never commit `.env` or share tokens/passwords.

## APIs
Auth: POST `/api/auth/register`, POST `/api/auth/login`, GET `/api/auth/me`
Categories: GET `/api/categories`, GET `/api/categories/:id`, POST/PUT/DELETE `/api/categories` (admin)
Products: GET `/api/products` (search, category, minPrice, maxPrice, page, limit), GET `/api/products/:id`, POST/PUT/DELETE `/api/products` (admin)
Cart: GET/DELETE `/api/cart`; POST `/api/cart/items`; PATCH/DELETE `/api/cart/items/:productId`
Inventory: GET `/api/inventory/:productId`; PATCH `/api/inventory/:productId` (admin)
Orders: POST/GET `/api/orders`; GET `/api/orders/:id`; POST `/api/orders/:id/cancel`; PATCH `/api/orders/:id/status` (admin)
Payments: POST `/api/payments/:orderId/simulate` with `{ "outcome":"success" }` or failure; GET `/api/payments/:orderId`.

Payment is simulated only. No real money is processed. This is an educational starter, not production-hardened software. Multi-document order/stock workflows should use MongoDB transactions on a replica set in production; add automated tests, rate limiting, audit logs and stronger idempotency before deployment.
