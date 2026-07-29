import { NextResponse } from 'next/server';
import { requireLocalSession, jsonError } from '@/lib/project/api';
import { createProjectTimeEntry, listProjectTimeEntries } from '@/lib/project/repository';
import { parseProjectTimeEntryInput } from '@/lib/project/validation';
import { localDateString } from '@/lib/project/date';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  const denied = await requireLocalSession();
  if (denied) return denied;
  const { id } = await params;
  return NextResponse.json({ timeEntries: listProjectTimeEntries(id) });
}

export async function POST(request: Request, { params }: Params) {
  const denied = await requireLocalSession();
  if (denied) return denied;
  const { id } = await params;
  try {
    const input = parseProjectTimeEntryInput(await request.json(), localDateString());
    const entry = createProjectTimeEntry(id, input);
    return NextResponse.json({ timeEntry: entry }, { status: 201 });
  } catch (error) {
    return jsonError(error, '添加耗时失败');
  }
}
