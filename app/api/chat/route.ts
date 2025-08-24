// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { put } from '@vercel/blob';

const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_ORGANIZATION = process.env.OPENAI_ORGANIZATION;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Replace existing console.log statements with:
const DEBUG = process.env.NODE_ENV === 'development' && process.env.DEBUG_CHAT === 'true';

// Helper function to upload OpenAI file to Vercel Blob
async function uploadFileToVercelBlob(fileId: string, description: string): Promise<{
  blobUrl: string;
  fileKey: string;
  fileSize: number;
  contentType: string;
  actualFilename: string;
} | null> {
  try {
    if (DEBUG) {
      console.log(`Uploading file ${fileId} to Vercel Blob...`);
    }
    
    // First get file metadata from OpenAI
    const metadataResponse = await fetch(`https://api.openai.com/v1/files/${fileId}`, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Organization': OPENAI_ORGANIZATION || '',
      },
    });
    
    let actualFilename = description + '.docx'; // Default fallback
    let contentType = 'application/octet-stream';
    
    if (metadataResponse.ok) {
      const metadata = await metadataResponse.json();
      if (metadata.filename) {
        // Extract just the filename from the full path
        actualFilename = metadata.filename.split('/').pop() || metadata.filename;
        contentType = getContentTypeFromFilename(actualFilename);
        if (DEBUG) {
          console.log(`OpenAI metadata - Original: ${metadata.filename}, Extracted: ${actualFilename}`);
        }
      }
    } else {
      if (DEBUG) {
        console.log(`Failed to get metadata for ${fileId}, using fallback filename: ${actualFilename}`);
      }
    }
    
    // Download file content from OpenAI
    const fileResponse = await fetch(`https://api.openai.com/v1/files/${fileId}/content`, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Organization': OPENAI_ORGANIZATION || '',
      },
    });
    
    if (!fileResponse.ok) {
      if (DEBUG) {
        console.error(`Failed to download file ${fileId} from OpenAI`);
      }
      return null;
    }
    
    const fileBuffer = await fileResponse.arrayBuffer();
    const fileSize = fileBuffer.byteLength;
    
    // Generate unique filename for blob storage but preserve extension
    const timestamp = Date.now();
    const fileKey = `generated/${timestamp}-${actualFilename}`;
    
    // Upload to Vercel Blob
    const blob = await put(fileKey, fileBuffer, {
      access: 'public',
      contentType: contentType,
      token: process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
    });
    
    if (DEBUG) {
      console.log(`File ${fileId} uploaded to Vercel Blob: ${blob.url}`);
    }

    return {
      blobUrl: blob.url,
      fileKey: fileKey,
      fileSize: fileSize,
      contentType: contentType,
      actualFilename: actualFilename
    };
    
  } catch (error) {
    if (DEBUG) {
      console.error(`Error uploading file ${fileId} to Vercel Blob:`, error);
    }
    return null;
  }
}

// Helper function to store file mapping in Supabase
async function storeFileMappingInSupabase(
  openaiFileId: string,
  blobUrl: string,
  fileKey: string,
  filename: string,
  contentType: string,
  fileSize: number,
  threadId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('blob_files')
      .insert({
        openai_file_id: openaiFileId,
        vercel_blob_url: blobUrl,
        vercel_file_key: fileKey,
        filename: filename,
        content_type: contentType,
        file_size: fileSize,
        thread_id: threadId,
        created_at: new Date().toISOString(),
        accessed_at: new Date().toISOString()
      });
    
    if (error) {
      if (DEBUG) {
        console.error('Error storing file mapping in Supabase:', error);
      }
      return false;
    }
    
    // Update storage metrics
    await updateStorageMetrics(fileSize);
    if (DEBUG) {
      console.log(`File mapping stored for ${openaiFileId}`);
    }
    return true;
    
  } catch (error) {
    if (DEBUG) {
    console.error('Error in storeFileMappingInSupabase:', error);
    }
    return false;
  }
}

