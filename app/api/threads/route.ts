// app/api/threads/route.ts
// Updated to match your actual database schema

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Helper function to clean search artifacts from stored content
function cleanSearchArtifactsFromContent(text: string): string {
  if (typeof text !== 'string') return text;
  
  let cleaned = text;
  
  // Remove old-style search context markers
  cleaned = cleaned.replace(/\[Current Web Information[^\]]*\]:\s*/gi, '');
  cleaned = cleaned.replace(/Web Summary:\s*[^\n]*\n/gi, '');
  cleaned = cleaned.replace(/Top Search Results:\s*\n[\s\S]*?Instructions:[^\n]*\n/gi, '');
  cleaned = cleaned.replace(/Instructions: Please incorporate this current web information[^\n]*\n?/gi, '');
  cleaned = cleaned.replace(/\[Note: Web search was requested[^\]]*\]/gi, '');
  
  // Remove detailed search result patterns
  cleaned = cleaned.replace(/\d+\.\s+\[PDF\]\s+[^\n]*\n\s*[^\n]*\.\.\.\s*Source:\s*https?:\/\/[^\s]+\s*/gi, '');
  cleaned = cleaned.replace(/\d+\.\s+[^.]+\.\.\.\s*Source:\s*https?:\/\/[^\s]+\s*/gi, '');
  
  // Remove search metadata
  cleaned = cleaned.replace(/Search performed on:\s*[^\n]*\n/gi, '');
  cleaned = cleaned.replace(/Query:\s*"[^"]*"\s*/gi, '');
  
  // Clean up formatting artifacts
  cleaned = cleaned.replace(/^\s*---\s*\n/gm, '');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n'); // Collapse multiple newlines
  cleaned = cleaned.replace(/^\s+|\s+$/g, ''); // Trim whitespace
  
  return cleaned;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get('threadId');

    if (!threadId) {
      return NextResponse.json({ error: 'Thread ID is required' }, { status: 400 });
    }

    console.log('Fetching thread:', threadId);

    // Since your schema doesn't store messages in the threads table,
    // we need to get them from OpenAI directly
    try {
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      // Get messages from OpenAI
      const messages = await openai.beta.threads.messages.list(threadId);
      
      // Convert OpenAI messages to our format
      const formattedMessages = messages.data
        .reverse() // OpenAI returns newest first, we want oldest first
        .map(msg => ({
          role: msg.role,
          content: msg.content[0]?.type === 'text' 
            ? cleanSearchArtifactsFromContent(msg.content[0].text.value)
            : JSON.stringify(msg.content),
          timestamp: new Date(msg.created_at * 1000).toLocaleString()
        }));

      console.log(`Thread fetched successfully with ${formattedMessages.length} cleaned messages`);

      return NextResponse.json({
        threadId: threadId,
        messages: formattedMessages
      });

    } catch (openaiError) {
      console.error('OpenAI error:', openaiError);
      
      // Fallback: check if thread exists in database
      const { data: thread, error } = await supabase
        .from('threads')
        .select('*')
        .eq('id', threadId)
        .single();

      if (error) {
        console.error('Supabase error:', error);
        return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
      }

      // Return empty messages if can't get from OpenAI
      return NextResponse.json({
        threadId: threadId,
        messages: []
      });
    }

  } catch (error: any) {
    console.error('Thread fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { id, projectId, title, messages } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Thread ID is required' }, { status: 400 });
    }

    console.log('Saving thread:', id);

    // Calculate message count
    const messageCount = Array.isArray(messages) ? messages.length : 0;

    // Update your database with the fields that actually exist
    const { data, error } = await supabase
      .from('threads')
      .upsert({
        id,
        project_id: projectId,
        title: title || 'Untitled Chat',
        last_activity: new Date().toISOString(),
        message_count: messageCount
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase upsert error:', error);
      return NextResponse.json({ error: 'Failed to save thread' }, { status: 500 });
    }

    console.log('Thread saved successfully');

    return NextResponse.json({
      id: data.id,
      title: data.title,
      success: true
    });

  } catch (error: any) {
    console.error('Thread save error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}