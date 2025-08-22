// app/api/shared/thread/[token]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const params = await context.params;
    const { token } = params;

    if (!token) {
      return NextResponse.json({ error: 'Share token is required' }, { status: 400 });
    }

    // Get share data with thread info
    const { data: share, error: shareError } = await supabase
      .from('thread_shares')
      .select(`
        *,
        threads!inner(
          id,
          title,
          last_activity,
          message_count,
          project_id,
          projects(id, name, description, color)
        )
      `)
      .eq('share_token', token)
      .single();

    if (shareError || !share) {
      return NextResponse.json(
        { error: 'Share link not found' },
        { status: 404 }
      );
    }

    // Check if expired
    const now = new Date();
    const expiresAt = new Date(share.expires_at);
    
    if (expiresAt < now) {
      return NextResponse.json(
        { error: 'Share link has expired' },
        { status: 410 }
      );
    }

    // Get thread messages from OpenAI
    let messages: { role: string; content: string; timestamp: string }[] = [];
    try {
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const openaiMessages = await openai.beta.threads.messages.list(share.thread_id);
      
      // Process messages similar to existing thread API
      messages = openaiMessages.data
        .reverse()
        .map((msg: any) => {
          let content = '';
          
          if (Array.isArray(msg.content)) {
            content = msg.content
              .map((item: any) => {
                if (item.type === 'text') {
                  let text = item.text?.value || '';
                  
                  // Handle file annotations
                  if (item.text?.annotations) {
                    for (const annotation of item.text.annotations) {
                      if (annotation.type === 'file_path' && annotation.file_path?.file_id) {
                        const fileId = annotation.file_path.file_id;
                        const downloadUrl = `/api/files/${fileId}`;
                        text = text.replace(annotation.text, downloadUrl);
                      }
                    }
                  }
                  
                  return text;
                } else if (item.type === 'image_file' && item.image_file?.file_id) {
                  return `\n[Image: /api/files/${item.image_file.file_id}]\n`;
                }
                return '';
              })
              .join('');
          }
          
          return {
            role: msg.role,
            content: content,
            timestamp: new Date(msg.created_at * 1000).toLocaleString()
          };
        });
      
    } catch (openaiError) {
      console.error('OpenAI error loading shared thread:', openaiError);
      // Fallback: return empty messages if OpenAI fails
      messages = [];
    }

    // Return structured data for shared thread
    return NextResponse.json({
      thread: {
        id: share.thread_id,
        title: share.threads?.title || 'Shared Conversation',
        messages: messages,
        project: share.threads?.projects || null
      },
      share: {
        permissions: share.permissions,
        expires_at: share.expires_at,
        created_at: share.created_at
      }
    });

  } catch (error) {
    console.error('Shared thread access error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}