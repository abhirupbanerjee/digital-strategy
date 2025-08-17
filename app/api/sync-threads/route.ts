// app/api/sync-threads/route.ts
// Simplified version that matches your working API patterns

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Initialize clients the same way as your working API routes
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // Match your working API routes
);

export async function POST(request: NextRequest) {
  try {
    const { projectId, threadIds } = await request.json();
    
    if (!projectId || !threadIds || !Array.isArray(threadIds)) {
      return NextResponse.json(
        { error: 'Invalid request: projectId and threadIds array required' },
        { status: 400 }
      );
    }
    
    console.log('Syncing threads for project:', projectId);
    console.log('Thread IDs to sync:', threadIds);
    
    const syncResults = [];
    
    for (const threadId of threadIds) {
      try {
        console.log(`Syncing thread: ${threadId}`);
        
        // 1. Check if thread already exists in Supabase
        const { data: existingThread } = await supabase
          .from('threads')
          .select('*')
          .eq('id', threadId)
          .maybeSingle(); // Use maybeSingle() instead of single() to avoid errors
        
        if (existingThread) {
          console.log(`Thread ${threadId} already exists in database`);
          syncResults.push({ threadId, status: 'already_exists' });
          continue;
        }
        
        // 2. Fetch thread from OpenAI
        const thread = await openai.beta.threads.retrieve(threadId);
        console.log(`Retrieved OpenAI thread: ${threadId}`);
        
        // 3. Fetch messages from OpenAI
        const messages = await openai.beta.threads.messages.list(threadId);
        console.log(`Found ${messages.data.length} messages for thread ${threadId}`);
        
        // 4. Convert OpenAI messages to our format
        const formattedMessages = messages.data
          .reverse() // OpenAI returns newest first, we want oldest first
          .map(msg => ({
            role: msg.role,
            content: msg.content[0]?.type === 'text' 
              ? msg.content[0].text.value 
              : JSON.stringify(msg.content),
            timestamp: new Date(msg.created_at * 1000).toLocaleString()
          }));
        
        // 5. Generate thread title from first user message
        const firstUserMessage = formattedMessages.find(m => m.role === 'user');
        const title = firstUserMessage 
          ? firstUserMessage.content.substring(0, 50).trim() || 'Untitled'
          : 'Untitled';
        
        // 6. Save to Supabase using the same structure as your working API
        const threadData = {
          id: threadId,
          project_id: projectId,
          title: title,
          messages: formattedMessages,
          updated_at: new Date().toISOString()
        };

        const { error: insertError } = await supabase
          .from('threads')
          .insert(threadData);
        
        if (insertError) {
          console.error(`Failed to save thread ${threadId}:`, insertError);
          syncResults.push({ 
            threadId, 
            status: 'error', 
            error: insertError.message 
          });
        } else {
          console.log(`Successfully synced thread ${threadId}`);
          syncResults.push({ 
            threadId, 
            status: 'synced', 
            messageCount: formattedMessages.length,
            title 
          });
        }
        
      } catch (error: any) {
        console.error(`Error syncing thread ${threadId}:`, error);
        syncResults.push({ 
          threadId, 
          status: 'error', 
          error: error.message 
        });
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      syncResults,
      totalThreads: threadIds.length,
      synced: syncResults.filter(r => r.status === 'synced').length,
      errors: syncResults.filter(r => r.status === 'error').length
    });
    
  } catch (error: any) {
    console.error('Sync threads error:', error);
    return NextResponse.json(
      { error: 'Failed to sync threads', details: error.message },
      { status: 500 }
    );
  }
}