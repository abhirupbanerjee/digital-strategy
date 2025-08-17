// app/api/cleanup-threads/route.ts
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

export async function POST(request: NextRequest) {
  try {
    console.log('Starting cleanup of all threads...');

    // Fetch all threads from database
    const { data: threads, error: fetchError } = await supabase
      .from('threads')
      .select('*');

    if (fetchError) {
      console.error('Error fetching threads:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch threads' }, { status: 500 });
    }

    let cleanedCount = 0;
    let processedCount = 0;

    // Process each thread
    for (const thread of threads || []) {
      try {
        processedCount++;
        let needsUpdate = false;
        
        // Clean messages if they exist
        let cleanedMessages = thread.messages || [];
        if (Array.isArray(cleanedMessages)) {
          const originalMessagesJson = JSON.stringify(cleanedMessages);
          
          cleanedMessages = cleanedMessages.map((msg: any) => {
            if (typeof msg.content === 'string') {
              const originalContent = msg.content;
              const cleanedContent = cleanSearchArtifactsFromContent(msg.content);
              
              if (originalContent !== cleanedContent) {
                needsUpdate = true;
                return { ...msg, content: cleanedContent };
              }
            }
            return msg;
          });
          
          // Update thread if changes were made
          if (needsUpdate) {
            const { error: updateError } = await supabase
              .from('threads')
              .update({
                messages: cleanedMessages,
                updated_at: new Date().toISOString()
              })
              .eq('id', thread.id);

            if (updateError) {
              console.error(`Error updating thread ${thread.id}:`, updateError);
            } else {
              cleanedCount++;
              console.log(`Cleaned thread ${thread.id}`);
            }
          }
        }
      } catch (threadError) {
        console.error(`Error processing thread ${thread.id}:`, threadError);
      }
    }

    console.log(`Cleanup completed: ${cleanedCount} threads cleaned out of ${processedCount} processed`);

    return NextResponse.json({
      success: true,
      processed: processedCount,
      cleaned: cleanedCount,
      message: `Successfully cleaned ${cleanedCount} threads out of ${processedCount} total threads.`
    });

  } catch (error: any) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: 'Internal server error during cleanup' },
      { status: 500 }
    );
  }
}