// Enhanced app/api/sync-threads/route.ts with smart title generation

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Initialize clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Smart title generation function (server-side version)
function generateSmartThreadTitle(messages: any[]): string {
  if (!messages || messages.length === 0) {
    return "New Chat";
  }

  // Get first three substantial user messages (skip greetings like "Hi")
  const userMessages = messages
    .filter(msg => 
      msg.role === "user" && 
      typeof msg.content === 'string' && 
      msg.content.trim().length > 5 &&
      !msg.content.trim().toLowerCase().match(/^(hi|hello|hey|good morning|good afternoon|good evening|thanks|thank you)$/i)
    )
    .slice(0, 3);

  if (userMessages.length === 0) {
    return "New Chat";
  }

  // Combine content from up to 3 messages to get better context
  let content = userMessages
    .map(msg => msg.content.trim())
    .join(' ');
  
  // Clean up the content
  content = content.replace(/\n+/g, ' '); // Replace newlines with spaces
  content = content.replace(/\s+/g, ' '); // Normalize whitespace
  
  // Remove common question words and phrases at the start for cleaner titles
  content = content.replace(/^(what|how|why|when|where|who|which|can you|could you|please|help me|i need|i want|tell me|explain|show me)\s+/i, '');
  
  // Remove question marks and exclamation points from the end
  content = content.replace(/[?!]+$/, '');
  
  // Capitalize first letter
  content = content.charAt(0).toUpperCase() + content.slice(1);
  
  // Truncate to reasonable length and add ellipsis if needed
  if (content.length > 50) {
    // Try to cut at a word boundary
    const truncated = content.substring(0, 47);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 20) {
      content = truncated.substring(0, lastSpace) + '...';
    } else {
      content = truncated + '...';
    }
  }
  
  // Fallback if content becomes too short after processing
  if (content.length < 3) {
    return `Chat - ${new Date().toLocaleDateString()}`;
  }
  
  return content;
}

// Contextual title generation based on conversation topic
function generateContextualTitle(messages: any[]): string {
  if (!messages || messages.length === 0) {
    return "New Chat";
  }

  // Get all user messages for context
  const userMessages = messages
    .filter(msg => msg.role === "user" && typeof msg.content === 'string')
    .map(msg => msg.content.toLowerCase());

  if (userMessages.length === 0) {
    return "New Chat";
  }

  // Define topic keywords and their corresponding titles
  const topicPatterns = [
    {
      keywords: ['strategy', 'strategic', 'planning', 'roadmap', 'vision'],
      title: 'Strategic Planning Discussion'
    },
    {
      keywords: ['digital', 'transformation', 'digitalization', 'modernization'],
      title: 'Digital Transformation'
    },
    {
      keywords: ['api', 'apis', 'integration', 'endpoint', 'rest', 'graphql'],
      title: 'API Development'
    },
    {
      keywords: ['database', 'sql', 'query', 'schema', 'migration'],
      title: 'Database Design'
    },
    {
      keywords: ['security', 'authentication', 'authorization', 'encryption', 'cybersecurity'],
      title: 'Security Discussion'
    },
    {
      keywords: ['ui', 'ux', 'design', 'interface', 'user experience', 'frontend'],
      title: 'UI/UX Design'
    },
    {
      keywords: ['performance', 'optimization', 'speed', 'efficiency', 'scalability'],
      title: 'Performance Optimization'
    },
    {
      keywords: ['testing', 'qa', 'quality assurance', 'unit test', 'integration test'],
      title: 'Testing & QA'
    },
    {
      keywords: ['deployment', 'devops', 'ci/cd', 'pipeline', 'infrastructure'],
      title: 'DevOps & Deployment'
    },
    {
      keywords: ['government', 'policy', 'regulation', 'compliance', 'public sector'],
      title: 'Government Policy Discussion'
    },
    {
      keywords: ['caribbean', 'regional', 'island', 'tourism', 'development'],
      title: 'Caribbean Development'
    },
    {
      keywords: ['budget', 'cost', 'pricing', 'financial', 'economics'],
      title: 'Budget Planning'
    },
    {
      keywords: ['project', 'management', 'timeline', 'milestone', 'deadline'],
      title: 'Project Management'
    },
    {
      keywords: ['research', 'analysis', 'study', 'investigation', 'report'],
      title: 'Research & Analysis'
    }
  ];

  // Check for topic patterns
  const allText = userMessages.join(' ');
  for (const pattern of topicPatterns) {
    const matchCount = pattern.keywords.reduce((count, keyword) => {
      return count + (allText.includes(keyword) ? 1 : 0);
    }, 0);
    
    if (matchCount >= 1) {
      return pattern.title;
    }
  }

  // Fall back to first message processing
  return generateSmartThreadTitle(messages);
}

