import { Router } from "express";
import { db, templatesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireCompanyAccess } from "../lib/auth.js";

const router = Router();

router.get("/companies/:companyId/templates", requireAuth, requireCompanyAccess, async (req, res) => {
  try {
    const companyId = req.params.companyId as any;
    const templates = await db
      .select()
      .from(templatesTable)
      .where(eq(templatesTable.companyId, companyId));

    res.json({ templates });
  } catch (err) {
    console.error("GetTemplates error:", err);
    res.status(500).json({ error: "Erreur lors de la récupération des modèles" });
  }
});

router.post("/companies/:companyId/templates", requireAuth, requireCompanyAccess, async (req, res) => {
  try {
    const companyId = req.params.companyId as any;
    const { name, content, type } = req.body;

    if (!name || !content || !type) {
      res.status(400).json({ error: "Champs requis manquants" });
      return;
    }

    const [template] = await db
      .insert(templatesTable)
      .values({ companyId, name, content, type })
      .returning();

    res.status(201).json(template);
  } catch (err) {
    console.error("CreateTemplate error:", err);
    res.status(500).json({ error: "Erreur lors de la création du modèle" });
  }
});

router.put("/companies/:companyId/templates/:templateId", requireAuth, requireCompanyAccess, async (req, res) => {
  try {
    const companyId = req.params.companyId as any;
    const templateId = parseInt(req.params.templateId);
    const { name, content, type } = req.body;

    const [updated] = await db
      .update(templatesTable)
      .set({ name, content, type, updatedAt: new Date() })
      .where(and(eq(templatesTable.id, templateId), eq(templatesTable.companyId, companyId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Modèle non trouvé" });
      return;
    }

    res.json(updated);
  } catch (err) {
    console.error("UpdateTemplate error:", err);
    res.status(500).json({ error: "Erreur lors de la mise à jour" });
  }
});

router.delete("/companies/:companyId/templates/:templateId", requireAuth, requireCompanyAccess, async (req, res) => {
  try {
    const companyId = req.params.companyId as any;
    const templateId = parseInt(req.params.templateId);

    await db
      .delete(templatesTable)
      .where(and(eq(templatesTable.id, templateId), eq(templatesTable.companyId, companyId)));

    res.json({ success: true, message: "Modèle supprimé" });
  } catch (err) {
    console.error("DeleteTemplate error:", err);
    res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

export default router;
