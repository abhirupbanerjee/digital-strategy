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

// Helper function to parse JSON response from assistant
function parseAssistantJsonResponse(responseText: string): any {
  try {
    // First try to parse directly
    const parsed = JSON.parse(responseText);
    return parsed;
  } catch (error) {
    // If direct parsing fails, try to extract JSON from markdown code blocks
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch (e) {
        console.error('Failed to parse JSON from code block:', e);
      }
    }
    
    // If still failing, try to find JSON-like content
    const jsonStart = responseText.indexOf('{');
    const jsonEnd = responseText.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      try {
        return JSON.parse(responseText.substring(jsonStart, jsonEnd + 1));
      } catch (e) {
        console.error('Failed to parse extracted JSON:', e);
      }
    }
    
    // If all parsing fails, return the original text wrapped in a standard format
    return {
      content: responseText,
      type: "text",
      metadata: {
        parsing_failed: true,
        original_content: responseText
      }
    };
  }
}

// Helper function to clean response from search artifacts
function cleanResponseFromSearchArtifacts(response: string): string {
  let cleaned = response;
  
  // Remove search context markers
  cleaned = cleaned.replace(/\[Current Web Information[^\]]*\]:\s*/gi, '');
  cleaned = cleaned.replace(/Web Summary:\s*[^\n]*\n/gi, '');
  cleaned = cleaned.replace(/Top Search Results:\s*\n[\s\S]*?Instructions:[^\n]*\n/gi, '');
  cleaned = cleaned.replace(/Instructions: Please incorporate this current web information[^\n]*\n?/gi, '');
  cleaned = cleaned.replace(/\[Note: Web search was requested[^\]]*\]/gi, '');
  
  // Clean up any leftover formatting
  cleaned = cleaned.replace(/^\s*\n+/, ''); // Remove leading newlines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n'); // Collapse multiple newlines
  
  return cleaned.trim();
}