export async function POST(request: NextRequest) {
  try {
    const { projectId, threadIds, generateSmartTitles = true } = await request.json();
    
    if (!projectId || !threadIds || !Array.isArray(threadIds)) {
      return NextResponse.json(
        { error: 'Invalid request: projectId and threadIds array required' },
        { status: 400 }
      );
    }
    
    console.log('Syncing threads for project:', projectId);
    console.log('Thread IDs to sync:', threadIds);
    console.log('Generate smart titles:', generateSmartTitles);
    
    const syncResults = [];
    let smartTitlesGenerated = 0;
    
    for (const threadId of threadIds) {
      try {
        console.log(`Syncing thread: ${threadId}`);
        
        // 1. Check if thread already exists in Supabase
        const { data: existingThread } = await supabase
          .from('threads')
          .select('*')
          .eq('id', threadId)
          .maybeSingle();
        
        if (existingThread) {
          console.log(`Thread ${threadId} already exists in database`);
          
          // Update existing thread with smart title if enabled and current title is generic
          if (generateSmartTitles && 
              (existingThread.title === 'Untitled' || 
               existingThread.title === 'New Chat' || 
               existingThread.title.startsWith('Chat -'))) {
            
            try {
              // Fetch messages to generate smart title
              const messages = await openai.beta.threads.messages.list(threadId);
              const formattedMessages = messages.data
                .reverse()
                .map(msg => ({
                  role: msg.role,
                  content: msg.content[0]?.type === 'text' 
                    ? msg.content[0].text.value 
                    : JSON.stringify(msg.content),
                  timestamp: new Date(msg.created_at * 1000).toLocaleString()
                }));
              
              const smartTitle = generateContextualTitle(formattedMessages);
              
              if (smartTitle !== existingThread.title) {
                const { error: updateError } = await supabase
                  .from('threads')
                  .update({ title: smartTitle })
                  .eq('id', threadId);
                
                if (!updateError) {
                  smartTitlesGenerated++;
                  console.log(`Updated existing thread ${threadId} with smart title: "${smartTitle}"`);
                  syncResults.push({ 
                    threadId, 
                    status: 'title_updated', 
                    title: smartTitle 
                  });
                  continue;
                }
              }
            } catch (titleError) {
              console.error(`Failed to update title for existing thread ${threadId}:`, titleError);
            }
          }
          
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
          .reverse()
          .map(msg => ({
            role: msg.role,
            content: msg.content[0]?.type === 'text' 
              ? msg.content[0].text.value 
              : JSON.stringify(msg.content),
            timestamp: new Date(msg.created_at * 1000).toLocaleString()
          }));
        
        // 5. Generate smart title from messages
        let title = 'Untitled';
        if (generateSmartTitles && formattedMessages.length > 0) {
          title = generateContextualTitle(formattedMessages);
          smartTitlesGenerated++;
          console.log(`Generated smart title for ${threadId}: "${title}"`);
        } else {
          // Fallback to first user message processing
          const firstUserMessage = formattedMessages.find(m => m.role === 'user');
          title = firstUserMessage 
            ? firstUserMessage.content.substring(0, 50).trim() || 'Untitled'
            : 'Untitled';
        }
        
        // 6. Save to Supabase
        const threadData = {
          id: threadId,
          project_id: projectId,
          title: title,
          last_activity: new Date().toISOString(),
          message_count: formattedMessages.length
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
          console.log(`Successfully synced thread ${threadId} with title: "${title}"`);
          syncResults.push({ 
            threadId, 
            status: 'synced', 
            messageCount: formattedMessages.length,
            title: title
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
      titleUpdated: syncResults.filter(r => r.status === 'title_updated').length,
      smartTitlesGenerated: smartTitlesGenerated,
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