
import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../middleware/auth";
import { Cart, Product } from "../models";

// Validate and extract product ID
const getProductId = (req: AuthRequest): string => {
  const id = req.params.productId;
  return Array.isArray(id) ? id[0] : id ?? "";
};

// View Cart
export async function viewCart(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const cart = await Cart.findOne({
    user: req.user!.id
  }).populate("items.product");

  const items = (cart?.items || []) as any[];

  const subtotal = items.reduce(
    (sum, item) =>
      sum + (item.product?.price || 0) * item.quantity,
    0
  );

  res.json({
    items,
    subtotal,
    total: subtotal
  });
}

// Add Item to Cart
export async function addItem(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const { productId, quantity } = req.body;

  if (
    typeof productId !== "string" ||
    !mongoose.Types.ObjectId.isValid(productId) ||
    !Number.isInteger(quantity) ||
    quantity < 1
  ) {
    res.status(400).json({
      message: "Valid productId and positive quantity required"
    });
    return;
  }

  const p = await Product.findById(productId);

  if (!p) {
    res.status(404).json({
      message: "Product not found"
    });
    return;
  }

  let c = await Cart.findOne({
    user: req.user!.id
  });

  if (!c) {
    c = await Cart.create({
      user: req.user!.id,
      items: []
    });
  }

  const item: any = c.items.find(
    (x: any) => x.product.toString() === productId
  );

  if ((item?.quantity || 0) + quantity > p.stock) {
    res.status(409).json({
      message: "Insufficient available stock"
    });
    return;
  }

  if (item) {
    item.quantity += quantity;
  } else {
    c.items.push({
      product: new mongoose.Types.ObjectId(productId),
      quantity
    } as any);
  }

  await c.save();
  await c.populate("items.product");

  res.json(c);
}

// Update Cart Item
export async function updateItem(
  req: AuthRequest,
  res: Response
): Promise<void> {
  console.log("UPDATE ITEM CONTROLLER REACHED");
  console.log("Product ID:", req.params.productId);
  console.log("Request body:", req.body);
  console.log("Authenticated user:", req.user);

  try {
    const productId = getProductId(req);
    const { quantity } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({
        message: "Invalid product ID"
      });
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      res.status(400).json({
        message: "Positive integer quantity required"
      });
      return;
    }

    const p = await Product.findById(productId);

    if (!p) {
      res.status(404).json({
        message: "Product not found"
      });
      return;
    }

    if (quantity > p.stock) {
      res.status(409).json({
        message: "Insufficient stock"
      });
      return;
    }

    const c = await Cart.findOne({
      user: req.user!.id
    });

    const item: any = c?.items.find(
      (x: any) => x.product.toString() === productId
    );

    if (!c || !item) {
      res.status(404).json({
        message: "Cart item not found"
      });
      return;
    }

    item.quantity = quantity;

    await c.save();
    await c.populate("items.product");

    res.json(c);
  } catch (error) {
    console.error("Update cart error:", error);

    res.status(500).json({
      message: "Failed to update cart item"
    });
  }
}

// Remove Cart Item
export async function removeItem(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const productId = getProductId(req);

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    res.status(400).json({
      message: "Invalid product ID"
    });
    return;
  }

  const c = await Cart.findOne({
    user: req.user!.id
  });

  if (!c) {
    res.status(404).json({
      message: "Cart not found"
    });
    return;
  }

  const itemExists = c.items.some(
    (x: any) => x.product.toString() === productId
  );

  if (!itemExists) {
    res.status(404).json({
      message: "Cart item not found"
    });
    return;
  }

  c.items = c.items.filter(
    (x: any) => x.product.toString() !== productId
  ) as any;

  await c.save();

  res.json({
    message: "Item removed from cart",
    cart: c
  });
}

// Clear Cart
export async function clearCart(
  req: AuthRequest,
  res: Response
): Promise<void> {
  await Cart.findOneAndUpdate(
    { user: req.user!.id },
    { $set: { items: [] } },
    { upsert: true }
  );

  res.json({
    message: "Cart cleared"
  });
}
