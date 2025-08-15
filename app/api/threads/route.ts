// app/api/threads/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function GET(request: NextRequest) {
  const threadId = request.nextUrl.searchParams.get('threadId');
  
  if (!threadId) {
    return NextResponse.json({ error: 'Thread ID required' }, { status: 400 });
  }

  // Get thread metadata from Supabase
  const { data: threadData } = await supabase
    .from('threads')
    .select('*, project:projects(*)')
    .eq('id', threadId)
    .single();

  // Get actual messages from OpenAI
  const headers = {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'OpenAI-Beta': 'assistants=v2',
  };

  try {
    const response = await fetch(
      `https://api.openai.com/v1/threads/${threadId}/messages`,
      { headers }
    );
    
    const messages = await response.json();
    
    return NextResponse.json({
      thread: threadData,
      messages: messages.data || []
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  
  const { data, error } = await supabase
    .from('threads')
    .upsert({
      id: body.id,
      project_id: body.projectId,
      title: body.title || 'New Chat',
      last_activity: new Date().toISOString(),
      message_count: body.messages?.length || 0
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json(data);
}