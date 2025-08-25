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
    // ADDED: Support for blob URLs
    /https:\/\/[a-zA-Z0-9]+\.public\.blob\.vercel-storage\.com\/[^\s\)]+/g,
    /\[([^\]]+)\]\(https:\/\/[a-zA-Z0-9]+\.public\.blob\.vercel-storage\.com\/[^\)]+\)/g,
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

// ENHANCED: Process OpenAI content with blob URL lookup
async function processOpenAIContentWithBlobSupport(content: any[], threadId: string): Promise<{text: string, files: any[]}> {
  let processedText = '';
  const files: any[] = [];
  const processedFileIds = new Set<string>();
  
  // First, get all blob file mappings for this thread in one query
  const { data: blobFiles } = await supabase
    .from('blob_files')
    .select('openai_file_id, vercel_blob_url, filename, content_type')
    .eq('thread_id', threadId);
  
  // Create a lookup map for quick access
  const blobLookup = new Map();
  if (blobFiles) {
    blobFiles.forEach(bf => {
      blobLookup.set(bf.openai_file_id, {
        blob_url: bf.vercel_blob_url,
        description: bf.filename,
        content_type: bf.content_type
      });
    });
  }
  
  for (const item of content) {
    if (item.type === 'text') {
      let text = item.text?.value || '';
      
      // Check for annotations (file references)
      if (item.text?.annotations && Array.isArray(item.text.annotations)) {
        for (const annotation of item.text.annotations) {
          if (annotation.type === 'file_path' && annotation.file_path?.file_id) {
            const fileId = annotation.file_path.file_id;
            const sandboxUrl = annotation.text;
            
            // ENHANCED: Check blob lookup first, fallback to API route
            const blobInfo = blobLookup.get(fileId);
            const actualDownloadUrl = blobInfo ? blobInfo.blob_url : `/api/files/${fileId}`;
            
            // Replace in text
            text = text.replace(sandboxUrl, actualDownloadUrl);
            
            // Add to files array if not already processed
            if (!processedFileIds.has(fileId)) {
              processedFileIds.add(fileId);
              
              // Get description from text or use filename
              const linkPattern = /\[([^\]]+)\]\([^)]+\)/;
              const textAround = text.substring(Math.max(0, text.indexOf(sandboxUrl) - 100), text.indexOf(sandboxUrl) + 100);
              const linkMatch = textAround.match(linkPattern);
              const description = linkMatch ? linkMatch[1] : (blobInfo ? blobInfo.description : 'Generated File');
              
              files.push({
                type: 'file',
                file_id: fileId,
                description: description,
                blob_url: blobInfo ? blobInfo.blob_url : undefined
              });
            }
          }
        }
      }
      
      processedText += text;
    } else if (item.type === 'image_file' && item.image_file?.file_id) {
      const fileId = item.image_file.file_id;
      
      // Check for blob URL for images too
      const blobInfo = blobLookup.get(fileId);
      const imageUrl = blobInfo ? blobInfo.blob_url : `/api/files/${fileId}`;
      
      processedText += `\n[Image: ${imageUrl}]\n`;
      
      if (!processedFileIds.has(fileId)) {
        processedFileIds.add(fileId);
        files.push({
          type: 'image',
          file_id: fileId,
          description: 'Generated Image',
          blob_url: blobInfo ? blobInfo.blob_url : undefined
        });
      }
    }
  }
  
  return { text: processedText, files };
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
      
      // ENHANCED: Convert OpenAI messages to our format with blob URL support
      const formattedMessages = await Promise.all(
        messages.data
          .reverse() // OpenAI returns newest first, we want oldest first
          .map(async (msg: any) => {
            let content = '';
            let messageFiles: any[] = [];
            
            // Handle different content types
            if (Array.isArray(msg.content)) {
              const result = await processOpenAIContentWithBlobSupport(msg.content, threadId);
              content = result.text;
              messageFiles = result.files;
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
              files: messageFiles.length > 0 ? messageFiles : undefined, // ADDED: Include files array
              timestamp: new Date(msg.created_at * 1000).toLocaleString()
            };
          })
      );

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