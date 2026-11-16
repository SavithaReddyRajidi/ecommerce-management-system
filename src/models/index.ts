
import mongoose, { Schema, Document, Types } from "mongoose";

// User Model
export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: "customer" | "admin";
}

const userSchema = new Schema<IUser>({
  name: { type: String, required: true, trim: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: { type: String, required: true, select: false },
  role: {
    type: String,
    enum: ["customer", "admin"],
    default: "customer"
  }
}, { timestamps: true });

export const User = mongoose.model<IUser>("User", userSchema);


// Category Model
export interface ICategory extends Document {
  name: string;
  description: string;
}

const categorySchema = new Schema<ICategory>({
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, required: true, trim: true }
}, { timestamps: true });

export const Category = mongoose.model<ICategory>("Category", categorySchema);


// Product Model
export interface IProduct extends Document {
  name: string;
  description: string;
  price: number;
  category: Types.ObjectId;
  stock: number;
}

const productSchema = new Schema<IProduct>({
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  category: {
    type: Schema.Types.ObjectId,
    ref: "Category",
    required: true
  },
  stock: { type: Number, required: true, min: 0, default: 0 }
}, { timestamps: true });

productSchema.index({ name: "text", description: "text" });

export const Product = mongoose.model<IProduct>("Product", productSchema);


// Cart Model
export interface ICart extends Document {
  user: Types.ObjectId;
  items: {
    product: Types.ObjectId;
    quantity: number;
  }[];
}

const cartSchema = new Schema<ICart>({
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  items: [{
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    }
  }]
}, { timestamps: true });

export const Cart = mongoose.model<ICart>("Cart", cartSchema);


// Order Model
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipped"
  | "cancelled";

export interface IOrder extends Document {
  user: Types.ObjectId;
  items: {
    product: Types.ObjectId;
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  total: number;
  status: OrderStatus;
  paymentStatus: "unpaid" | "paid" | "failed";
  idempotencyKey?: string;
}

const orderSchema = new Schema<IOrder>({
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  items: [{
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 }
  }],
  total: { type: Number, required: true, min: 0 },
  status: {
    type: String,
    enum: ["pending", "confirmed", "shipped", "cancelled"],
    default: "pending"
  },
  paymentStatus: {
    type: String,
    enum: ["unpaid", "paid", "failed"],
    default: "unpaid"
  },
  idempotencyKey: {
    type: String,
    trim: true
  }
}, { timestamps: true });

// Prevent the same customer from creating duplicate orders
// using the same idempotency key.
orderSchema.index(
  { user: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $type: "string" }
    }
  }
);

export const Order = mongoose.model<IOrder>("Order", orderSchema);


// Payment Model
export interface IPayment extends Document {
  order: Types.ObjectId;
  user: Types.ObjectId;
  amount: number;
  status: "success" | "failure";
  transactionRef: string;
}

const paymentSchema = new Schema<IPayment>({
  order: {
    type: Schema.Types.ObjectId,
    ref: "Order",
    required: true,
    unique: true
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  amount: { type: Number, required: true, min: 0 },
  status: {
    type: String,
    enum: ["success", "failure"],
    required: true
  },
  transactionRef: {
    type: String,
    required: true,
    unique: true
  }
}, { timestamps: true });

export const Payment = mongoose.model<IPayment>("Payment", paymentSchema);
