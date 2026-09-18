const path = require("node:path");
const fs = require("node:fs");
const Database = require("better-sqlite3");

const dataDir = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, "hairstyles.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    birth_date TEXT NOT NULL,
    cpf TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    address_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price_cents INTEGER,
    price_note TEXT,
    popular INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    available INTEGER NOT NULL DEFAULT 1,
    UNIQUE(date, time)
  );
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    service_id INTEGER NOT NULL,
    slot_id INTEGER NOT NULL UNIQUE,
    total_cents INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(service_id) REFERENCES services(id),
    FOREIGN KEY(slot_id) REFERENCES slots(id)
  );
`);

const services = [
  ["Corte feminino", "Corte personalizado e finalizacao.", 6000, "R$ 60", 1],
  ["Escova", "Finalizacao com movimento e brilho.", 4500, "R$ 45", 1],
  [
    "Combo corte, escova e hidratacao",
    "O cuidado completo em uma visita.",
    15000,
    "R$ 150",
    1,
  ],
  [
    "Nutricao",
    "Reposicao de oleos e nutrientes.",
    6000,
    "R$ 60 | Pacote com 4: R$ 200",
    0,
  ],
  [
    "Hidratacao",
    "Tratamento para maciez e luminosidade.",
    6000,
    "R$ 60 | Pacote com 4: R$ 200",
    0,
  ],
  [
    "Reconstrucao",
    "Forca para fios danificados.",
    8000,
    "R$ 80 | Com escova: R$ 100",
    0,
  ],
  [
    "Reparacao",
    "Cuidado direcionado para pontas e comprimento.",
    6000,
    "R$ 60",
    0,
  ],
  [
    "Cauterizacao",
    "Reposicao de massa e selagem.",
    8000,
    "R$ 80 | Pacote com 4: R$ 280",
    0,
  ],
  [
    "Progressiva",
    "Alinhamento mediante avaliacao.",
    15000,
    "A partir de R$ 150",
    0,
  ],
  ["Selagem", "Brilho e alinhamento dos fios.", 15000, "R$ 150", 0],
  ["Botox", "Tratamento disciplinante e nutritivo.", 10000, "R$ 100", 0],
  [
    "Mechas",
    "Iluminacao mediante teste de mechas.",
    35000,
    "A partir de R$ 350",
    0,
  ],
  ["Coloracao", "Retoque de raiz.", 8000, "R$ 80", 0],
];
const insert = db.prepare(
  "INSERT OR IGNORE INTO services (id, name, description, price_cents, price_note, popular) VALUES (?, ?, ?, ?, ?, ?)",
);
db.transaction(() =>
  services.forEach((service, index) => insert.run(index + 1, ...service)),
)();

const insertSlot = db.prepare(
  "INSERT OR IGNORE INTO slots (date, time) VALUES (?, ?)",
);
const times = ["09:00", "10:30", "13:30", "15:00", "16:30"];
db.transaction(() => {
  for (let offset = 1; offset <= 21; offset += 1) {
    const date = new Date(Date.now() + offset * 86400000)
      .toISOString()
      .slice(0, 10);
    times.forEach((time) => insertSlot.run(date, time));
  }
})();

module.exports = db;
