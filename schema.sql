-- Padel Coach IA — banco D1 (SQLite)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  nome TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expira_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,              -- 'Grátis', 'Atleta', 'Pro'
  preco_centavos INTEGER NOT NULL DEFAULT 0,
  videos_por_mes INTEGER NOT NULL, -- limite de análises/mês (0 = ilimitado)
  ativo INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  plan_id INTEGER NOT NULL REFERENCES plans(id),
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente|ativo|cancelado|vencido
  mp_payment_id TEXT,                       -- id do pagamento no Mercado Pago
  renova_em TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  r2_key TEXT NOT NULL,            -- chave do objeto no R2
  titulo TEXT,                     -- 'Treino de saque 12/11'
  duracao_s INTEGER,
  status TEXT NOT NULL DEFAULT 'enviado', -- enviado|processando|analisado|erro
  enviado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL REFERENCES videos(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  nota_geral REAL,                 -- 0-10
  resumo TEXT,
  pontos_fortes TEXT,              -- JSON array de strings
  pontos_melhorar TEXT,            -- JSON array de strings
  treino_sugerido TEXT,
  modelo_usado TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_videos_user ON videos(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_user ON analyses(user_id);
INSERT OR IGNORE INTO plans (id, nome, preco_centavos, videos_por_mes) VALUES
  (1, 'Grátis', 0, 2),
  (2, 'Atleta', 1990, 20),
  (3, 'Pro', 3990, 0);
