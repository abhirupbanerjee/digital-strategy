// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_ORGANIZATION = process.env.OPENAI_ORGANIZATION;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Helper function to extract text from OpenAI response (consistent with threads API)
function extractTextFromOpenAIResponse(assistantMsg: any): string {
  try {
    if (!assistantMsg?.content) {
      return 'No response received.';
    }

    // Handle array of content items (most common format)
    if (Array.isArray(assistantMsg.content)) {
      const textParts: string[] = [];
      
      for (const contentItem of assistantMsg.content) {
        if (contentItem.type === 'text') {
          // Handle nested text structure
          if (contentItem.text && typeof contentItem.text === 'object' && contentItem.text.value) {
            textParts.push(contentItem.text.value);
          } else if (typeof contentItem.text === 'string') {
            textParts.push(contentItem.text);
          }
        } else if (contentItem.type === 'image_file') {
          textParts.push('[Image file generated]');
        } else if (contentItem.type === 'image_url') {
          textParts.push('[Image URL generated]');
        } else {
          // Handle other content types (code interpreter results, etc.)
          if (contentItem.text && typeof contentItem.text === 'string') {
            textParts.push(contentItem.text);
          } else if (typeof contentItem === 'string') {
            textParts.push(contentItem);
          }
        }
      }
      
      return textParts.length > 0 ? textParts.join('\n\n') : 'No response received.';
    }
    
    // Handle direct string content
    if (typeof assistantMsg.content === 'string') {
      return assistantMsg.content;
    }
    
    // Handle object with text property
    if (typeof assistantMsg.content === 'object' && assistantMsg.content.text) {
      if (typeof assistantMsg.content.text === 'string') {
        return assistantMsg.content.text;
      }
      if (assistantMsg.content.text.value) {
        return assistantMsg.content.text.value;
      }
    }
    
    // Fallback
    console.warn('Unexpected assistant response structure:', assistantMsg.content);
    return 'Response received but could not be processed properly.';
    
  } catch (error) {
    console.error('Error extracting text from assistant response:', error);
    return 'Error processing assistant response.';
  }
}

