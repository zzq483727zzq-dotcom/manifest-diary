-- ============================================
-- Manifest Diary: Initial Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- users 表（扩展 Supabase Auth 的 profiles）
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  preferences JSONB DEFAULT '{
    "ai_persona_intensity": 3,
    "preferred_tone": "balanced",
    "onboarding_answers": {}
  }'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 自动创建 profile 触发器
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- journal_entries（复盘日记）
-- ============================================
CREATE TABLE public.journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  entry_date DATE NOT NULL,
  raw_input TEXT NOT NULL,
  input_method TEXT NOT NULL CHECK (input_method IN ('voice', 'text', 'mixed')),
  ai_response TEXT,
  ai_structured JSONB,
  user_edits JSONB,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ai_processed', 'finalized'))
);

CREATE INDEX idx_journal_entries_user_date ON public.journal_entries(user_id, entry_date DESC);

-- ============================================
-- manifest_entries（显化日记）
-- ============================================
CREATE TABLE public.manifest_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  entry_date DATE NOT NULL,
  intention TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('self', 'relationship', 'career', 'health', 'abundance', 'other')),
  ai_echo TEXT,
  keywords TEXT[]
);

CREATE INDEX idx_manifest_entries_user_date ON public.manifest_entries(user_id, entry_date DESC);

-- ============================================
-- tomorrow_scripts（明日脚本）
-- ============================================
CREATE TABLE public.tomorrow_scripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  scheduled_for DATE NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_tomorrow_scripts_user_scheduled ON public.tomorrow_scripts(user_id, scheduled_for DESC);

-- ============================================
-- ai_call_logs（AI 调用日志）
-- ============================================
CREATE TABLE public.ai_call_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  mode TEXT NOT NULL CHECK (mode IN ('reflection', 'manifest_echo', 'manifest_analysis')),
  tokens_in INTEGER,
  tokens_out INTEGER,
  latency_ms INTEGER,
  cost_estimate NUMERIC(10, 6)
);

-- ============================================
-- RLS 策略：所有表只允许用户访问自己的数据
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manifest_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tomorrow_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_call_logs ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- journal_entries
CREATE POLICY "Users can CRUD own journal entries"
  ON public.journal_entries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- manifest_entries
CREATE POLICY "Users can CRUD own manifest entries"
  ON public.manifest_entries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- tomorrow_scripts
CREATE POLICY "Users can CRUD own tomorrow scripts"
  ON public.tomorrow_scripts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ai_call_logs
CREATE POLICY "Users can view own AI call logs"
  ON public.ai_call_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert AI call logs"
  ON public.ai_call_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);
