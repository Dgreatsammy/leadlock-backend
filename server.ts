import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("leadlock.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT,
    budget INTEGER,
    location TEXT,
    property_type TEXT,
    urgency TEXT,
    intent TEXT,
    raw_chat TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER,
    role TEXT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(lead_id) REFERENCES leads(id)
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/leads", (req, res) => {
    const leads = db.prepare("SELECT * FROM leads ORDER BY created_at DESC").all();
    res.json(leads);
  });

  app.post("/api/leads", (req, res) => {
    const { name, phone, budget, location, property_type, urgency, intent, raw_chat } = req.body;
    const info = db.prepare(`
      INSERT INTO leads (name, phone, budget, location, property_type, urgency, intent, raw_chat)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name || 'Anonymous', phone || 'N/A', budget || 0, location || 'Unknown', property_type || 'Unknown', urgency || 'Low', intent || 'Inquiring', raw_chat || '');
    
    res.json({ id: info.lastInsertRowid });
  });

  app.get("/api/leads/:id/messages", (req, res) => {
    const messages = db.prepare("SELECT * FROM messages WHERE lead_id = ? ORDER BY created_at ASC").all(req.params.id);
    res.json(messages);
  });

  app.post("/api/leads/:id/messages", (req, res) => {
    const { role, content } = req.body;
    db.prepare("INSERT INTO messages (lead_id, role, content) VALUES (?, ?, ?)").run(req.params.id, role, content);
    res.json({ success: true });
  });

  app.patch("/api/leads/:id", (req, res) => {
    const { budget, location, property_type, urgency, intent } = req.body;
    db.prepare(`
      UPDATE leads 
      SET budget = COALESCE(?, budget), 
          location = COALESCE(?, location), 
          property_type = COALESCE(?, property_type), 
          urgency = COALESCE(?, urgency), 
          intent = COALESCE(?, intent)
      WHERE id = ?
    `).run(budget, location, property_type, urgency, intent, req.params.id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
