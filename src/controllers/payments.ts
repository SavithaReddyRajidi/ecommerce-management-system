
import { Response } from "express";
import mongoose from "mongoose";
import { randomUUID } from "crypto";
import { AuthRequest } from "../middleware/auth";
import { Order, Payment, Product } from "../models";

const getOrderId = (req: AuthRequest): string => {
  const id = req.params.orderId;
  return Array.isArray(id) ? id[0] : id ?? "";
};

export async function simulatePayment(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const orderId = getOrderId(req);
  const { outcome } = req.body;

  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    res.status(400).json({ message: "Invalid order ID" });
    return;
  }

  if (!["success", "failure"].includes(outcome)) {
    res.status(400).json({
      message: "outcome must be success or failure"
    });
    return;
  }

  const session = await mongoose.startSession();

  let payment: any;
  let updatedOrder: any;

  try {
    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session);

      if (!order) {
        throw new Error("Order not found");
      }

      if (
        req.user!.role !== "admin" &&
        order.user.toString() !== req.user!.id
      ) {
        throw new Error("Not your order");
      }

      if (
        order.status === "cancelled" ||
        order.paymentStatus === "paid" ||
        await Payment.exists({ order: order._id }).session(session)
      ) {
        throw new Error("Payment already recorded or order cancelled");
      }

      const payments = await Payment.create(
        [{
          order: order._id,
          user: order.user,
          amount: order.total,
          status: outcome,
          transactionRef: `SIM-${randomUUID()}`
        }],
        { session }
      );

      payment = payments[0];

      if (outcome === "failure") {
        for (const item of order.items) {
          const result = await Product.updateOne(
            { _id: item.product },
            { $inc: { stock: item.quantity } },
            { session }
          );

          if (result.matchedCount !== 1) {
            throw new Error(
              `Could not restore stock for product ${item.name}`
            );
          }
        }

        order.paymentStatus = "failed";
        order.status = "cancelled";
      } else {
        order.paymentStatus = "paid";
        order.status = "confirmed";
      }

      await order.save({ session });
      updatedOrder = order;
    });

    res.status(201).json({
      message: outcome === "failure"
        ? "Payment failed; order cancelled and stock restored"
        : "Payment successful",
      payment,
      order: updatedOrder
    });
  } catch (error: any) {
    if (error.message === "Order not found") {
      res.status(404).json({ message: error.message });
    } else if (error.message === "Not your order") {
      res.status(403).json({ message: error.message });
    } else if (
      error.message === "Payment already recorded or order cancelled" ||
      error.code === 11000
    ) {
      res.status(409).json({
        message: "Payment already recorded or order cancelled"
      });
    } else {
      console.error(error);
      res.status(500).json({
        message: "Payment processing failed"
      });
    }
  } finally {
    await session.endSession();
  }
}

export async function getPayment(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const orderId = getOrderId(req);

  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    res.status(400).json({ message: "Invalid order ID" });
    return;
  }

  const order = await Order.findById(orderId);

  if (!order) {
    res.status(404).json({ message: "Order not found" });
    return;
  }

  if (
    req.user!.role !== "admin" &&
    order.user.toString() !== req.user!.id
  ) {
    res.status(403).json({ message: "Not your order" });
    return;
  }

  const payment = await Payment.findOne({ order: order._id });

  if (!payment) {
    res.status(404).json({ message: "Payment not found" });
    return;
  }

  res.json(payment);
}
