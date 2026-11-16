import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
export interface AuthRequest extends Request { user?: { id: string; role: "customer" | "admin" }; }
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  const secret = process.env.JWT_SECRET;
  if (!header?.startsWith("Bearer ")) { res.status(401).json({message:"Bearer token required"}); return; }
  if (!secret) { res.status(500).json({message:"JWT_SECRET is not configured"}); return; }
  try {
    const decoded = jwt.verify(header.slice(7), secret) as JwtPayload;
    if (typeof decoded.id !== "string" || !["customer","admin"].includes(decoded.role)) {
      res.status(401).json({message:"Invalid token"}); return;
    }
    req.user = {id:decoded.id, role:decoded.role}; next();
  } catch { res.status(401).json({message:"Invalid or expired token"}); }
};
export const adminOnly = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user?.role !== "admin") { res.status(403).json({message:"Admin access required"}); return; }
  next();
};
export const customerOnly = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user?.role !== "customer") { res.status(403).json({message:"Customer access required"}); return; }
  next();
};
