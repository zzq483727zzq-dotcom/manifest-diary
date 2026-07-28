import { NextResponse } from 'next/server';
import { requireLocalSession, jsonError } from '@/lib/project/api';
import {
  deleteTask,
  getTask,
  listSubtasks,
  listTimeEntries,
  moveTaskPosition,
  updateTask,
} from '@/lib/project/repository';
import { parseTaskInput } from '@/lib/project/validation';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  const denied = await requireLocalSession();
  if (denied) return denied;
  const { id } = await params;
  const task = getTask(id);
  if (!task) return NextResponse.json({ error: '任务不存在' }, { status: 404 });
  return NextResponse.json({
    task,
    subtasks: listSubtasks(id),
    timeEntries: listTimeEntries(id),
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const denied = await requireLocalSession();
  if (denied) return denied;
  const { id } = await params;
  try {
    const body = await request.json();
    if (body && typeof body === 'object' && body.move) {
      const task = moveTaskPosition(id, body.move === 'up' ? 'up' : 'down');
      return NextResponse.json({ task });
    }
    const patch = parseTaskInput(body, true);
    const task = updateTask(id, patch);
    return NextResponse.json({ task });
  } catch (error) {
    return jsonError(error, '更新任务失败');
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const denied = await requireLocalSession();
  if (denied) return denied;
  const { id } = await params;
  try {
    deleteTask(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, '删除任务失败');
  }
}
