import { NextResponse } from 'next/server';
import { requireLocalSession, jsonError } from '@/lib/project/api';
import { deleteSubtask, moveSubtask, updateSubtask } from '@/lib/project/repository';

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Params) {
  const denied = await requireLocalSession();
  if (denied) return denied;
  const { id } = await params;
  try {
    const body = await request.json();
    if (body && typeof body === 'object' && body.move) {
      const subtask = moveSubtask(id, body.move === 'up' ? 'up' : 'down');
      return NextResponse.json({ subtask });
    }

    const patch: { title?: string; is_done?: boolean } = {};
    if (body && typeof body === 'object') {
      if ('title' in body && typeof body.title === 'string') {
        const title = body.title.trim();
        if (!title) throw new Error('子任务标题不能为空');
        if (title.length > 120) throw new Error('子任务标题不能超过 120 个字符');
        patch.title = title;
      }
      if ('is_done' in body) patch.is_done = Boolean(body.is_done);
    }
    const subtask = updateSubtask(id, patch);
    return NextResponse.json({ subtask });
  } catch (error) {
    return jsonError(error, '更新子任务失败');
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const denied = await requireLocalSession();
  if (denied) return denied;
  const { id } = await params;
  try {
    deleteSubtask(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, '删除子任务失败');
  }
}
