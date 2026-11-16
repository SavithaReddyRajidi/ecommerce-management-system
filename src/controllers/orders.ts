
import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../middleware/auth";
import { Cart, Order, Product } from "../models";

const getOrderId = (req: AuthRequest): string => {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id ?? "";
};

// Create Order with Duplicate Request Protection
export async function createOrder(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const idempotencyKey = req.get("Idempotency-Key")?.trim();

  if (!idempotencyKey || idempotencyKey.length > 128) {
    res.status(400).json({
      message: "A valid Idempotency-Key header is required"
    });
    return;
  }

  const userId = req.user!.id;

  // Check whether this request was already processed.
  const existingOrder = await Order.findOne({
    user: userId,
    idempotencyKey
  });

  if (existingOrder) {
    res.status(200).json({
      message: "Order already created for this request",
      order: existingOrder
    });
    return;
  }

  const session = await mongoose.startSession();

  let createdOrder: any = null;
  let duplicateRequest = false;

  try {
    await session.withTransaction(async () => {
      // Check again inside the transaction to handle
      // simultaneous requests using the same key.
      const existing = await Order.findOne({
        user: userId,
        idempotencyKey
      }).session(session);

      if (existing) {
        createdOrder = existing;
        duplicateRequest = true;
        return;
      }

      const cart = await Cart.findOne({
        user: userId
      })
        .session(session)
        .populate("items.product");

      if (!cart || !cart.items.length) {
        throw new Error("Cart is empty");
      }

      const items: any[] = [];

      for (const entry of cart.items as any[]) {
        const p = entry.product;

        if (!p) {
          throw new Error("Cart contains a deleted product");
        }

        const changed = await Product.findOneAndUpdate(
          {
            _id: p._id,
            stock: { $gte: entry.quantity }
          },
          {
            $inc: { stock: -entry.quantity }
          },
          {
            new: true,
            session
          }
        );

        if (!changed) {
          throw new Error(`Insufficient stock for ${p.name}`);
        }

        items.push({
          product: p._id,
          name: p.name,
          quantity: entry.quantity,
          unitPrice: p.price,
          lineTotal: p.price * entry.quantity
        });
      }

      const total = items.reduce(
        (sum, item) => sum + item.lineTotal,
        0
      );

      const orders = await Order.create(
        [{
          user: userId,
          items,
          total,
          status: "pending",
          paymentStatus: "unpaid",
          idempotencyKey
        }],
        { session }
      );

      createdOrder = orders[0];

      // Clear the cart only after order creation succeeds.
      cart.items = [] as any;
      await cart.save({ session });
    });

    res.status(duplicateRequest ? 200 : 201).json({
      message: duplicateRequest
        ? "Order already created for this request"
        : "Order created; stock reserved pending payment",
      order: createdOrder
    });

  } catch (e: any) {
    // A simultaneous request may have inserted the same key first.
    if (e.code === 11000) {
      const duplicate = await Order.findOne({
        user: userId,
        idempotencyKey
      });

      if (duplicate) {
        res.status(200).json({
          message: "Order already created for this request",
          order: duplicate
        });
        return;
      }
    }

    console.error(e);

    if (e.message === "Cart is empty") {
      res.status(400).json({ message: e.message });
    } else if (
      e.message === "Cart contains a deleted product" ||
      e.message.startsWith("Insufficient stock")
    ) {
      res.status(409).json({ message: e.message });
    } else {
      res.status(500).json({
        message: "Order creation failed"
      });
    }

  } finally {
    await session.endSession();
  }
}


// Get All Orders
export async function listOrders(
  req: AuthRequest,
  res: Response
): Promise<void> {
  res.json(
    await Order.find(
      req.user!.role === "admin"
        ? {}
        : { user: req.user!.id }
    )
      .populate("user", "name email")
      .sort({ createdAt: -1 })
  );
}


// Get Individual Order
export async function oneOrder(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const id = getOrderId(req);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: "Invalid order ID" });
    return;
  }

  const o = await Order.findById(id).populate(
    "user",
    "name email"
  );

  if (!o) {
    res.status(404).json({ message: "Order not found" });
    return;
  }

  const owner =
    (o.user as any)._id?.toString() || o.user.toString();

  if (
    req.user!.role !== "admin" &&
    owner !== req.user!.id
  ) {
    res.status(403).json({ message: "Not your order" });
    return;
  }

  res.json(o);
}


// Update Order Status
export async function setOrderStatus(
  req: AuthRequest,
  res: Response
): Promise<void> {
  if (
    !["pending", "confirmed", "shipped"].includes(
      req.body.status
    )
  ) {
    res.status(400).json({ message: "Invalid status" });
    return;
  }

  const id = getOrderId(req);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: "Invalid order ID" });
    return;
  }

  const o = await Order.findById(id);

  if (!o) {
    res.status(404).json({ message: "Order not found" });
    return;
  }

  o.status = req.body.status;
  await o.save();

  res.json(o);
}


// Cancel Order
export async function cancelOrder(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const id = getOrderId(req);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: "Invalid order ID" });
    return;
  }

  const o = await Order.findById(id);

  if (!o) {
    res.status(404).json({ message: "Order not found" });
    return;
  }

  if (
    req.user!.role !== "admin" &&
    o.user.toString() !== req.user!.id
  ) {
    res.status(403).json({ message: "Not your order" });
    return;
  }

  // Only unpaid pending or confirmed orders can be cancelled.
  if (
    !["pending", "confirmed"].includes(o.status) ||
    o.paymentStatus !== "unpaid"
  ) {
    res.status(409).json({
      message: "Order cannot be cancelled"
    });
    return;
  }

  for (const i of o.items) {
    await Product.updateOne(
      { _id: i.product },
      { $inc: { stock: i.quantity } }
    );
  }

  o.status = "cancelled";
  await o.save();

  res.json({
    message: "Order cancelled; stock restored",
    order: o
  });
}
