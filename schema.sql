-- Fitness Manager D1 schema.
-- The app_state row is the single-user aggregate used by the Pages Functions API.
-- The legacy tables remain available for importing the original seed SQL.

CREATE TABLE IF NOT EXISTS app_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version INTEGER NOT NULL DEFAULT 1,
  state_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  block_id INTEGER REFERENCES blocks(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  target_part TEXT,
  sets INTEGER,
  reps TEXT,
  note TEXT,
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS schedule (
  day INTEGER PRIMARY KEY CHECK (day BETWEEN 1 AND 7),
  kind TEXT NOT NULL,
  block_id INTEGER REFERENCES blocks(id) ON DELETE SET NULL,
  cardio_desc TEXT
);

CREATE TABLE IF NOT EXISTS workout_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  exercise TEXT NOT NULL,
  target_part TEXT,
  weight REAL,
  unit TEXT DEFAULT 'kg',
  sets INTEGER,
  reps INTEGER,
  rest_time INTEGER,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  deadline TEXT,
  achieved INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_workout_log_date ON workout_log(date);
CREATE INDEX IF NOT EXISTS idx_workout_log_exercise ON workout_log(exercise);
