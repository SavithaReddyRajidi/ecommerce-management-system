
import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../middleware/auth";
import { Product } from "../models";

const getProductId = (req: AuthRequest): string => {
  const id = req.params.productId;
  return Array.isArray(id) ? id[0] : id ?? "";
};

export async function stockInfo(req: AuthRequest, res: Response): Promise<void> {
  const productId = getProductId(req);

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    res.status(400).json({ message: "Invalid product ID" });
    return;
  }

  const p = await Product.findById(productId).select("name stock");

  if (!p) {
    res.status(404).json({ message: "Product not found" });
    return;
  }

  res.json({
    productId: p.id,
    name: p.name,
    availableStock: p.stock
  });
}

export async function setStock(req: AuthRequest, res: Response): Promise<void> {
  const productId = getProductId(req);
  const { quantity } = req.body;

  if (
    !mongoose.Types.ObjectId.isValid(productId) ||
    !Number.isInteger(quantity) ||
    quantity < 0
  ) {
    res.status(400).json({
      message: "Valid product ID and non-negative integer quantity required"
    });
    return;
  }

  const p = await Product.findByIdAndUpdate(
    productId,
    { $set: { stock: quantity } },
    { new: true }
  );

  if (!p) {
    res.status(404).json({ message: "Product not found" });
    return;
  }

  res.json({
    productId: p.id,
    stock: p.stock
  });
}
