
import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../middleware/auth";
import { Cart, Order, Product } from "../models";

const getOrderId = (req: AuthRequest): string => {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id ?? "";
};

export async function createOrder(req: AuthRequest, res: Response): Promise<void> {
  const cart = await Cart.findOne({ user: req.user!.id }).populate("items.product");

  if (!cart || !cart.items.length) {
    res.status(400).json({ message: "Cart is empty" });
    return;
  }

  const reserved: { id: string; quantity: number }[] = [];
  const items: any[] = [];

  try {
    for (const entry of cart.items as any[]) {
      const p = entry.product;

      if (!p) throw new Error("Cart contains a deleted product");

      const changed = await Product.findOneAndUpdate(
        { _id: p._id, stock: { $gte: entry.quantity } },
        { $inc: { stock: -entry.quantity } },
        { new: true }
      );

      if (!changed) throw new Error(`Insufficient stock for ${p.name}`);

      reserved.push({ id: p.id, quantity: entry.quantity });

      items.push({
        product: p._id,
        name: p.name,
        quantity: entry.quantity,
        unitPrice: p.price,
        lineTotal: p.price * entry.quantity
      });
    }

    const total = items.reduce((s, i) => s + i.lineTotal, 0);

    const order = await Order.create({
      user: req.user!.id,
      items,
      total,
      status: "pending",
      paymentStatus: "unpaid"
    });

    cart.items = [] as any;
    await cart.save();

    res.status(201).json({
      message: "Order created; stock reserved pending payment",
      order
    });
  } catch (e: any) {
    for (const r of reserved) {
      await Product.updateOne(
        { _id: r.id },
        { $inc: { stock: r.quantity } }
      );
    }

    res.status(409).json({
      message: e.message || "Order creation failed"
    });
  }
}

export async function listOrders(req: AuthRequest, res: Response): Promise<void> {
  res.json(
    await Order.find(
      req.user!.role === "admin" ? {} : { user: req.user!.id }
    )
      .populate("user", "name email")
      .sort({ createdAt: -1 })
  );
}

export async function oneOrder(req: AuthRequest, res: Response): Promise<void> {
  const id = getOrderId(req);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: "Invalid order ID" });
    return;
  }

  const o = await Order.findById(id).populate("user", "name email");

  if (!o) {
    res.status(404).json({ message: "Order not found" });
    return;
  }

  const owner = (o.user as any)._id?.toString() || o.user.toString();

  if (req.user!.role !== "admin" && owner !== req.user!.id) {
    res.status(403).json({ message: "Not your order" });
    return;
  }

  res.json(o);
}

export async function setOrderStatus(req: AuthRequest, res: Response): Promise<void> {
  if (!["pending", "confirmed", "shipped"].includes(req.body.status)) {
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

export async function cancelOrder(req: AuthRequest, res: Response): Promise<void> {
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

  if (req.user!.role !== "admin" && o.user.toString() !== req.user!.id) {
    res.status(403).json({ message: "Not your order" });
    return;
  }

  if (!["pending", "confirmed"].includes(o.status) || o.paymentStatus === "paid") {
    res.status(409).json({ message: "Order cannot be cancelled" });
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