export async function POST(request: NextRequest) {
  try {
    const { message, threadId, webSearchEnabled, fileIds, shareToken } = await request.json();

    // Validate share token if provided
    if (shareToken) {
      const { data: share, error: shareError } = await supabase
        .from('project_shares')
        .select('permissions, expires_at, project_id')
        .eq('share_token', shareToken)
        .single();

      if (shareError || !share) {
        return NextResponse.json(
          { error: 'Invalid share token' },
          { status: 403 }
        );
      }

      if (new Date(share.expires_at) < new Date()) {
        return NextResponse.json(
          { error: 'Share link has expired' },
          { status: 410 }
        );
      }

      if (share.permissions !== 'collaborate') {
        return NextResponse.json(
          { error: 'This share link is read-only' },
          { status: 403 }
        );
      }
    }

    // Environment check
    console.log('Environment check:', {
      hasAssistantId: !!ASSISTANT_ID,
      hasApiKey: !!OPENAI_API_KEY,
      hasOrganization: !!OPENAI_ORGANIZATION
    });

    if (!ASSISTANT_ID || !OPENAI_API_KEY) {
      console.error('Missing OpenAI configuration');
      return NextResponse.json(
        { error: 'Missing OpenAI configuration' },
        { status: 500 }
      );
    }

    if (!message || message.trim() === '') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v2',
    };

    if (OPENAI_ORGANIZATION) {
      headers['OpenAI-Organization'] = OPENAI_ORGANIZATION;
    }

    let currentThreadId = threadId;

    // Create thread if needed
    if (!currentThreadId) {
      console.log('Creating new thread...');
      try {
        const threadRes = await axios.post(
          'https://api.openai.com/v1/threads',
          {},
          { headers }
        );
        currentThreadId = threadRes.data.id;
        console.log('Thread created:', currentThreadId);
      } catch (error: any) {
        console.error('Thread creation failed:', error.response?.data || error.message);
        return NextResponse.json(
          { error: 'Failed to create thread' },
          { status: 500 }
        );
      }
    }

    // Web search enhancement
    let enhancedMessage = message;
    let searchSources: any[] = [];
    
    if (webSearchEnabled && TAVILY_API_KEY) {
      try {
        console.log('Performing Tavily search for:', message);
        
        const searchResponse = await axios.post(
          'https://api.tavily.com/search',
          {
            api_key: TAVILY_API_KEY,
            query: message,
            search_depth: 'basic',
            include_answer: true,
            max_results: 5,
          },
          {
            headers: {
              'Content-Type': 'application/json',
            }
          }
        );
        
        if (searchResponse.data) {
          const data = searchResponse.data;
          
          enhancedMessage = `${message}\n\n[Current Web Information - ${new Date().toLocaleString()}]:\n`;
          
          if (data.answer) {
            enhancedMessage += `\nWeb Summary: ${data.answer}\n`;
          }
          
          if (data.results && data.results.length > 0) {
            enhancedMessage += '\nTop Search Results:\n';
            data.results.forEach((result: any, idx: number) => {
              enhancedMessage += `${idx + 1}. ${result.title}\n`;
              enhancedMessage += `   ${result.content.substring(0, 200)}...\n`;
              enhancedMessage += `   Source: ${result.url}\n\n`;
              
              searchSources.push({
                title: result.title,
                url: result.url,
                score: result.score
              });
            });
          }
          
          enhancedMessage += '\nInstructions: Please incorporate this current web information in your response and cite sources when appropriate.';
          console.log('Web search enhanced message created');
        }
      } catch (searchError: any) {
        console.error('Tavily search failed:', searchError.response?.data || searchError.message);
        enhancedMessage = `${message}\n\n[Note: Web search was requested but encountered an error. Responding based on available knowledge.]`;
      }
    }
    
    // Prepare message with attachments
    const messagePayload: any = {
      role: 'user',
      content: enhancedMessage
    };

    if (fileIds && fileIds.length > 0) {
      messagePayload.attachments = fileIds.map((fileId: string) => ({
        file_id: fileId,
        tools: [{ type: "file_search" }]
      }));
    }

    // Add message to thread
    console.log('Adding message to thread...');
    try {
      await axios.post(
        `https://api.openai.com/v1/threads/${currentThreadId}/messages`,
        messagePayload,
        { headers }
      );
      console.log('Message added to thread');
    } catch (error: any) {
      console.error('Failed to add message:', error.response?.data || error.message);
      return NextResponse.json(
        { error: 'Failed to add message to thread' },
        { status: 500 }
      );
    }

    // Configure run
    const runConfig: any = {
      assistant_id: ASSISTANT_ID,
    };

    // Add tools configuration based on features enabled
    const tools = [];
    
    // Always include code_interpreter for general functionality
    tools.push({ type: "code_interpreter" });
    
    // Add file_search if files are uploaded or for better search integration
    if ((fileIds && fileIds.length > 0) || webSearchEnabled) {
      tools.push({ type: "file_search" });
    }

    // Add tools to run configuration if any are needed
    if (tools.length > 0) {
      runConfig.tools = tools;
    }

    // Add any additional instructions for web search context
    if (webSearchEnabled && searchSources.length > 0) {
      runConfig.additional_instructions = "Current web search results have been provided in the message. Please cite sources when using this information. The search was performed to get the most up-to-date information.";
    }

    // Create run
    console.log('Creating run with config:', { ...runConfig, tools });
    let runId;
    try {
      const runRes = await axios.post(
        `https://api.openai.com/v1/threads/${currentThreadId}/runs`,
        runConfig,
        { headers }
      );
      runId = runRes.data.id;
      console.log('Run created:', runId);
    } catch (error: any) {
      console.error('Run creation failed:', error.response?.data || error.message);
      return NextResponse.json(
        { error: 'Failed to create run' },
        { status: 500 }
      );
    }

    // Poll for completion
    let status = 'in_progress';
    let retries = 0;
    const maxRetries = 60;

    while ((status === 'in_progress' || status === 'queued') && retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        const statusRes = await axios.get(
          `https://api.openai.com/v1/threads/${currentThreadId}/runs/${runId}`,
          { headers }
        );
        
        status = statusRes.data.status;
        console.log(`Run status: ${status} (attempt ${retries + 1})`);
        
        // Handle required actions (like tool calls)
        if (status === 'requires_action') {
          const requiredAction = statusRes.data.required_action;
          if (requiredAction?.type === 'submit_tool_outputs') {
            console.log('Tool outputs required:', requiredAction);
            // Tool output handling can be implemented here if needed
          }
        }
        
        if (status === 'failed') {
          console.error('Run failed:', statusRes.data);
          break;
        }
        
        if (status === 'completed') {
          break;
        }
      } catch (error: any) {
        console.error('Status check failed:', error.response?.data || error.message);
        break;
      }
      
      retries++;
    }

    let reply = 'No response received.';
    
    if (status === 'completed') {
      console.log('Run completed, fetching messages...');
      try {
        const messagesRes = await axios.get(
          `https://api.openai.com/v1/threads/${currentThreadId}/messages`,
          { headers }
        );
        
        const assistantMsg = messagesRes.data.data.find((m: any) => m.role === 'assistant');
        
        // Process the assistant's response using our extraction function
        if (assistantMsg?.content) {
          reply = extractTextFromOpenAIResponse(assistantMsg);
          
          // Clean up any remaining citation markers or artifacts
          reply = reply.replace(/【\d+:\d+†[^】]+】/g, '');
          reply = reply.replace(/\[sandbox:.*?\]/g, '');
        }
        
        // Append search sources if available
        if (webSearchEnabled && searchSources.length > 0) {
          reply += '\n\n---\n📌 **Web Sources Used:**\n';
          searchSources.forEach((source, index) => {
            reply += `${index + 1}. [${source.title}](${source.url})`;
            if (source.score) {
              reply += ` (${(source.score * 100).toFixed(0)}% relevant)`;
            }
            reply += '\n';
          });
        }
        
        console.log('Reply extracted successfully');
      } catch (error: any) {
        console.error('Failed to fetch messages:', error.response?.data || error.message);
        reply = 'Failed to fetch response.';
      }
    } else if (status === 'failed') {
      reply = 'The assistant run failed. Please try again.';
    } else if (retries >= maxRetries) {
      reply = 'The assistant is taking too long to respond. Please try again.';
    }

    return NextResponse.json({
      reply,
      threadId: currentThreadId,
      status: 'success'
    });

  } catch (error: any) {
    console.error('API Error:', error.response?.data || error.message);
    
    let errorMessage = 'Unable to reach assistant.';
    
    if (error.response?.data?.error?.message) {
      errorMessage = error.response.data.error.message;
    } else if (error.response?.status === 401) {
      errorMessage = 'Invalid API key.';
    } else if (error.response?.status === 404) {
      errorMessage = 'Assistant not found.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}