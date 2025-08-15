// app/api/projects/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Optional: make sure this route is always dynamic (no static caching)
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // server-only env; never expose to client
);

// Small helper for uniform errors
function errorJson(message: string, status = 500, extra?: unknown) {
  return NextResponse.json({ error: { message, ...(extra ? { details: extra } : {}) } }, { status });
}

export async function GET(_req: NextRequest) {
  // Optional pagination via query params later; for now, just order
  const { data, error } = await supabase
    .from('projects')
    .select('*, threads(id, title, last_activity)')
    .order('created_at', { ascending: false });

  if (error) return errorJson('Failed to fetch projects', 500, error);

  return NextResponse.json({ projects: data ?? [] }, { status: 200 });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorJson('Invalid JSON body', 400);
  }

  // Minimal validation
  const { name, description = null, color = null } = (body as Record<string, unknown>) ?? {};
  if (typeof name !== 'string' || name.trim() === '') {
    return errorJson('`name` is required', 400);
  }
  if (description !== null && typeof description !== 'string') {
    return errorJson('`description` must be string if provided', 400);
  }
  if (color !== null && typeof color !== 'string') {
    return errorJson('`color` must be string if provided', 400);
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      name: name.trim(),
      description,
      color,
    })
    .select()
    .single();

  if (error) return errorJson('Failed to create project', 500, error);

  // Consistent shape: return single under `project`
  return NextResponse.json({ project: data }, { status: 201 });
}
