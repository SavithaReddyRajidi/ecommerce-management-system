import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User } from "../models";
import { AuthRequest } from "../middleware/auth";

const emailOK=(s:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
export async function register(req:Request,res:Response):Promise<void>{
  const {name,email,password}=req.body;
  if(typeof name!=="string"||!name.trim()||typeof email!=="string"||!emailOK(email)||typeof password!=="string"||password.length<8){
    res.status(400).json({message:"Valid name, email and password (8+ characters) required"});return;
  }
  try{
    const normalized=email.toLowerCase().trim();
    if(await User.findOne({email:normalized})){res.status(409).json({message:"Email already registered"});return;}
    const user=await User.create({name:name.trim(),email:normalized,password:await bcrypt.hash(password,12),role:"customer"});
    res.status(201).json({message:"Registration successful",user:{id:user.id,name:user.name,email:user.email,role:user.role}});
  }catch{res.status(500).json({message:"Registration failed"});}
}
export async function login(req:Request,res:Response):Promise<void>{
  const {email,password}=req.body;
  if(typeof email!=="string"||typeof password!=="string"){res.status(400).json({message:"Email and password required"});return;}
  const user=await User.findOne({email:email.toLowerCase().trim()}).select("+password");
  if(!user||!(await bcrypt.compare(password,user.password))){res.status(401).json({message:"Invalid email or password"});return;}
  if(!process.env.JWT_SECRET){res.status(500).json({message:"JWT_SECRET missing"});return;}
  const token=jwt.sign({id:user.id,role:user.role},process.env.JWT_SECRET,{expiresIn:"1d"});
  res.json({message:"Login successful",token,user:{id:user.id,name:user.name,email:user.email,role:user.role}});
}
export async function me(req:AuthRequest,res:Response):Promise<void>{
  const user=await User.findById(req.user!.id).select("-password");
  if(!user){res.status(404).json({message:"User not found"});return;} res.json(user);
}
