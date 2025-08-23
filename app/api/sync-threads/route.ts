// Enhanced app/api/sync-threads/route.ts with smart title generation

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Initialize clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DEBUG_SYNC = process.env.NODE_ENV === 'development' && process.env.DEBUG_SYNC === 'true';

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


  { keywords: ['Antigua and Barbuda', 'Antigua', 'Barbuda'], title: 'Antigua and Barbuda' },
  { keywords: ['Bahamas', 'The Bahamas', 'Commonwealth of The Bahamas'], title: 'Bahamas' },
  { keywords: ['Barbados'], title: 'Barbados' },
  { keywords: ['Belize'], title: 'Belize' },
  { keywords: ['Cuba', 'Republic of Cuba'], title: 'Cuba' },
  { keywords: ['Dominica', 'Commonwealth of Dominica'], title: 'Dominica' },
  { keywords: ['Dominican Republic', 'República Dominicana', 'Dominican Rep'], title: 'Dominican Republic' },
  { keywords: ['Grenada'], title: 'Grenada' },
  { keywords: ['Guyana', 'Co-operative Republic of Guyana'], title: 'Guyana' },
  { keywords: ['Haiti', "République d’Haïti", "Republique d'Haiti", 'Ayiti'], title: 'Haiti' },
  { keywords: ['Jamaica'], title: 'Jamaica' },
  { keywords: ['Saint Kitts and Nevis', 'St Kitts and Nevis', 'St Kitts', 'Nevis', 'SKN'], title: 'Saint Kitts and Nevis' },
  { keywords: ['Saint Lucia', 'St Lucia'], title: 'Saint Lucia' },
  { keywords: ['Saint Vincent and the Grenadines', 'St Vincent and the Grenadines', 'St Vincent', 'SVG'], title: 'Saint Vincent and the Grenadines' },
  { keywords: ['Suriname', 'Republic of Suriname'], title: 'Suriname' },
  { keywords: ['Trinidad and Tobago', 'Trinidad', 'Tobago', 'T&T', 'TT'], title: 'Trinidad and Tobago' },

  // Territories & dependencies commonly treated as part of the Caribbean region
  { keywords: ['Anguilla'], title: 'Anguilla' },
  { keywords: ['Aruba'], title: 'Aruba' },
  { keywords: ['Bermuda'], title: 'Bermuda' },
  { keywords: ['Bonaire'], title: 'Bonaire' },
  { keywords: ['British Virgin Islands', 'BVI'], title: 'British Virgin Islands' },
  { keywords: ['Cayman Islands', 'Cayman'], title: 'Cayman Islands' },
  { keywords: ['Curaçao', 'Curacao'], title: 'Curaçao' },
  { keywords: ['Guadeloupe'], title: 'Guadeloupe' },
  { keywords: ['Martinique'], title: 'Martinique' },
  { keywords: ['Montserrat'], title: 'Montserrat' },
  { keywords: ['Puerto Rico', 'PR'], title: 'Puerto Rico' },
  { keywords: ['Saba'], title: 'Saba' },
  { keywords: ['Saint Barthélemy', 'Saint Barthelemy', 'St Barts', 'St Barths'], title: 'Saint Barthélemy' },
  { keywords: ['Saint Martin', 'St Martin', 'Saint-Martin (French part)'], title: 'Saint Martin' },
  { keywords: ['Sint Eustatius', 'Statia'], title: 'Sint Eustatius' },
  { keywords: ['Sint Maarten', 'St Maarten'], title: 'Sint Maarten' },
  { keywords: ['Turks and Caicos Islands', 'Turks & Caicos', 'TCI'], title: 'Turks and Caicos Islands' },
  { keywords: ['United States Virgin Islands', 'U.S. Virgin Islands', 'USVI'], title: 'United States Virgin Islands' },
  
  //caribbean combined
  { keywords: ['caribbean', 'oecs', 'SIDS', 'west indies', 'caricom'],   title: 'Caribbean Region' },
  
    // Other samples for test cases
    { keywords: ['India', 'Republic of India', 'Bharat'],       title: 'India' },
      { keywords: ['Australia', 'Commonwealth of Australia', 'AUS'], title: 'Australia' },
  { keywords: ['Austria', 'Österreich', 'Republic of Austria'], title: 'Austria' },
  { keywords: ['Belgium', 'Kingdom of Belgium', 'Belgique', 'België', 'Belgie'], title: 'Belgium' },
  { keywords: ['Canada', 'CA'], title: 'Canada' },
  { keywords: ['Estonia', 'Republic of Estonia', 'Eesti'], title: 'Estonia' },
  { keywords: ['Finland', 'Republic of Finland', 'Suomi', 'FI'], title: 'Finland' },
  { keywords: ['France', 'French Republic', 'République française', 'FR'], title: 'France' },
  { keywords: ['Germany', 'Federal Republic of Germany', 'Deutschland', 'DE'], title: 'Germany' },
  { keywords: ['Ireland', 'Republic of Ireland', 'Éire', 'IE'], title: 'Ireland' },
  { keywords: ['Japan', 'Nippon', 'Nihon', 'JP'], title: 'Japan' },
  { keywords: ['Netherlands', 'The Netherlands', 'Kingdom of the Netherlands', 'Holland', 'NL'], title: 'Netherlands' },
  { keywords: ['New Zealand', 'Aotearoa', 'NZ'], title: 'New Zealand' },
  { keywords: ['Norway', 'Kingdom of Norway', 'NO'], title: 'Norway' },
  { keywords: ['Singapore', 'Republic of Singapore', 'SG'], title: 'Singapore' },
  { keywords: ['South Korea', 'Republic of Korea', 'ROK', 'Korea, South', 'KR'], title: 'South Korea' },
  { keywords: ['Spain', 'España', 'Kingdom of Spain', 'ES'], title: 'Spain' },
  { keywords: ['Sweden', 'Kingdom of Sweden', 'Sverige', 'SE'], title: 'Sweden' },
  { keywords: ['United Kingdom', 'UK', 'U.K.', 'Britain', 'Great Britain', 'GB', 'England', 'Scotland', 'Wales', 'Northern Ireland'], title: 'United Kingdom' },
  { keywords: ['United States', 'USA', 'U.S.A.', 'US', 'U.S.', 'United States of America', 'America'], title: 'United States' },


      // Digital Strategy
  { keywords: ['digital transformation strategy', 'digital', 'egovernment strategy', 'government digital strategy'], title: 'Digital Strategy' },


  // Keep this LAST — treat as a fallback in your matching logic
  { keywords: ['__ANY__'], title: 'General' }

  ];

  const allText = userMessages.join(' ').toLowerCase(); // Convert to lowercase once
  for (const pattern of topicPatterns) {
    const matchCount = pattern.keywords.reduce((count, keyword) => {
      return count + (allText.includes(keyword.toLowerCase()) ? 1 : 0);
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
    if (DEBUG_SYNC) {
      console.log('Syncing threads for project:', projectId);
      console.log('Thread IDs to sync:', threadIds);
      console.log('Generate smart titles:', generateSmartTitles);
    }
    
    const syncResults = [];
    let smartTitlesGenerated = 0;
    
    for (const threadId of threadIds) {
      try {
        if (DEBUG_SYNC) {
          console.log(`Syncing thread: ${threadId}`);
        }
        
        // 1. Check if thread already exists in Supabase
        const { data: existingThread } = await supabase
          .from('threads')
          .select('*')
          .eq('id', threadId)
          .maybeSingle();
        
        if (existingThread) {
          if (DEBUG_SYNC) {
            console.log(`Thread ${threadId} already exists in database`);
          }
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
                  if (DEBUG_SYNC) {
                    console.log(`Updated existing thread ${threadId} with smart title: "${smartTitle}"`);
                  }
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
        if (DEBUG_SYNC) {
          console.log(`Retrieved OpenAI thread: ${threadId}`);
        }
        // 3. Fetch messages from OpenAI
        const messages = await openai.beta.threads.messages.list(threadId);
        if (DEBUG_SYNC) {
          console.log(`Found ${messages.data.length} messages for thread ${threadId}`);
        }

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
          if (DEBUG_SYNC) {
            console.log(`Generated smart title for ${threadId}: "${title}"`);
          }
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
          if (DEBUG_SYNC) {
            console.log(`Successfully synced thread ${threadId} with title: "${title}"`);
          }
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