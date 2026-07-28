import { NextResponse } from 'next/server';
import { requireLocalSession, jsonError } from '@/lib/project/api';
import { createSubtask, listSubtasks } from '@/lib/project/repository';
import { parseSubtaskInput } from '@/lib/project/validation';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  const denied = await requireLocalSession();
  if (denied) return denied;
  const { id } = await params;
  return NextResponse.json({ subtasks: listSubtasks(id) });
}

export async function POST(request: Request, { params }: Params) {
  const denied = await requireLocalSession();
  if (denied) return denied;
  const { id } = await params;
  try {
    const input = parseSubtaskInput(await request.json());
    const subtask = createSubtask(id, input);
    return NextResponse.json({ subtask }, { status: 201 });
  } catch (error) {
    return jsonError(error, '创建子任务失败');
  }
}
