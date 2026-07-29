import { NextResponse } from 'next/server';
import { requireLocalSession, jsonError } from '@/lib/project/api';
import { deleteProjectTimeEntry, updateProjectTimeEntry } from '@/lib/project/repository';
import { parseProjectTimeEntryInput } from '@/lib/project/validation';
import { localDateString } from '@/lib/project/date';

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Params) {
  const denied = await requireLocalSession();
  if (denied) return denied;
  const { id } = await params;
  try {
    const input = parseProjectTimeEntryInput(await request.json(), localDateString());
    const timeEntry = updateProjectTimeEntry(id, input);
    return NextResponse.json({ timeEntry });
  } catch (error) {
    return jsonError(error, '更新耗时失败');
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const denied = await requireLocalSession();
  if (denied) return denied;
  const { id } = await params;
  try {
    deleteProjectTimeEntry(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, '删除耗时失败');
  }
}
