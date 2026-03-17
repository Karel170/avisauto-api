import path from "path";
import { fileURLToPath } from "url";
import { config as loadEnv } from "dotenv";

// Charger .env depuis la racine du monorepo (pour récupérer la config intacte)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, "../../..", ".env") });

import app from "./app";

// Dev local: PORT=5000 par défaut. Replit/Prod: PORT fourni par l'hôte
const rawPort = process.env["PORT"] ?? "5000";
const port = Number(rawPort) || 5000;

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