// Helper function to update storage metrics
async function updateStorageMetrics(addedSize: number): Promise<void> {
  try {
    // Get current metrics
    const { data: currentMetrics } = await supabase
      .from('storage_metrics')
      .select('total_size_bytes, file_count')
      .single();
    
    const newTotalSize = (currentMetrics?.total_size_bytes || 0) + addedSize;
    const newFileCount = (currentMetrics?.file_count || 0) + 1;
    
    // Update or insert metrics
    const { error } = await supabase
      .from('storage_metrics')
      .upsert({
        id: '00000000-0000-0000-0000-000000000000', // Fixed UUID for singleton row
        total_size_bytes: newTotalSize,
        file_count: newFileCount,
        updated_at: new Date().toISOString()
      });
    
    if (error) {
      if (DEBUG) {
      console.error('Error updating storage metrics:', error);
      }
    }
    
    // Check if cleanup is needed (400MB threshold)
    const CLEANUP_THRESHOLD = 400 * 1024 * 1024; // 400MB
    if (newTotalSize > CLEANUP_THRESHOLD) {
      if (DEBUG) {
        console.log(`Storage threshold exceeded (${newTotalSize} bytes), triggering cleanup...`);
      }  
      // Trigger cleanup (will be implemented in storage endpoints)
      await triggerStorageCleanup();
    }
    
  } catch (error) {
    if (DEBUG) {
    console.error('Error in updateStorageMetrics:', error);
    }
  }
}

// Helper function to trigger storage cleanup
async function triggerStorageCleanup(): Promise<void> {
  try {
    // Call cleanup endpoint (will be created in next step)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    await fetch(`${baseUrl}/api/vercel-storage/cleanup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    if (DEBUG) {
    console.error('Error triggering storage cleanup:', error);
    }
  }
}

// Helper function to get content type from filename
function getContentTypeFromFilename(filename: string): string {
  const extension = filename.toLowerCase().split('.').pop();
  
  const contentTypes: { [key: string]: string } = {
    'pdf': 'application/pdf',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'doc': 'application/msword',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'xls': 'application/vnd.ms-excel',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'ppt': 'application/vnd.ms-powerpoint',
    'txt': 'text/plain',
    'csv': 'text/csv',
    'json': 'application/json',
    'xml': 'application/xml',
    'html': 'text/html',
    'md': 'text/markdown',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'webp': 'image/webp',
  };
  
  return extension ? contentTypes[extension] || 'application/octet-stream' : 'application/octet-stream';
}

