
import { Request, Response } from "express";
import mongoose from "mongoose";
import { Category, Product } from "../models";

const oid = (id: string) => mongoose.Types.ObjectId.isValid(id);

const getId = (req: Request): string => {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id ?? "";
};

export async function createCategory(req: Request, res: Response): Promise<void> {
  const { name, description } = req.body;

  if (typeof name !== "string" || !name.trim() ||
      typeof description !== "string" || !description.trim()) {
    res.status(400).json({ message: "Name and description required" });
    return;
  }

  try {
    res.status(201).json(await Category.create({
      name: name.trim(),
      description: description.trim()
    }));
  } catch (e: any) {
    res.status(e.code === 11000 ? 409 : 500).json({
      message: e.code === 11000 ? "Category already exists" : "Could not create category"
    });
  }
}

export async function listCategories(_req: Request, res: Response): Promise<void> {
  res.json(await Category.find().sort({ name: 1 }));
}

export async function getCategory(req: Request, res: Response): Promise<void> {
  const id = getId(req);
  if (!oid(id)) {
    res.status(400).json({ message: "Invalid category ID" });
    return;
  }

  const x = await Category.findById(id);
  if (!x) {
    res.status(404).json({ message: "Category not found" });
    return;
  }
  res.json(x);
}

export async function updateCategory(req: Request, res: Response): Promise<void> {
  const id = getId(req);
  if (!oid(id)) {
    res.status(400).json({ message: "Invalid category ID" });
    return;
  }

  try {
    const x = await Category.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true
    });

    if (!x) {
      res.status(404).json({ message: "Category not found" });
      return;
    }
    res.json(x);
  } catch (e: any) {
    res.status(e.code === 11000 ? 409 : 400).json({
      message: "Invalid category update"
    });
  }
}

export async function deleteCategory(req: Request, res: Response): Promise<void> {
  const id = getId(req);
  if (!oid(id)) {
    res.status(400).json({ message: "Invalid category ID" });
    return;
  }

  if (await Product.exists({ category: id })) {
    res.status(409).json({ message: "Category is still assigned to products" });
    return;
  }

  const x = await Category.findByIdAndDelete(id);
  if (!x) {
    res.status(404).json({ message: "Category not found" });
    return;
  }
  res.json({ message: "Category deleted" });
}

export async function createProduct(req: Request, res: Response): Promise<void> {
  const { name, description, price, category, stock = 0 } = req.body;

  if (
    typeof name !== "string" || !name.trim() ||
    typeof description !== "string" || !description.trim() ||
    typeof price !== "number" || !Number.isFinite(price) || price < 0 ||
    !oid(category) || !Number.isInteger(stock) || stock < 0
  ) {
    res.status(400).json({
      message: "Valid name, description, price, category ID and stock required"
    });
    return;
  }

  if (!await Category.exists({ _id: category })) {
    res.status(400).json({ message: "Category does not exist" });
    return;
  }

  res.status(201).json(await Product.create({
    name: name.trim(),
    description: description.trim(),
    price,
    category,
    stock
  }));
}

export async function listProducts(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
  const filter: any = {};

  if (typeof req.query.search === "string" && req.query.search.trim()) {
    filter.$text = { $search: req.query.search.trim() };
  }

  if (typeof req.query.category === "string") {
    if (!oid(req.query.category)) {
      res.status(400).json({ message: "Invalid category ID" });
      return;
    }
    filter.category = req.query.category;
  }

  const min = req.query.minPrice === undefined ? undefined : Number(req.query.minPrice);
  const max = req.query.maxPrice === undefined ? undefined : Number(req.query.maxPrice);

  if (
    (min !== undefined && (!Number.isFinite(min) || min < 0)) ||
    (max !== undefined && (!Number.isFinite(max) || max < 0)) ||
    (min !== undefined && max !== undefined && min > max)
  ) {
    res.status(400).json({ message: "Invalid price range" });
    return;
  }

  if (min !== undefined || max !== undefined) {
    filter.price = {};
    if (min !== undefined) filter.price.$gte = min;
    if (max !== undefined) filter.price.$lte = max;
  }

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate("category")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Product.countDocuments(filter)
  ]);

  res.json({
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
    products
  });
}

export async function getProduct(req: Request, res: Response): Promise<void> {
  const id = getId(req);
  if (!oid(id)) {
    res.status(400).json({ message: "Invalid product ID" });
    return;
  }

  const p = await Product.findById(id).populate("category");
  if (!p) {
    res.status(404).json({ message: "Product not found" });
    return;
  }
  res.json(p);
}

export async function updateProduct(req: Request, res: Response): Promise<void> {
  const id = getId(req);
  if (!oid(id)) {
    res.status(400).json({ message: "Invalid product ID" });
    return;
  }

  const keys = ["name", "description", "price", "category", "stock"];
  const data: any = {};

  for (const k of keys) {
    if (req.body[k] !== undefined) data[k] = req.body[k];
  }

  if (!Object.keys(data).length) {
    res.status(400).json({ message: "No update fields provided" });
    return;
  }

  if (
    data.category !== undefined &&
    (!oid(data.category) || !await Category.exists({ _id: data.category }))
  ) {
    res.status(400).json({ message: "Invalid category" });
    return;
  }

  if (data.price !== undefined &&
      (typeof data.price !== "number" || data.price < 0)) {
    res.status(400).json({ message: "Invalid price" });
    return;
  }

  if (data.stock !== undefined &&
      (!Number.isInteger(data.stock) || data.stock < 0)) {
    res.status(400).json({ message: "Invalid stock" });
    return;
  }

  const p = await Product.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true
  }).populate("category");

  if (!p) {
    res.status(404).json({ message: "Product not found" });
    return;
  }
  res.json(p);
}

export async function deleteProduct(req: Request, res: Response): Promise<void> {
  const id = getId(req);
  if (!oid(id)) {
    res.status(400).json({ message: "Invalid product ID" });
    return;
  }

  const p = await Product.findByIdAndDelete(id);
  if (!p) {
    res.status(404).json({ message: "Product not found" });
    return;
  }
  res.json({ message: "Product deleted" });
}
