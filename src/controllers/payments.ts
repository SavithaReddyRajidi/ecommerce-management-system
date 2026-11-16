import { Response } from "express";
import { randomUUID } from "crypto";
import { AuthRequest } from "../middleware/auth";
import { Order, Payment } from "../models";
export async function simulatePayment(req:AuthRequest,res:Response):Promise<void>{
  const {outcome}=req.body;if(!["success","failure"].includes(outcome)){res.status(400).json({message:"outcome must be success or failure"});return;}
  const o=await Order.findById(req.params.orderId);if(!o){res.status(404).json({message:"Order not found"});return;}
  if(req.user!.role!=="admin"&&o.user.toString()!==req.user!.id){res.status(403).json({message:"Not your order"});return;}
  if(o.status==="cancelled"||o.paymentStatus==="paid"||await Payment.exists({order:o._id})){res.status(409).json({message:"Payment already recorded or order cancelled"});return;}
  const payment=await Payment.create({order:o._id,user:o.user,amount:o.total,status:outcome,transactionRef:`SIM-${randomUUID()}`});
  o.paymentStatus=outcome==="success"?"paid":"failed";if(outcome==="success")o.status="confirmed";await o.save();
  res.status(201).json({message:`Simulated payment ${outcome}`,payment,order:o});
}
export async function getPayment(req:AuthRequest,res:Response):Promise<void>{
  const o=await Order.findById(req.params.orderId);if(!o){res.status(404).json({message:"Order not found"});return;}
  if(req.user!.role!=="admin"&&o.user.toString()!==req.user!.id){res.status(403).json({message:"Not your order"});return;}
  const p=await Payment.findOne({order:o._id});if(!p){res.status(404).json({message:"Payment not found"});return;}res.json(p);
}
