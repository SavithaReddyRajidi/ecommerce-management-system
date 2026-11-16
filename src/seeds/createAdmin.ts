import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { connectDB } from "../config/db";
import { User } from "../models";
dotenv.config();
async function seed():Promise<void>{
  try{
    await connectDB();
    const {ADMIN_NAME,ADMIN_EMAIL,ADMIN_PASSWORD}=process.env;
    if(!ADMIN_NAME||!ADMIN_EMAIL||!ADMIN_PASSWORD)throw new Error("Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD in .env");
    const email=ADMIN_EMAIL.toLowerCase().trim();
    if(await User.exists({email})){console.log("Account already exists; no changes made.");return;}
    await User.create({name:ADMIN_NAME,email,password:await bcrypt.hash(ADMIN_PASSWORD,12),role:"admin"});
    console.log("Admin created successfully");
  }catch(e){console.error(e);process.exitCode=1;}finally{await mongoose.disconnect();}
}
seed();
