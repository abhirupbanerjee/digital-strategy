// app/api/threads/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  const { threadId, projectId, title } = await request.json();
  
  // Just store the reference - no messages
  const { data, error } = await supabaseServer
    .from('threads')
    .upsert({
      id: threadId,  // OpenAI thread ID
      project_id: projectId,
      title: title || 'New Chat',
      last_activity: new Date().toISOString(),
      message_count: 1
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json(data);
}

// Load thread messages from OpenAI
export async function GET(request: NextRequest) {
  const threadId = request.nextUrl.searchParams.get('threadId');
  
  if (!threadId) {
    return NextResponse.json({ error: 'Thread ID required' }, { status: 400 });
  }

  // Get thread metadata from Supabase
  const { data: threadData } = await supabaseServer
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
      messages: messages.data
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
  }
}
