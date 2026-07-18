import { createClient } from '@/lib/supabase/server';
import type { LifeLog } from '@/types/life';
import type { LifeLogInput } from '@/lib/life/validation';

export async function fetchLifeLogs(userId: string, startDate: string, endDate: string): Promise<LifeLog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('life_logs').select('id,user_id,entry_date,type,start_at,end_at,value,unit,content,metadata,created_at')
    .eq('user_id', userId).gte('entry_date', startDate).lte('entry_date', endDate).order('created_at');
  if (error) throw error;
  return (data ?? []) as LifeLog[];
}

export async function createLifeLog(userId: string, entryDate: string, input: LifeLogInput): Promise<LifeLog> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('life_logs').insert({ user_id: userId, entry_date: entryDate, ...input }).select().single();
  if (error) throw error;
  return data as LifeLog;
}
