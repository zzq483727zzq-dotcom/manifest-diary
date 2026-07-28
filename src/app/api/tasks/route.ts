import { NextResponse } from 'next/server';
import { requireLocalSession, jsonError } from '@/lib/project/api';
import { createTask, listTasks } from '@/lib/project/repository';
import { parseTaskInput } from '@/lib/project/validation';

export async function GET(request: Request) {
  const denied = await requireLocalSession();
  if (denied) return denied;
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId') || undefined;
  return NextResponse.json({ tasks: listTasks(projectId) });
}

export async function POST(request: Request) {
  const denied = await requireLocalSession();
  if (denied) return denied;
  try {
    const input = parseTaskInput(await request.json());
    if (!('project_id' in input) || !input.project_id || !input.title) {
      return NextResponse.json({ error: '请填写项目和任务标题' }, { status: 400 });
    }
    const task = createTask({
      project_id: input.project_id,
      title: input.title,
      description: input.description ?? '',
      status: input.status ?? 'todo',
      priority: input.priority ?? 'medium',
      due_date: input.due_date ?? null,
    });
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return jsonError(error, '创建任务失败');
  }
}
