require("dotenv").config?.();
const path = require("node:path");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("node:crypto");
const db = require("./db");
const { isValidCpf, isValidEmail } = require("./validation");
const { sendRecoveryEmail } = require("./mailer");

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

function sanitizeProfileUpdate(payload = {}) {
  const nextAddress =
    payload.address && typeof payload.address === "object" ? payload.address : {};

  const rawPhone = String(payload.phone || "").trim();
  const cleanPhone = rawPhone.replace(/\D/g, "");
  const phone = cleanPhone.length >= 10 ? rawPhone : undefined;
  const address = Object.fromEntries(
    Object.entries({
      cep: String(nextAddress.cep || "").trim(),
      street: String(nextAddress.street || "").trim(),
      number: String(nextAddress.number || "").trim(),
      complement: String(nextAddress.complement || "").trim(),
      neighborhood: String(nextAddress.neighborhood || "").trim(),
      city: String(nextAddress.city || "").trim(),
      state: String(nextAddress.state || "").trim().toUpperCase(),
    }).filter(([, value]) => value !== ""),
  );

  return {
    phone: phone || undefined,
    address,
  };
}

function validateProfileUpdate(payload = {}) {
  const phone = String(payload.phone || "").trim();
  const phoneDigits = phone.replace(/\D/g, "");
  const birthDate = String(payload.birthDate || "").trim();
  const address = payload.address && typeof payload.address === "object"
    ? payload.address
    : {};
  const addressFields = [
    ["cep", 9],
    ["street", 120],
    ["number", 10],
    ["complement", 80],
    ["neighborhood", 80],
    ["city", 80],
    ["state", 2],
  ];

  if (!/^.{10,15}$/.test(phone) || ![10, 11].includes(phoneDigits.length))
    return "Telefone invalido. Use um telefone com 10 ou 11 digitos.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate))
    return "Data de nascimento invalida.";
  const parsedBirthDate = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(parsedBirthDate.getTime()) || parsedBirthDate > new Date())
    return "Data de nascimento invalida.";

  for (const [fieldName, maxLength] of addressFields) {
    const value = String(address[fieldName] || "").trim();
    if (value.length > maxLength)
      return `O campo ${fieldName} excede o limite de ${maxLength} caracteres.`;
  }
  const cepDigits = String(address.cep || "").replace(/\D/g, "");
  if (cepDigits && cepDigits.length !== 8)
    return "CEP invalido. Use 8 digitos.";
  if (address.state && !/^[a-z]{2}$/i.test(String(address.state).trim()))
    return "Estado invalido. Use 2 letras.";
  return null;
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
  const detail = error && error.message ? error.message : "erro desconhecido";
  console.error("Erro do servidor:", detail);
  res.status(500).json({
    error: `Erro interno do servidor: ${detail}`,
  });
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
  if (!user) return res.status(404).json({ error: "Usuario nao encontrado." });

  let address = {};
  try {
    address = JSON.parse(user.address_json || "{}");
  } catch {
    address = {};
  }

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      birthDate: user.birth_date,
      cpf: user.cpf,
      address,
    },
  });
});
app.put("/api/me", auth, (req, res) => {
  return res.status(403).json({
    error: "A edicao dos dados cadastrais esta desabilitada.",
  });

  try {
    const validationError = validateProfileUpdate(req.body);
    if (validationError) return res.status(400).json({ error: validationError });
    const { phone, address } = sanitizeProfileUpdate(req.body);
    const birthDate = String(req.body.birthDate || "").trim();
    const normalizedPhone = String(phone || "").trim();

    const normalizedAddress = Object.fromEntries(
      Object.entries({
        cep: String(address.cep || "").trim(),
        street: String(address.street || "").trim(),
        number: String(address.number || "").trim(),
        complement: String(address.complement || "").trim(),
        neighborhood: String(address.neighborhood || "").trim(),
        city: String(address.city || "").trim(),
        state: String(address.state || "").trim().toUpperCase(),
      }).filter(([, value]) => value !== ""),
    );

    db.prepare(
      "UPDATE users SET phone = ?, birth_date = COALESCE(?, birth_date), address_json = ? WHERE id = ?",
    ).run(
      normalizedPhone,
      birthDate || null,
      JSON.stringify(normalizedAddress),
      req.user.id,
    );

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        birthDate: user.birth_date,
        cpf: user.cpf,
        address: normalizedAddress,
      },
    });
  } catch (error) {
    safeError(res, error);
  }
});
app.post("/api/bookings", auth, (req, res) => {
  try {
    const requestedServiceIds = Array.isArray(req.body.serviceIds)
      ? req.body.serviceIds
      : [req.body.serviceId];
    const serviceIds = [...new Set(requestedServiceIds.map(Number))].filter(
      (id) => Number.isInteger(id) && id > 0,
    );
    const services = serviceIds.length
      ? db
          .prepare(
            `SELECT id, price_cents FROM services WHERE id IN (${serviceIds.map(() => "?").join(",")})`,
          )
          .all(...serviceIds)
      : [];
    const slot = db
      .prepare("SELECT id FROM slots WHERE id = ? AND available = 1")
      .get(Number(req.body.slotId));
    if (!serviceIds.length || services.length !== serviceIds.length || !slot)
      return res
        .status(400)
        .json({ error: "Selecione pelo menos um servico e um horario disponivel." });
    const booking = db.transaction(() => {
      const totalCents = services.reduce(
        (total, service) => total + service.price_cents,
        0,
      );
      const result = db
        .prepare(
          "INSERT INTO bookings (user_id, service_id, slot_id, total_cents) VALUES (?, ?, ?, ?)",
        )
        .run(req.user.id, services[0].id, slot.id, totalCents);
      const insertService = db.prepare(
        "INSERT INTO booking_services (booking_id, service_id) VALUES (?, ?)",
      );
      serviceIds.forEach((serviceId) => insertService.run(result.lastInsertRowid, serviceId));
      db.prepare("UPDATE slots SET available = 0 WHERE id = ?").run(slot.id);
      return { id: result.lastInsertRowid, totalCents };
    })();
    res
      .status(201)
      .json({ bookingId: booking.id, totalCents: booking.totalCents, serviceIds });
  } catch (error) {
    if (String(error.message).includes("UNIQUE"))
      return res
        .status(409)
        .json({ error: "Este horario acabou de ser reservado." });
    safeError(res, error);
  }
});
app.get("/api/bookings/history", auth, (req, res) => {
  try {
    const bookings = db
      .prepare(
        `SELECT b.id, b.service_id, b.total_cents, b.created_at, s.date, s.time,
          legacy_service.name AS legacy_service_name
         FROM bookings b
         JOIN slots s ON s.id = b.slot_id
         JOIN services legacy_service ON legacy_service.id = b.service_id
         WHERE b.user_id = ?
         ORDER BY s.date DESC, s.time DESC`,
      )
      .all(req.user.id);
    const serviceRows = db
      .prepare(
        `SELECT bs.booking_id, sv.id, sv.name, sv.price_cents, sv.price_note
         FROM booking_services bs
         JOIN services sv ON sv.id = bs.service_id
         WHERE bs.booking_id IN (${bookings.length ? bookings.map(() => "?").join(",") : "NULL"})
         ORDER BY sv.name`,
      )
      .all(...bookings.map((booking) => booking.id));
    const servicesByBooking = new Map();
    serviceRows.forEach((service) => {
      const servicesForBooking = servicesByBooking.get(service.booking_id) || [];
      servicesForBooking.push(service);
      servicesByBooking.set(service.booking_id, servicesForBooking);
    });
    const today = new Date().toISOString().slice(0, 10);
    const result = bookings.map((booking) => ({
      ...booking,
      status: booking.date >= today ? "upcoming" : "completed",
      services:
        servicesByBooking.get(booking.id) ||
        [{ id: booking.service_id, name: booking.legacy_service_name }],
    }));
    res.json({
      upcoming: Array.isArray(result)
        ? result.filter((booking) => booking.status === "upcoming")
        : [],
      completed: Array.isArray(result)
        ? result.filter((booking) => booking.status === "completed")
        : [],
    });
  } catch (error) {
    safeError(res, error);
  }
});
app.post("/api/auth/recover", async (req, res) => {
  const email = String(req.body.email || "")
    .trim()
    .toLowerCase();
  const user = db.prepare("SELECT id, email FROM users WHERE email = ?").get(
    email,
  );
  const genericMessage =
    "Se o e-mail estiver cadastrado, uma senha temporaria sera enviada.";

  if (!user) return res.json({ message: genericMessage });

  const temporaryPassword = crypto.randomBytes(6).toString("base64url");
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);
  try {
    await sendRecoveryEmail({ to: user.email, temporaryPassword });
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
      passwordHash,
      user.id,
    );
  } catch (error) {
    console.error("Erro ao enviar recuperacao:", error.message);
    return res.status(503).json({
      error: "Nao foi possivel enviar o e-mail agora. Tente novamente mais tarde.",
    });
  }

  res.json({ message: genericMessage });
});
app.get("/agendamento.html", (_req, res) => res.redirect(301, "/servicos.html"));
app.get("*", (_req, res) =>
  res.sendFile(path.join(__dirname, "..", "assets", "index.html")),
);
app.use((error, _req, res, _next) => safeError(res, error));

if (require.main === module)
  app.listen(port, () => console.log(`Hairstyles em http://localhost:${port}`));
module.exports = { app, sanitizeProfileUpdate, validateProfileUpdate };
