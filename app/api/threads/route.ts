// app/api/threads/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // server-only; never expose
);

function errorJson(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ error: { message, ...(details ? { details } : {}) } }, { status });
}

export async function GET(request: NextRequest) {
  const threadId = request.nextUrl.searchParams.get('threadId');
  const limit = Number(request.nextUrl.searchParams.get('limit') ?? 50);
  const order = (request.nextUrl.searchParams.get('order') ?? 'asc') as 'asc' | 'desc';

  if (!threadId || typeof threadId !== 'string') {
    return errorJson('`threadId` query param is required', 400);
  }

  // 1) Get thread metadata from Supabase
  const { data: threadData, error: threadErr } = await supabase
    .from('threads')
    .select('*, project:projects(*)')
    .eq('id', threadId)
    .single();

  if (threadErr) return errorJson('Failed to fetch thread metadata', 500, threadErr);
  if (!threadData) return errorJson('Thread not found', 404);

  // 2) Fetch messages from OpenAI
  const headers: Record<string, string> = {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
    'OpenAI-Beta': 'assistants=v2',
    'Content-Type': 'application/json'
    // 'OpenAI-Organization': process.env.OPENAI_ORG_ID ?? '',
  };

  const url = new URL(`https://api.openai.com/v1/threads/${threadId}/messages`);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('order', order);

  try {
    const response = await fetch(url.toString(), { headers, method: 'GET' });

    if (!response.ok) {
      const err = await response.text();
      return errorJson('OpenAI messages fetch failed', response.status, err);
    }

    const json = await response.json();
    const messages = Array.isArray(json?.data) ? json.data : [];

    return NextResponse.json({ thread: threadData, messages }, { status: 200 });
  } catch (e) {
    return errorJson('Failed to load messages', 500, String(e));
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorJson('Invalid JSON body', 400);
  }

  const { id, projectId, title, messages } = (body as Record<string, unknown>) ?? {};

  if (typeof id !== 'string' || !id) return errorJson('`id` is required (string)', 400);
  if (typeof projectId !== 'string' || !projectId) return errorJson('`projectId` is required (string)', 400);
  if (title != null && typeof title !== 'string') return errorJson('`title` must be a string if provided', 400);

  const nowIso = new Date().toISOString();
  const messageCount = Array.isArray(messages) ? messages.length : 0;

  const { data, error } = await supabase
    .from('threads')
    .upsert(
      {
        id, // ensure this is your PK; otherwise use `onConflict` with your unique column
        project_id: projectId,
        title: title?.trim() || 'New Chat',
        last_activity: nowIso,
        message_count: messageCount
      },
      { onConflict: 'id' }
    )
    .select()
    .single();

  if (error) return errorJson('Failed to upsert thread', 500, error);

  return NextResponse.json({ thread: data }, { status: 201 });
}
