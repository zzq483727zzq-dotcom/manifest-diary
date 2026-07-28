import { NextResponse } from 'next/server';
import { requireLocalSession, jsonError } from '@/lib/project/api';
import { createProject, listProjects } from '@/lib/project/repository';
import { parseProjectInput } from '@/lib/project/validation';
import type { ProjectStatus } from '@/types/project';

export async function GET(request: Request) {
  const denied = await requireLocalSession();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const status = (searchParams.get('status') || 'active') as ProjectStatus | 'all';
  const allowed = ['active', 'completed', 'archived', 'all'];
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: '不支持的项目筛选' }, { status: 400 });
  }
  return NextResponse.json({ projects: listProjects(status) });
}

export async function POST(request: Request) {
  const denied = await requireLocalSession();
  if (denied) return denied;
  try {
    const input = parseProjectInput(await request.json());
    const project = createProject(input);
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return jsonError(error, '创建项目失败');
  }
}
