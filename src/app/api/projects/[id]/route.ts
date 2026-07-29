import { NextResponse } from 'next/server';
import { requireLocalSession, jsonError } from '@/lib/project/api';
import { deleteProject, getProjectSummary, setProjectStatus, updateProject } from '@/lib/project/repository';
import { parseProjectInput, parseProjectStatus } from '@/lib/project/validation';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  const denied = await requireLocalSession();
  if (denied) return denied;
  const { id } = await params;
  const project = getProjectSummary(id);
  if (!project) return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  return NextResponse.json({ project });
}

export async function PATCH(request: Request, { params }: Params) {
  const denied = await requireLocalSession();
  if (denied) return denied;
  const { id } = await params;
  try {
    const body = await request.json();
    if (body && typeof body === 'object' && 'status' in body && Object.keys(body).length === 1) {
      const status = parseProjectStatus(body.status);
      const project = setProjectStatus(id, status);
      return NextResponse.json({ project });
    }
    const input = parseProjectInput(body);
    const project = updateProject(id, input);
    return NextResponse.json({ project: getProjectSummary(project.id) });
  } catch (error) {
    return jsonError(error, '更新项目失败');
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const denied = await requireLocalSession();
  if (denied) return denied;
  const { id } = await params;
  try {
    deleteProject(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, '删除项目失败');
  }
}