// Enhanced extractTextFromOpenAI response with Vercel Blob integration
// Enhanced extractTextFromOpenAI response with Vercel Blob integration
async function extractTextFromOpenAIResponse(
  assistantMsg: any, 
  threadId: string
): Promise<{ type: string; content: string; files?: any[] }> {
  const files: any[] = [];
  const processedFileIds = new Set<string>(); // Track processed files to avoid duplicates
  let textParts: string[] = [];

  try {
    if (!assistantMsg?.content) {
      return { type: 'text', content: 'No response received.' };
    }

    // First, extract files from attachments (most reliable)
    if (assistantMsg.attachments && Array.isArray(assistantMsg.attachments)) {
      for (const attachment of assistantMsg.attachments) {
        if (attachment.file_id && !processedFileIds.has(attachment.file_id)) {
          processedFileIds.add(attachment.file_id);
          
          // CRITICAL: Upload to Vercel Blob immediately
          const blobResult = await uploadFileToVercelBlob(
            attachment.file_id, 
            'Generated File'
          );
          
          if (blobResult) {
            // Store mapping in Supabase
            await storeFileMappingInSupabase(
              attachment.file_id,
              blobResult.blobUrl,
              blobResult.fileKey,
              blobResult.actualFilename, // Use actual filename instead of description
              blobResult.contentType,
              blobResult.fileSize,
              threadId
            );
            
            files.push({
              type: 'file',
              file_id: attachment.file_id,
              description: 'Generated File',
              blob_url: blobResult.blobUrl // Add blob URL for immediate use
            });
          } else {
            // Fallback to original OpenAI file
            files.push({
              type: 'file',
              file_id: attachment.file_id,
              description: 'Generated File'
            });
          }
        }
      }
    }

    if (Array.isArray(assistantMsg.content)) {
      for (const contentItem of assistantMsg.content) {
        if (contentItem.type === 'text') {
          let textContent = '';
          if (contentItem.text && typeof contentItem.text === 'object' && contentItem.text.value) {
            textContent = contentItem.text.value;
          } else if (typeof contentItem.text === 'string') {
            textContent = contentItem.text;
          }
          
          // Extract file info from annotations and replace sandbox links
          if (contentItem.text && contentItem.text.annotations) {
            for (const annotation of contentItem.text.annotations) {
              if (annotation.type === 'file_path' && annotation.file_path?.file_id) {
                const fileId = annotation.file_path.file_id;
                
                // Skip if we've already processed this file
                if (processedFileIds.has(fileId)) {
                  const existingFileIndex = files.findIndex(f => f.file_id === fileId);
                  if (existingFileIndex >= 0) {
                    // Update description if we have a better one
                    const linkPattern = /\[([^\]]+)\]\([^)]+\)/;
                    const linkMatch = textContent.substring(annotation.start_index - 100, annotation.end_index + 20).match(linkPattern);
                    const description = linkMatch ? linkMatch[1] : files[existingFileIndex].description;
                    files[existingFileIndex].description = description;
                  }
                  
                  // FIXED: Use blob URL from existing file if available, fallback to API route
                  const sandboxUrl = annotation.text;
                  const existingFile = files.find(f => f.file_id === fileId);
                  const actualDownloadUrl = existingFile?.blob_url || `/api/files/${fileId}`;
                  textContent = textContent.replace(sandboxUrl, actualDownloadUrl);
                  continue;
                }
                
                processedFileIds.add(fileId);
                
                // Get description from the text around the annotation
                const linkPattern = /\[([^\]]+)\]\([^)]+\)/;
                const linkMatch = textContent.substring(annotation.start_index - 100, annotation.end_index + 20).match(linkPattern);
                const description = linkMatch ? linkMatch[1] : 'Generated File';
                
                // CRITICAL: Upload to Vercel Blob immediately
                const blobResult = await uploadFileToVercelBlob(
                  fileId, 
                  description
                );
                
                if (blobResult) {
                  // Store mapping in Supabase
                  await storeFileMappingInSupabase(
                    fileId,
                    blobResult.blobUrl,
                    blobResult.fileKey,
                    blobResult.actualFilename, // Use actual filename
                    blobResult.contentType,
                    blobResult.fileSize,
                    threadId
                  );
                  
                  files.push({
                    type: 'file',
                    file_id: fileId,
                    description: description,
                    blob_url: blobResult.blobUrl
                  });
                } else {
                  // Fallback to original OpenAI file
                  files.push({
                    type: 'file',
                    file_id: fileId,
                    description: description
                  });
                }

                // FIXED: Replace sandbox link with blob URL if available, fallback to API route
                const sandboxUrl = annotation.text;
                const actualDownloadUrl = blobResult ? blobResult.blobUrl : `/api/files/${fileId}`;
                textContent = textContent.replace(sandboxUrl, actualDownloadUrl);
              }
            }
          }
          
          textParts.push(textContent);
        } else if (contentItem.type === 'image_file') {
          // Handle image files similarly
          const imageFileId = contentItem.image_file?.file_id;
          if (imageFileId && !processedFileIds.has(imageFileId)) {
            processedFileIds.add(imageFileId);
            
            const blobResult = await uploadFileToVercelBlob(imageFileId, 'Generated Image');
            
            if (blobResult) {
              await storeFileMappingInSupabase(
                imageFileId,
                blobResult.blobUrl,
                blobResult.fileKey,
                blobResult.actualFilename, // Use actual filename
                blobResult.contentType,
                blobResult.fileSize,
                threadId
              );
              
              files.push({
                type: 'image',
                file_id: imageFileId,
                description: 'Generated Image',
                blob_url: blobResult.blobUrl
              });
            } else {
              files.push({
                type: 'image',
                file_id: imageFileId,
                description: 'Generated Image'
              });
            }
          }
        } else if (contentItem.type === 'image_url') {
          files.push({
            type: 'image_url',
            url: contentItem.image_url?.url,
            description: 'Generated Image'
          });
        }
      }
      
      return {
        type: files.length > 0 ? 'mixed' : 'text',
        content: textParts.length > 0 ? textParts.join('\n\n') : 'Response generated',
        files: files.length > 0 ? files : undefined
      };
    }
    
    // Handle other formats as before
    if (typeof assistantMsg.content === 'string') {
      return { type: 'text', content: assistantMsg.content };
    }
    
    return { type: 'text', content: 'Response received but could not be processed properly.' };
    
  } catch (error) {
    console.error('Error extracting text from assistant response:', error);
    return { type: 'text', content: 'Error processing assistant response.' };
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
      const { data: share } = await supabase
        .from('thread_shares')
        .select('permissions, expires_at, thread_id')
        .eq('share_token', shareToken)
        .single();
        
      if (!share || new Date(share.expires_at) < new Date()) {
        return NextResponse.json({ error: 'Invalid or expired share' }, { status: 403 });
      }
      
      if (share.permissions !== 'collaborate') {
        return NextResponse.json({ error: 'Read-only access' }, { status: 403 });
      }

    }

    // Environment check
    if (DEBUG) {
    console.log('Environment check:', {
      hasAssistantId: !!ASSISTANT_ID,
      hasApiKey: !!OPENAI_API_KEY,
      hasOrganization: !!OPENAI_ORGANIZATION
    });
  }
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
      if (DEBUG) {
      console.log('Creating new thread...');
      }
      try {
        const threadRes = await axios.post(
          'https://api.openai.com/v1/threads',
          {},
          { headers }
        );
        currentThreadId = threadRes.data.id;
        if (DEBUG) {
        console.log('Thread created:', currentThreadId);
        }
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
        if (DEBUG) {
        console.log('Performing Tavily search for:', originalMessage || message);
        }
        
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
          
          if (DEBUG) {
          console.log('Web search enhanced message created');
          }
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
    
    // ========================================
    // FIXED: Single message with proper file attachment
    // ========================================
    
    // Prepare the SINGLE message for the thread with both content and files
    interface MessageForThread {
      role: string;
      content: any;
      attachments?: Array<{
        file_id: string;
        tools: Array<{ type: string }>;
      }>;
    }

    // Use enhanced message if web search was performed, otherwise use original
    const messageContent = webSearchPerformed || useJsonFormat ? enhancedMessage : (originalMessage || message);

    const messageForThread: MessageForThread = {
      role: 'user',
      content: messageContent
    };

    // Store file types from upload (you'll need to pass this from frontend)
      interface FileInfo {
        fileId: string;
        type: string;
      }

      // Determine which tool to use based on file type
      const getToolsForFile = (fileType: string) => {
        // File types that work with file_search
        const searchableTypes = ['.pdf', '.txt', '.md', '.docx', '.html', '.json'];
        
        // File types that need code_interpreter
        const codeTypes = ['.xlsx', '.xls', '.csv', '.py', '.js', '.ts'];
        
        // Check file extension
        const extension = fileType.toLowerCase();
        
        if (codeTypes.some(ext => extension.includes(ext))) {
          return [{ type: "code_interpreter" }];
        } else if (searchableTypes.some(ext => extension.includes(ext))) {
          return [{ type: "file_search" }];
        } else {
          // Default to code_interpreter for unknown types
          return [{ type: "code_interpreter" }];
        }
      };

      // CRITICAL: Attach files with appropriate tools based on file type
      if (fileIds && fileIds.length > 0) {
        messageForThread.attachments = fileIds.map((fileId: string) => ({
          file_id: fileId,
          tools: [{ type: "code_interpreter" }]  // Use code_interpreter for Excel/CSV files
        }));
      if (DEBUG) {
      console.log('Files attached to message:', fileIds);
      }
    }

    // Add the SINGLE message to thread (with both content and files)
    if (DEBUG) {
    console.log('Adding message to thread with files and enhanced content...');
    }
    try {
      await axios.post(
        `https://api.openai.com/v1/threads/${currentThreadId}/messages`,
        messageForThread,
        { headers }
      );
      if (DEBUG) {
      console.log('Message added to thread successfully');
      }
    } catch (error: any) {
      console.error('Failed to add message:', error.response?.data || error.message);
      
      // Extract detailed error information
      const errorData = error.response?.data?.error || {};
      let errorMessage = 'Failed to add message to thread';
      
      // Check for file-specific errors
      if (errorData.code === 'unsupported_file') {
        errorMessage = `File type error: ${errorData.message}. Using code_interpreter instead of file_search.`;
        console.log('Switching to code_interpreter for unsupported file types');
      } else if (errorData.message) {
        errorMessage = errorData.message;
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: error.response?.status || 500 }
      );
    }

    // ========================================
    // ENSURE file_search is ALWAYS enabled when files are present
    // ========================================
    
    // Configure run - UPDATED
    const runConfig: any = {
      assistant_id: ASSISTANT_ID,
    };

    // Add JSON format if requested
    if (useJsonFormat) {
      runConfig.response_format = { type: "json_object" };
    }

    // Configure tools based on file types and features
    const tools = [];

    // Always include code_interpreter for general functionality and Excel/CSV files
    tools.push({ type: "code_interpreter" });

    // Only include file_search for web search or searchable document types
    // Don't include it for Excel files as it causes errors
    if (webSearchEnabled && (!fileIds || fileIds.length === 0)) {
      // Only add file_search if we're doing web search without files
      tools.push({ type: "file_search" });
      if (DEBUG) {
        console.log('file_search tool enabled for web search');
      }
    }

    // Note: We're NOT adding file_search when files are present
    // because Excel files (.xlsx, .xls, .csv) don't support it
    if (DEBUG && fileIds && fileIds.length > 0) {
      console.log('Using code_interpreter for file processing (Excel/CSV compatible)');
    }

    // Add tools to run configuration
    runConfig.tools = tools;

    // Enhanced instructions for file processing
    if (fileIds && fileIds.length > 0) {
      let instructions = "You have access to uploaded files. Please analyze the file content carefully and provide specific, detailed responses based on the actual content.";
      
      if (webSearchEnabled && searchSources.length > 0) {
        instructions += " You also have access to current web search results. Combine information from both the uploaded files and web search when relevant.";
      }
      
      runConfig.additional_instructions = instructions;
    } else if (webSearchEnabled && searchSources.length > 0) {
      runConfig.additional_instructions = "You have access to current web search results. Use this information to provide accurate, up-to-date responses. When citing information from search results, reference sources naturally without exposing internal search formatting.";
    }

    // Create run
    if (DEBUG) {
    console.log('Creating run with config:', { ...runConfig, tools });
    }
    let runId;
    try {
      const runRes = await axios.post(
        `https://api.openai.com/v1/threads/${currentThreadId}/runs`,
        runConfig,
        { headers }
      );
      runId = runRes.data.id;
      if (DEBUG) {
      console.log('Run created:', runId);
      }
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
    const maxRetries = 60;  // 60 seconds max wait time

    while ((status === 'in_progress' || status === 'queued') && retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        const statusRes = await axios.get(
          `https://api.openai.com/v1/threads/${currentThreadId}/runs/${runId}`,
          { headers }
        );
        
        status = statusRes.data.status;
        if (DEBUG) {
        console.log(`Run status: ${status} (attempt ${retries + 1})`);
        }
        
        // Handle required actions (like tool calls)
        if (status === 'requires_action') {
          const requiredAction = statusRes.data.required_action;
          if (requiredAction?.type === 'submit_tool_outputs') {
            if (DEBUG) {
            console.log('Tool outputs required:', requiredAction);
            }
            // Tool output handling can be implemented here if needed
          }
        }
        
        if (status === 'failed') {
          if (DEBUG) {
          console.error('Run failed:', statusRes.data);
          }
          break;
        }
        
        if (status === 'completed') {
          break;
        }
      } catch (error: any) {
        if (DEBUG) {
        console.error('Status check failed:', error.response?.data || error.message);
        }
        break;
      }
      
      retries++;
    }

    let reply = 'No response received.';
    let parsedResponse = null;
    let extractedResponse;

    if (status === 'completed') {
      if (DEBUG) {
      console.log('Run completed, fetching messages...');
      }
      try {
        const messagesRes = await axios.get(
          `https://api.openai.com/v1/threads/${currentThreadId}/messages`,
          { headers }
        );
        
        const assistantMsg = messagesRes.data.data.find((m: any) => m.role === 'assistant');

        
        // Process the assistant's response using our extraction function
        if (assistantMsg?.content) {
          // CRITICAL: Pass threadId for Vercel Blob integration
          extractedResponse = await extractTextFromOpenAIResponse(assistantMsg, currentThreadId);
          reply = extractedResponse.content;
          
          // Clean up any remaining citation markers or artifacts
          reply = reply.replace(/【\d+:\d+†[^】]+】/g, '');
          reply = reply.replace(/\[sandbox:.*?\]/g, '');
          
          // Clean up search artifacts from the response
          reply = cleanResponseFromSearchArtifacts(reply);
          
          // If JSON format was requested, try to parse the response
          if (useJsonFormat) {
            parsedResponse = parseAssistantJsonResponse(reply);
            if (DEBUG) {
            console.log('Parsed JSON response:', parsedResponse);
            }
          }
        } else {
          extractedResponse = { type: 'text', content: reply };
        }
        
        if (DEBUG) {
        console.log('Reply extracted and cleaned successfully');
        }
      } catch (error: any) {
        console.error('Failed to fetch messages:', error.response?.data || error.message);
        reply = 'Failed to fetch response.';
        extractedResponse = { type: 'text', content: reply };
      }
    } else if (status === 'failed') {
      reply = 'The assistant run failed. Please try again.';
      extractedResponse = { type: 'text', content: reply };
    } else if (retries >= maxRetries) {
      reply = 'The assistant is taking too long to respond. Please try again.';
      extractedResponse = { type: 'text', content: reply };
    }

    // Now build the response object with the correct extracted data
    const responseObj: any = {
      reply,
      files: extractedResponse?.files,
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
    if (DEBUG) {
    console.error('API Error:', error.response?.data || error.message);
    }
    
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