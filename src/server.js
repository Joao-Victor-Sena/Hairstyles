require("dotenv").config?.();
const path = require("node:path");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./db");
const { isValidCpf, isValidEmail } = require("./validation");

const app = express();
const port = process.env.PORT || 3000;
const secret = process.env.JWT_SECRET || "development-only-change-me";
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "20kb" }));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.use(express.static(path.join(__dirname, "..", "assets")));

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, phone: user.phone };
}
function auth(req, res, next) {
  try {
    req.user = jwt.verify(
      (req.headers.authorization || "").replace("Bearer ", ""),
      secret,
    );
    next();
  } catch {
    res.status(401).json({ error: "Autenticacao necessaria." });
  }
}
function safeError(res, error) {
  console.error(error);
  res.status(500).json({ error: "Nao foi possivel concluir a operacao." });
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/api/services", (_req, res) =>
  res.json({
    services: db
      .prepare(
        "SELECT id, name, description, price_cents, price_note, popular FROM services ORDER BY id",
      )
      .all(),
  }),
);
app.get("/api/services/popular", (_req, res) =>
  res.json({
    services: db
      .prepare(
        "SELECT id, name, description, price_note FROM services WHERE popular = 1 ORDER BY id",
      )
      .all(),
  }),
);
app.get("/api/availability", (req, res) => {
  const date = String(req.query.date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    return res.status(400).json({ error: "Data invalida." });
  const slots = db
    .prepare(
      "SELECT id, time FROM slots WHERE date = ? AND available = 1 ORDER BY time",
    )
    .all(date);
  res.json({ date, slots });
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, phone, birthDate, cpf, password, address } = req.body;
    if (
      !name ||
      name.trim().length < 5 ||
      !isValidEmail(email) ||
      !phone ||
      !birthDate ||
      !isValidCpf(cpf) ||
      typeof password !== "string" ||
      password.length < 8
    )
      return res.status(400).json({ error: "Confira os campos obrigatorios." });
    const passwordHash = await bcrypt.hash(password, 12);
    const result = db
      .prepare(
        "INSERT INTO users (name, email, phone, birth_date, cpf, password_hash, address_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        name.trim(),
        email.trim().toLowerCase(),
        phone,
        birthDate,
        String(cpf).replace(/\D/g, ""),
        passwordHash,
        JSON.stringify(address || {}),
      );
    res
      .status(201)
      .json({
        user: {
          id: result.lastInsertRowid,
          name: name.trim(),
          email: email.trim().toLowerCase(),
        },
      });
  } catch (error) {
    if (String(error.message).includes("UNIQUE"))
      return res.status(409).json({ error: "E-mail ou CPF ja cadastrado." });
    safeError(res, error);
  }
});
app.post("/api/auth/login", async (req, res) => {
  try {
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(
      String(req.body.email || "")
        .trim()
        .toLowerCase(),
    );
    if (
      !user ||
      !(await bcrypt.compare(
        String(req.body.password || ""),
        user.password_hash,
      ))
    )
      return res.status(401).json({ error: "E-mail ou senha invalidos." });
    res.json({
      token: jwt.sign({ id: user.id, email: user.email }, secret, {
        expiresIn: "2h",
      }),
      user: publicUser(user),
    });
  } catch (error) {
    safeError(res, error);
  }
});
app.get("/api/me", auth, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  res.json({ user: publicUser(user) });
});
app.post("/api/bookings", auth, (req, res) => {
  try {
    const { serviceId, slotId } = req.body;
    const service = db
      .prepare("SELECT id, price_cents FROM services WHERE id = ?")
      .get(Number(serviceId));
    const slot = db
      .prepare("SELECT id FROM slots WHERE id = ? AND available = 1")
      .get(Number(slotId));
    if (!service || !slot)
      return res
        .status(400)
        .json({ error: "Servico ou horario indisponivel." });
    const booking = db.transaction(() => {
      const result = db
        .prepare(
          "INSERT INTO bookings (user_id, service_id, slot_id, total_cents) VALUES (?, ?, ?, ?)",
        )
        .run(req.user.id, service.id, slot.id, service.price_cents);
      db.prepare("UPDATE slots SET available = 0 WHERE id = ?").run(slot.id);
      return result.lastInsertRowid;
    })();
    res
      .status(201)
      .json({ bookingId: booking, totalCents: service.price_cents });
  } catch (error) {
    if (String(error.message).includes("UNIQUE"))
      return res
        .status(409)
        .json({ error: "Este horario acabou de ser reservado." });
    safeError(res, error);
  }
});
app.post("/api/auth/recover", (req, res) => {
  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(
    String(req.body.email || "")
      .trim()
      .toLowerCase(),
  );
  res.json({
    message:
      "Se o e-mail estiver cadastrado, uma senha temporaria sera enviada.",
  });
  if (exists)
    console.log("Senha temporaria solicitada para usuario", exists.id);
});
app.get("*", (_req, res) =>
  res.sendFile(path.join(__dirname, "..", "assets", "index.html")),
);
app.use((error, _req, res, _next) => safeError(res, error));

if (require.main === module)
  app.listen(port, () => console.log(`Hairstyles em http://localhost:${port}`));
module.exports = app;
