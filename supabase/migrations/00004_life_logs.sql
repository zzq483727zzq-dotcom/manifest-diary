CREATE TABLE public.life_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sleep','focus','mood','exercise','journal','manifest')),
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  value NUMERIC,
  unit TEXT CHECK (unit IS NULL OR unit IN ('minutes','hours','score')),
  content TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at IS NULL OR start_at IS NULL OR end_at >= start_at),
  CHECK (value IS NULL OR value >= 0)
);

CREATE INDEX idx_life_logs_user_date ON public.life_logs(user_id, entry_date DESC);
CREATE INDEX idx_life_logs_user_type_date ON public.life_logs(user_id, type, entry_date DESC);

ALTER TABLE public.life_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own life logs"
  ON public.life_logs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
