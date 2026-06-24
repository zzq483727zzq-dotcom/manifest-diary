import { createClient } from '@/lib/supabase/server';
import { computeEntryDate, formatDateZh, APP_TIMEZONE } from '@/lib/date';
import { greetingText } from '@/lib/time-greeting';
import { MorningGreeting } from '@/components/morning/MorningGreeting';
import { ScriptStepRow } from '@/components/morning/ScriptStepRow';
import { EmptyState } from '@/components/morning/EmptyState';

interface Step {
  step: number;
  action: string;
  duration_minutes: number;
  completed_at: string | null;
}

export default async function HomePage() {
  const supabase = await createClient();
  const now = new Date();
  const today = computeEntryDate(now, APP_TIMEZONE);

  const { data: script } = await supabase
    .from('tomorrow_scripts')
    .select('*')
    .eq('scheduled_for', today)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const steps = (script?.steps as Step[] | undefined) ?? [];
  const doneCount = steps.filter((s) => s.completed_at !== null).length;
  const completionRate = steps.length > 0 ? doneCount / steps.length : 0;

  return (
    <div>
      <MorningGreeting
        greeting={greetingText(now)}
        date={formatDateZh(today)}
        hasScript={steps.length > 0}
        completionRate={completionRate}
      />
      {steps.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3 max-w-xl mx-auto">
          {steps.map((s, i) => (
            <ScriptStepRow
              key={i}
              scriptId={script!.id}
              stepIdx={i}
              step={s.step}
              action={s.action}
              durationMin={s.duration_minutes}
              initiallyDone={s.completed_at !== null}
            />
          ))}
        </div>
      )}
    </div>
  );
}