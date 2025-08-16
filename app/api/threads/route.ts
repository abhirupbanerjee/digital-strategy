// app/api/threads/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

function errorJson(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ error: { message, ...(details ? { details } : {}) } }, { status });
}

// Helper function to extract text content from OpenAI message structure
function extractTextFromOpenAIMessage(openAIMessage: any): string {
  try {
    if (!openAIMessage.content) {
      return '[No content available]';
    }

    // Handle array of content items (most common format)
    if (Array.isArray(openAIMessage.content)) {
      const textParts: string[] = [];
      
      for (const contentItem of openAIMessage.content) {
        if (contentItem.type === 'text') {
          // Handle nested text structure
          if (contentItem.text && typeof contentItem.text === 'object' && contentItem.text.value) {
            textParts.push(contentItem.text.value);
          } else if (typeof contentItem.text === 'string') {
            textParts.push(contentItem.text);
          }
        } else if (contentItem.type === 'image_file') {
          textParts.push('[Image file attached]');
        } else if (contentItem.type === 'image_url') {
          textParts.push('[Image URL attached]');
        } else {
          // Handle other content types (code interpreter results, etc.)
          if (contentItem.text && typeof contentItem.text === 'string') {
            textParts.push(contentItem.text);
          } else if (typeof contentItem === 'string') {
            textParts.push(contentItem);
          }
        }
      }
      
      return textParts.length > 0 ? textParts.join('\n\n') : '[Content could not be processed]';
    }
    
    // Handle direct string content
    if (typeof openAIMessage.content === 'string') {
      return openAIMessage.content;
    }
    
    // Handle object with text property
    if (typeof openAIMessage.content === 'object' && openAIMessage.content.text) {
      if (typeof openAIMessage.content.text === 'string') {
        return openAIMessage.content.text;
      }
      if (openAIMessage.content.text.value) {
        return openAIMessage.content.text.value;
      }
    }
    
    // Fallback: try to stringify and extract meaningful content
    const contentStr = JSON.stringify(openAIMessage.content);
    console.warn('Unexpected content structure:', contentStr);
    return '[Complex content - please check console for details]';
    
  } catch (error) {
    console.error('Error extracting text from OpenAI message:', error);
    return '[Error processing message content]';
  }
}

// Helper function to process OpenAI messages into frontend format
function processOpenAIMessages(openAIMessages: any[]): any[] {
  return openAIMessages.map(msg => {
    try {
      return {
        id: msg.id,
        role: msg.role,
        content: extractTextFromOpenAIMessage(msg),
        timestamp: msg.created_at ? new Date(msg.created_at * 1000).toLocaleString() : undefined,
        // Preserve any file attachments info if present
        fileIds: msg.attachments?.map((att: any) => att.file_id) || undefined
      };
    } catch (error) {
      console.error('Error processing OpenAI message:', msg.id, error);
      return {
        id: msg.id || 'unknown',
        role: msg.role || 'assistant',
        content: '[Error processing this message]',
        timestamp: new Date().toLocaleString()
      };
    }
  });
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
    const rawMessages = Array.isArray(json?.data) ? json.data : [];
    
    // 3) Process OpenAI messages to extract clean text content
    const processedMessages = processOpenAIMessages(rawMessages);
    
    // Log for debugging (remove in production)
    console.log(`Processed ${processedMessages.length} messages for thread ${threadId}`);
    
    return NextResponse.json({ 
      thread: threadData, 
      messages: processedMessages 
    }, { status: 200 });

  } catch (e) {
    console.error('Failed to load messages:', e);
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

  // Extract title from first user message if not provided
  let threadTitle = title?.trim() || 'New Chat';
  if ((!title || title.trim() === 'New Chat') && Array.isArray(messages) && messages.length > 0) {
    const firstUserMessage = messages.find((msg: any) => msg.role === 'user');
    if (firstUserMessage && firstUserMessage.content) {
      // Extract text from content (in case it's an object)
      let content = firstUserMessage.content;
      if (typeof content === 'object') {
        content = extractTextFromOpenAIMessage(firstUserMessage);
      }
      threadTitle = String(content).substring(0, 50).trim() || 'New Chat';
    }
  }

  const { data, error } = await supabase
    .from('threads')
    .upsert(
      {
        id,
        project_id: projectId,
        title: threadTitle,
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