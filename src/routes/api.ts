
import { Router, Response, NextFunction } from "express";
import {
  authenticate,
  adminOnly,
  customerOnly,
  AuthRequest
} from "../middleware/auth";

import * as a from "../controllers/auth";
import * as c from "../controllers/catalog";
import * as cart from "../controllers/cart";
import * as inv from "../controllers/inventory";
import * as ord from "../controllers/orders";
import * as pay from "../controllers/payments";

const r = Router();

// Authentication
r.post("/auth/register", a.register);
r.post("/auth/login", a.login);
r.get("/auth/me", authenticate, a.me);

// Categories
r.get("/categories", c.listCategories);
r.get("/categories/:id", c.getCategory);
r.post("/categories", authenticate, adminOnly, c.createCategory);
r.put("/categories/:id", authenticate, adminOnly, c.updateCategory);
r.delete("/categories/:id", authenticate, adminOnly, c.deleteCategory);

// Products
r.get("/products", c.listProducts);
r.get("/products/:id", c.getProduct);
r.post("/products", authenticate, adminOnly, c.createProduct);
r.put("/products/:id", authenticate, adminOnly, c.updateProduct);
r.delete("/products/:id", authenticate, adminOnly, c.deleteProduct);

// Cart
r.get("/cart", authenticate, customerOnly, cart.viewCart);

r.post("/cart/items", authenticate, customerOnly, cart.addItem);

r.patch(
  "/cart/items/:productId",
  authenticate,
  (req: AuthRequest, _res: Response, next: NextFunction) => {
    console.log("Authenticated user:", req.user);
    next();
  },
  customerOnly,
  cart.updateItem
);

r.delete(
  "/cart/items/:productId",
  authenticate,
  customerOnly,
  cart.removeItem
);

r.delete("/cart", authenticate, customerOnly, cart.clearCart);

// Inventory
r.get("/inventory/:productId", inv.stockInfo);
r.patch("/inventory/:productId", authenticate, adminOnly, inv.setStock);

// Orders
r.post("/orders", authenticate, customerOnly, ord.createOrder);
r.get("/orders", authenticate, ord.listOrders);
r.get("/orders/:id", authenticate, ord.oneOrder);
r.patch("/orders/:id/status", authenticate, adminOnly, ord.setOrderStatus);
r.post("/orders/:id/cancel", authenticate, ord.cancelOrder);

// Payments
r.post("/payments/:orderId/simulate", authenticate, pay.simulatePayment);
r.get("/payments/:orderId", authenticate, pay.getPayment);

export default r;
