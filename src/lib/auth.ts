import bcrypt from "bcryptjs";
import { db, usersTable, companiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = (req as any).session;
  if (!session?.userId) {
    res.status(401).json({ error: "Non autorisé", message: "Connectez-vous pour continuer" });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const session = (req as any).session;
  if (!session?.userId || session?.role !== "admin") {
    res.status(403).json({ error: "Accès refusé", message: "Accès administrateur requis" });
    return;
  }
  next();
}

export async function requireCompanyAccess(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const session = (req as any).session;
  if (!session?.userId) {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const companyId = req.params.companyId;
  if (!companyId) {
    res.status(400).json({ error: "ID entreprise invalide" });
    return;
  }

  if (session.role === "admin") {
    next();
    return;
  }

  const company = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, companyId))
    .limit(1);

  if (!company.length || company[0].ownerId !== session.userId) {
    res.status(403).json({ error: "Accès refusé à cette entreprise" });
    return;
  }

  next();
}
