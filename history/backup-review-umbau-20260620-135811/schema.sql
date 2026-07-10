CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company TEXT,
  name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  service TEXT,
  message TEXT,
  ai_analysis TEXT,
  language TEXT DEFAULT 'de',
  source TEXT DEFAULT 'website',
  status TEXT DEFAULT 'new',
  created_at TEXT NOT NULL
);