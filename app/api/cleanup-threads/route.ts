// app/api/cleanup-threads/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Safe cleanup function using placeholders to guarantee file link preservation
function safeCleanWithPlaceholders(text: string): string {
  if (typeof text !== 'string') return text;
  
  console.log('=== CLEANUP DEBUG START ===');
  console.log('Original text length:', text.length);
  
  // Step 1: Replace all file links with unique placeholders
  const fileLinksMap = new Map();
  let placeholderCounter = 0;
  let working = text;
  
  // Find and replace all variations of file links
  const patterns = [
    /\[([^\]]+)\]\(\/api\/files\/([a-zA-Z0-9-_]+)\)/g,  // Markdown links like [Download](...)
    /\/api\/files\/[a-zA-Z0-9-_]+/g,                      // Plain URLs
    /"\/api\/files\/[a-zA-Z0-9-_]+"/g,                    // Quoted URLs
  ];
  
  patterns.forEach(pattern => {
    working = working.replace(pattern, (match) => {
      const placeholder = `__FILE_PLACEHOLDER_${placeholderCounter++}__`;
      fileLinksMap.set(placeholder, match);
      console.log(`Preserving file link: ${match}`);
      return placeholder;
    });
  });
  
  console.log(`Protected ${fileLinksMap.size} file links with placeholders`);
  
  // Step 2: Clean everything else aggressively
  // Remove search context blocks
  working = working.replace(/\[INTERNAL SEARCH CONTEXT[^\]]*\]:[^]*?\[END SEARCH CONTEXT\]/gi, '');
  
  // Remove old-style search markers
  working = working.replace(/\[Current Web Information[^\]]*\]:\s*/gi, '');
  working = working.replace(/Web Summary:\s*[^\n]*\n/gi, '');
  working = working.replace(/Top Search Results:\s*\n[\s\S]*?Instructions:[^\n]*\n/gi, '');
  
  // Remove search results (now safe because file links are placeholders)
  working = working.replace(/\d+\.\s+\[PDF\]\s+[^\n]*\n\s*[^\n]*\.\.\.\s*Source:\s*https?:\/\/[^\s]+\s*/gi, '');
  working = working.replace(/\d+\.\s+[^.]+\.\.\.\s*Source:\s*https?:\/\/[^\s]+\s*/gi, '');
  
  // Remove instructions and metadata
  working = working.replace(/Instructions: Please incorporate[^\n]*\n?/gi, '');
  working = working.replace(/IMPORTANT:\s*Please provide[^\n]*\n?/gi, '');
  working = working.replace(/\[Note: Web search was requested[^\]]*\]/gi, '');
  working = working.replace(/Search performed on:\s*[^\n]*\n/gi, '');
  working = working.replace(/Query:\s*"[^"]*"\s*/gi, '');
  
  // Clean up formatting
  working = working.replace(/^\s*---\s*$/gm, '');
  working = working.replace(/\n{3,}/g, '\n\n');
  working = working.trim();
  
  // Step 3: Restore all file links
  fileLinksMap.forEach((original, placeholder) => {
    working = working.replace(placeholder, original);
  });
  
  console.log('=== CLEANUP DEBUG END ===');
  console.log(`Cleaned text length: ${working.length}`);
  console.log(`Removed ${text.length - working.length} characters`);
  console.log(`All ${fileLinksMap.size} file links restored`);
  
  // Final verification
  const finalFileCount = (working.match(/\/api\/files\/[a-zA-Z0-9-_]+/g) || []).length;
  const originalFileCount = (text.match(/\/api\/files\/[a-zA-Z0-9-_]+/g) || []).length;
  
  if (finalFileCount !== originalFileCount) {
    console.error(`WARNING: File link count mismatch! Original: ${originalFileCount}, Final: ${finalFileCount}`);
    console.error('Reverting to original text to preserve file links');
    return text;
  }
  
  return working;
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
    let filesPreservedCount = 0;

    // Process each thread
    for (const thread of threads || []) {
      try {
        processedCount++;
        let needsUpdate = false;
        let threadFileLinks = 0;
        
        // Clean messages if they exist
        let cleanedMessages = thread.messages || [];
        if (Array.isArray(cleanedMessages)) {
          const originalMessagesJson = JSON.stringify(cleanedMessages);
          
          // Count original file links in this thread
          const originalFileLinks = (originalMessagesJson.match(/\/api\/files\/[a-zA-Z0-9-_]+/g) || []);
          threadFileLinks = originalFileLinks.length;
          
          if (threadFileLinks > 0) {
            console.log(`Thread ${thread.id} has ${threadFileLinks} file links to preserve`);
          }
          
          cleanedMessages = cleanedMessages.map((msg: any) => {
            if (typeof msg.content === 'string') {
              const originalContent = msg.content;
              const cleanedContent = safeCleanWithPlaceholders(msg.content);
              
              if (originalContent !== cleanedContent) {
                needsUpdate = true;
                return { ...msg, content: cleanedContent };
              }
            }
            return msg;
          });
          
          // Verify file links are preserved after cleaning
          if (threadFileLinks > 0) {
            const cleanedJson = JSON.stringify(cleanedMessages);
            const cleanedFileLinks = (cleanedJson.match(/\/api\/files\/[a-zA-Z0-9-_]+/g) || []);
            
            if (cleanedFileLinks.length !== threadFileLinks) {
              console.error(`ERROR: Thread ${thread.id} lost file links! Original: ${threadFileLinks}, After: ${cleanedFileLinks.length}`);
              console.error('Skipping this thread to preserve file links');
              continue; // Skip this thread
            } else {
              console.log(`SUCCESS: Thread ${thread.id} preserved all ${threadFileLinks} file links`);
              filesPreservedCount += threadFileLinks;
            }
          }
          
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

    console.log('=== CLEANUP SUMMARY ===');
    console.log(`Processed: ${processedCount} threads`);
    console.log(`Cleaned: ${cleanedCount} threads`);
    console.log(`File links preserved: ${filesPreservedCount}`);

    return NextResponse.json({
      success: true,
      processed: processedCount,
      cleaned: cleanedCount,
      filesPreserved: filesPreservedCount,
      message: `Successfully cleaned ${cleanedCount} threads out of ${processedCount} total threads. ${filesPreservedCount} file links preserved.`
    });

  } catch (error: any) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: 'Internal server error during cleanup' },
      { status: 500 }
    );
  }
}