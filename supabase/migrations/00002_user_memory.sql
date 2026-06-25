-- ============================================
-- Manifest Diary: User Memory Table
-- ============================================

CREATE TABLE public.user_memory (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  memory_type  TEXT NOT NULL CHECK (memory_type IN ('theme', 'emotion_pattern', 'growth', 'preference')),
  content      TEXT NOT NULL,
  evidence     TEXT NOT NULL,
  importance   INTEGER DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
  deleted_at   TIMESTAMPTZ  -- 软删除
);

CREATE INDEX idx_user_memory_user_importance ON public.user_memory(user_id, importance DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_memory_user_type ON public.user_memory(user_id, memory_type) WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE public.user_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own memory"
  ON public.user_memory FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
