import { Router } from "express";
import { db, usersTable, companiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { hashPassword, verifyPassword } from "../lib/auth.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "avisauto-dev-secret";

router.post("/auth/register", async (req, res) => {
  try {
    const { email, password, name, companyName } = req.body;
    if (!email || !password || !name) { res.status(400).json({ error: "Champs requis manquants" }); return; }
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing.length > 0) { res.status(400).json({ error: "Cet email est deja utilise" }); return; }
    const passwordHash = await hashPassword(password);
    const [user] = await db.insert(usersTable).values({ email, passwordHash, name, role: "user" }).returning();
    let company = null;
    if (companyName) {
      const [newCompany] = await db.insert(companiesTable).values({ ownerId: user.id, name: companyName, signature: "L equipe de " + companyName }).returning();
      company = newCompany;
    }
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    const { passwordHash: _, ...userWithoutPassword } = user;
    res.status(201).json({ user: userWithoutPassword, company, token });
  } catch (err) { console.error("Register error:", err); res.status(500).json({ error: "Erreur creation compte" }); }
});

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const users = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!users.length) { res.status(401).json({ error: "Email ou mot de passe incorrect" }); return; }
    const user = users[0];
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) { res.status(401).json({ error: "Email ou mot de passe incorrect" }); return; }
    const companies = await db.select().from(companiesTable).where(eq(companiesTable.ownerId, user.id)).limit(1);
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    const { passwordHash: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword, company: companies[0] || null, token });
  } catch (err) { console.error("Login error:", err); res.status(500).json({ error: "Erreur connexion" }); }
});

router.post("/auth/logout", (req, res) => {
  res.json({ success: true, message: "Deconnecte" });
});

router.get("/auth/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) { res.status(401).json({ error: "Non autorise" }); return; }
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
    const users = await db.select().from(usersTable).where(eq(usersTable.id, decoded.userId as any)).limit(1);
    if (!users.length) { res.status(404).json({ error: "Utilisateur non trouve" }); return; }
    const user = users[0];
    const companies = await db.select().from(companiesTable).where(eq(companiesTable.ownerId, user.id)).limit(1);
    const { passwordHash: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword, company: companies[0] || null });
  } catch (err) { res.status(401).json({ error: "Token invalide" }); }
});

export default router;
