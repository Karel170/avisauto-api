import { Router } from "express";
import { db, usersTable, companiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword, requireAuth } from "../lib/auth.js";

const router = Router();

router.post("/auth/register", async (req, res) => {
  try {
    const { email, password, name, companyName } = req.body;
    console.log("Register body:", req.body);
    if (!email || !password || !name) {
      res.status(400).json({ error: "Champs requis manquants" });
      return;
    }

    const existing = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (existing.length > 0) {
      res.status(400).json({ error: "Cet email est déjà utilisé" });
      return;
    }

    const passwordHash = await hashPassword(password);
    const [user] = await db
      .insert(usersTable)
      .values({ email, passwordHash, name, role: "user" })
      .returning();

    let company = null;
    if (companyName) {
      const [newCompany] = await db
        .insert(companiesTable)
        .values({
          ownerId: user.id,
          name: companyName,
          signature: `L'équipe de ${companyName}`,
        })
        .returning();
      company = newCompany;
    }

    const session = (req as any).session;
    session.userId = user.id;
    session.role = user.role;

    const { passwordHash: _, ...userWithoutPassword } = user;
    res.status(201).json({ user: userWithoutPassword, company });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Erreur lors de la création du compte" });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (!users.length) {
      res.status(401).json({ error: "Email ou mot de passe incorrect" });
      return;
    }

    const user = users[0];
    const valid = await verifyPassword(password, user.passwordHash);

    if (!valid) {
      res.status(401).json({ error: "Email ou mot de passe incorrect" });
      return;
    }

    const companies = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.ownerId, user.id))
      .limit(1);

    const session = (req as any).session;
    session.userId = user.id;
    session.role = user.role;

    const { passwordHash: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword, company: companies[0] || null });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Erreur lors de la connexion" });
  }
});

router.post("/auth/logout", (req, res) => {
  (req as any).session.destroy(() => {
    res.json({ success: true, message: "Déconnecté avec succès" });
  });
});

router.get("/auth/me", requireAuth, async (req, res) => {
  try {
    const session = (req as any).session;
    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, session.userId))
      .limit(1);

    if (!users.length) {
      res.status(404).json({ error: "Utilisateur non trouvé" });
      return;
    }

    const user = users[0];
    const companies = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.ownerId, user.id))
      .limit(1);

    const { passwordHash: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword, company: companies[0] || null });
  } catch (err) {
    console.error("GetMe error:", err);
    res.status(500).json({ error: "Erreur lors de la récupération du profil" });
  }
});

export default router;
