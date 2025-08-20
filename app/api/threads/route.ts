// app/api/threads/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Enhanced cleanup function that handles OpenAI's annotation format
function safeCleanWithPlaceholders(text: string): string {
  if (typeof text !== 'string') return text;
  
  // Step 1: Replace all file references with placeholders
  const fileLinksMap = new Map();
  let placeholderCounter = 0;
  let working = text;
  
  // Extended patterns to catch all file reference formats
  const patterns = [
    /\[([^\]]+)\]\(\/api\/files\/([a-zA-Z0-9-_]+)\)/g,     // Markdown links
    /\/api\/files\/[a-zA-Z0-9-_]+/g,                         // Plain URLs
    /"\/api\/files\/[a-zA-Z0-9-_]+"/g,                       // Quoted URLs
    /sandbox:\/\/[^\/]+\/[^\s\)]+/g,                         // OpenAI sandbox URLs
    /\[([^\]]+)\]\(sandbox:\/\/[^\)]+\)/g,                   // Markdown sandbox links
    /file-[a-zA-Z0-9]{24,}/g,                                // OpenAI file IDs
  ];
  
  patterns.forEach(pattern => {
    working = working.replace(pattern, (match) => {
      const placeholder = `__FILE_PLACEHOLDER_${placeholderCounter++}__`;
      fileLinksMap.set(placeholder, match);
      return placeholder;
    });
  });
  
  // Step 2: Clean everything else aggressively
  working = working.replace(/\[INTERNAL SEARCH CONTEXT[^\]]*\]:[^]*?\[END SEARCH CONTEXT\]/gi, '');
  working = working.replace(/\[Current Web Information[^\]]*\]:\s*/gi, '');
  working = working.replace(/Web Summary:\s*[^\n]*\n/gi, '');
  working = working.replace(/Top Search Results:\s*\n[\s\S]*?Instructions:[^\n]*\n/gi, '');
  working = working.replace(/\d+\.\s+\[PDF\]\s+[^\n]*\n\s*[^\n]*\.\.\.\s*Source:\s*https?:\/\/[^\s]+\s*/gi, '');
  working = working.replace(/\d+\.\s+[^.]+\.\.\.\s*Source:\s*https?:\/\/[^\s]+\s*/gi, '');
  working = working.replace(/Instructions: Please incorporate[^\n]*\n?/gi, '');
  working = working.replace(/IMPORTANT:\s*Please provide[^\n]*\n?/gi, '');
  working = working.replace(/\[Note: Web search was requested[^\]]*\]/gi, '');
  working = working.replace(/Search performed on:\s*[^\n]*\n/gi, '');
  working = working.replace(/Query:\s*"[^"]*"\s*/gi, '');
  working = working.replace(/^\s*---\s*$/gm, '');
  working = working.replace(/\n{3,}/g, '\n\n');
  working = working.trim();
  
  // Step 3: Restore all file references
  fileLinksMap.forEach((original, placeholder) => {
    working = working.replace(placeholder, original);
  });
  
  return working;
}

// Helper to process OpenAI message content and handle annotations
function processOpenAIContent(content: any[]): string {
  let processedText = '';
  
  for (const item of content) {
    if (item.type === 'text') {
      let text = item.text?.value || '';
      
      // Check for annotations (file references)
      if (item.text?.annotations && Array.isArray(item.text.annotations)) {
        for (const annotation of item.text.annotations) {
          if (annotation.type === 'file_path' && annotation.file_path?.file_id) {
            const fileId = annotation.file_path.file_id;
            const sandboxUrl = annotation.text;
            const downloadUrl = `/api/files/${fileId}`;
            text = text.replace(sandboxUrl, downloadUrl);
          }
        }
      }
      
      processedText += text;
    } else if (item.type === 'image_file' && item.image_file?.file_id) {
      const fileId = item.image_file.file_id;
      processedText += `\n[Image: /api/files/${fileId}]\n`;
    }
  }
  
  return processedText;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get('threadId');

    if (!threadId) {
      return NextResponse.json({ error: 'Thread ID is required' }, { status: 400 });
    }

    try {
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      // Get messages from OpenAI
      const messages = await openai.beta.threads.messages.list(threadId);
      
      // Convert OpenAI messages to our format with proper file handling
      const formattedMessages = messages.data
        .reverse() // OpenAI returns newest first, we want oldest first
        .map((msg: any) => {
          let content = '';
          
          // Handle different content types
          if (Array.isArray(msg.content)) {
            content = processOpenAIContent(msg.content);
          } else if (msg.content && typeof msg.content === 'object') {
            // Handle single content item or other structures
            content = JSON.stringify(msg.content);
          } else {
            // Fallback for any other format
            content = String(msg.content || '');
          }
          
          // Clean the content while preserving file links
          const cleanedContent = safeCleanWithPlaceholders(content);
          
          return {
            role: msg.role,
            content: cleanedContent,
            timestamp: new Date(msg.created_at * 1000).toLocaleString()
          };
        });

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