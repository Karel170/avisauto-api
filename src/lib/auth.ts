import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, usersTable, companiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET || "avisauto-dev-secret";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }
  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
    (req as any).userId = decoded.userId;
    (req as any).role = decoded.role;
    next();
  } catch {
    res.status(401).json({ error: "Token invalide" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(403).json({ error: "Accès refusé" });
    return;
  }
  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
    if (decoded.role !== "admin") {
      res.status(403).json({ error: "Accès administrateur requis" });
      return;
    }
    (req as any).userId = decoded.userId;
    (req as any).role = decoded.role;
    next();
  } catch {
    res.status(403).json({ error: "Token invalide" });
  }
}

export async function requireCompanyAccess(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }
  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
    (req as any).userId = decoded.userId;
    (req as any).role = decoded.role;

    const companyId = req.params.companyId;
    if (!companyId) {
      res.status(400).json({ error: "ID entreprise invalide" });
      return;
    }
    if (decoded.role === "admin") {
      next();
      return;
    }
    const company = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId as any)).limit(1);
    if (!company.length || company[0].ownerId !== decoded.userId) {
      res.status(403).json({ error: "Accès refusé à cette entreprise" });
      return;
    }
    next();
  } catch {
    res.status(401).json({ error: "Token invalide" });
  }
}