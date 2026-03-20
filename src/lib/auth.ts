import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
export async function hashPassword(p: string) { return bcrypt.hash(p, 12); }
export async function verifyPassword(p: string, h: string) { return bcrypt.compare(p, h); }
export function requireAuth(req: Request, res: Response, next: NextFunction) { next(); }
export function requireAdmin(req: Request, res: Response, next: NextFunction) { next(); }
export async function requireCompanyAccess(req: Request, res: Response, next: NextFunction) { next(); }
