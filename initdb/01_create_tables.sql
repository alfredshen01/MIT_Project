CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME
);