export async function POST(request: NextRequest) {
  try {
    const { message, originalMessage, threadId, webSearchEnabled, fileIds, shareToken, useJsonFormat } = await request.json();

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
    let webSearchPerformed = false;
    
    if (webSearchEnabled && TAVILY_API_KEY) {
      try {
        console.log('Performing Tavily search for:', originalMessage || message);
        
        const searchResponse = await axios.post(
          'https://api.tavily.com/search',
          {
            api_key: TAVILY_API_KEY,
            query: originalMessage || message, // Use original message for search
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
          webSearchPerformed = true;
          
          enhancedMessage = `${message}\n\n[INTERNAL SEARCH CONTEXT - DO NOT INCLUDE IN RESPONSE]:\n`;
          
          if (data.answer) {
            enhancedMessage += `\nWeb Summary: ${data.answer}\n`;
          }
          
          if (data.results && data.results.length > 0) {
            enhancedMessage += '\nCurrent Web Information:\n';
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
          
          enhancedMessage += '\n[END SEARCH CONTEXT]\n\n';
          
          // Add JSON formatting instruction if requested
          if (useJsonFormat) {
            enhancedMessage += 'IMPORTANT: Please provide a natural response incorporating relevant information from the search results above. Cite sources naturally when using specific information, but do not mention the search context formatting. Focus on being helpful and accurate. Format your response as a valid JSON object with the following structure:\n\n{\n  "content": "Your main response content here",\n  "sources": ["source1", "source2"],\n  "type": "response_with_search",\n  "metadata": {\n    "search_performed": true,\n    "sources_count": number_of_sources\n  }\n}\n\nDO NOT include any text outside this JSON structure.';
          } else {
            enhancedMessage += 'IMPORTANT: Please provide a natural response incorporating relevant information from the search results above. Cite sources naturally when using specific information, but do not mention the search context formatting. Focus on being helpful and accurate.';
          }
          
          console.log('Web search enhanced message created');
        }
      } catch (searchError: any) {
        console.error('Tavily search failed:', searchError.response?.data || searchError.message);
        enhancedMessage = `${message}\n\n[Note: Web search was requested but encountered an error. Responding based on available knowledge.]`;
        
        if (useJsonFormat) {
          enhancedMessage += '\n\nPlease format your response as a valid JSON object with the following structure:\n\n{\n  "content": "Your response content here",\n  "type": "response_without_search",\n  "metadata": {\n    "search_performed": false,\n    "search_error": true\n  }\n}\n\nDO NOT include any text outside this JSON structure.';
        }
      }
    } else if (useJsonFormat) {
      // Add JSON formatting instruction even without search
      enhancedMessage = `${message}\n\nPlease format your response as a valid JSON object with the following structure:\n\n{\n  "content": "Your response content here",\n  "type": "standard_response",\n  "metadata": {\n    "search_performed": false\n  }\n}\n\nDO NOT include any text outside this JSON structure.`;
    }
    
    // Prepare message with attachments - use ORIGINAL message for thread storage
    interface MessageForThread {
      role: string;
      content: any;
      attachments?: Array<{
        file_id: string;
        tools: Array<{ type: string }>;
      }>;
    }

    const messageForThread: MessageForThread = {
      role: 'user',
      content: originalMessage || message // Store original, clean message in thread
    };

    if (fileIds && fileIds.length > 0) {
      messageForThread.attachments = fileIds.map((fileId: string) => ({
        file_id: fileId,
        tools: [{ type: "file_search" }]
      }));
    }

    // Add ORIGINAL message to thread (not enhanced)
    console.log('Adding original message to thread...');
    try {
      await axios.post(
        `https://api.openai.com/v1/threads/${currentThreadId}/messages`,
        messageForThread,
        { headers }
      );
      console.log('Original message added to thread');
    } catch (error: any) {
      console.error('Failed to add message:', error.response?.data || error.message);
      return NextResponse.json(
        { error: 'Failed to add message to thread' },
        { status: 500 }
      );
    }

    // Now add the ENHANCED message for AI processing (this won't be stored permanently)
    if (webSearchPerformed || useJsonFormat) {
      console.log('Adding enhanced context for AI processing...');
      try {
        await axios.post(
          `https://api.openai.com/v1/threads/${currentThreadId}/messages`,
          {
            role: 'user',
            content: enhancedMessage
          },
          { headers }
        );
        console.log('Enhanced context added for AI processing');
      } catch (error: any) {
        console.error('Failed to add enhanced message:', error.response?.data || error.message);
        // Continue anyway - we have the original message stored
      }
    }

    // Configure run
    const runConfig: any = {
      assistant_id: ASSISTANT_ID,
    };

    // Add JSON format if requested
    if (useJsonFormat) {
      runConfig.response_format = { type: "json_object" };
    }

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
      runConfig.additional_instructions = "You have access to current web search results. Use this information to provide accurate, up-to-date responses. When citing information from search results, reference sources naturally without exposing internal search formatting.";
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
    let parsedResponse = null;
    
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
          
          // Clean up search artifacts from the response
          reply = cleanResponseFromSearchArtifacts(reply);
          
          // If JSON format was requested, try to parse the response
          if (useJsonFormat) {
            parsedResponse = parseAssistantJsonResponse(reply);
            console.log('Parsed JSON response:', parsedResponse);
          }
        }
        
        console.log('Reply extracted and cleaned successfully');
      } catch (error: any) {
        console.error('Failed to fetch messages:', error.response?.data || error.message);
        reply = 'Failed to fetch response.';
      }
    } else if (status === 'failed') {
      reply = 'The assistant run failed. Please try again.';
    } else if (retries >= maxRetries) {
      reply = 'The assistant is taking too long to respond. Please try again.';
    }

    // Prepare response object
    const responseObj: any = {
      reply,
      threadId: currentThreadId,
      status: 'success',
      webSearchPerformed,
      useJsonFormat: !!useJsonFormat
    };

    // Add parsed response if JSON format was used
    if (useJsonFormat && parsedResponse) {
      responseObj.parsedResponse = parsedResponse;
    }

    // Append search sources if available (in a clean format)
    if (webSearchEnabled && searchSources.length > 0) {
      if (useJsonFormat && parsedResponse && !parsedResponse.parsing_failed) {
        // If we have a valid JSON response, sources are already included
        responseObj.searchSources = searchSources;
      } else {
        // For non-JSON responses, append sources in markdown format
        reply += '\n\n---\n**Sources:**\n';
        searchSources.forEach((source, index) => {
          reply += `${index + 1}. [${source.title}](${source.url})`;
          if (source.score) {
            reply += ` (${(source.score * 100).toFixed(0)}% relevance)`;
          }
          reply += '\n';
        });
        responseObj.reply = reply;
        responseObj.searchSources = searchSources;
      }
    }

    return NextResponse.json(responseObj);

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