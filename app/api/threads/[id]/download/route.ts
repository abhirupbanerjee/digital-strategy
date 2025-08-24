// app/api/threads/[id]/download/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import archiver from 'archiver';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Generate clean, professional HTML for the conversation
function generateConversationHTML(threadTitle: string, messages: any[], files: any[]): string {
  const messagesHTML = messages.map(msg => {
    const roleClass = msg.role === 'user' ? 'user-message' : 'assistant-message';
    const roleName = msg.role === 'user' ? 'You' : 'Digital Strategy Bot';
    
    return `
      <div class="message ${roleClass}">
        <div class="message-header">
          <div class="role-name">${roleName}</div>
          <div class="timestamp">${msg.timestamp || new Date().toLocaleString()}</div>
        </div>
        <div class="message-content">
          ${msg.content
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/### (.*?)(\n|$)/g, '<h3>$1</h3>')
            .replace(/## (.*?)(\n|$)/g, '<h2>$1</h2>')
            .replace(/# (.*?)(\n|$)/g, '<h1>$1</h1>')
          }
        </div>
      </div>
    `;
  }).join('');

  const filesHTML = files.length > 0 ? `
    <div class="files-section">
      <h2>📎 Referenced Files</h2>
      <div class="files-grid">
        ${files.map(file => `
          <div class="file-item">
            <div class="file-header">
              <span class="file-icon">${getFileIconForHTML(file.content_type)}</span>
              <span class="file-name">${file.filename}</span>
            </div>
            <div class="file-details">
              <span class="file-size">${(file.file_size / 1024 / 1024).toFixed(2)} MB</span>
              <span class="file-type">${file.content_type}</span>
            </div>
            <div class="file-location">
              📁 See annexures/${file.filename}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${threadTitle}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
          line-height: 1.6;
          color: #1f2937;
          background: #ffffff;
          max-width: 900px;
          margin: 0 auto;
          padding: 2rem;
        }
        
        .header {
          text-align: center;
          margin-bottom: 3rem;
          padding-bottom: 2rem;
          border-bottom: 3px solid #e5e7eb;
        }
        
        .header h1 {
          font-size: 2.5rem;
          font-weight: 700;
          color: #1e40af;
          margin-bottom: 1rem;
        }
        
        .header .subtitle {
          color: #6b7280;
          font-size: 1.1rem;
        }
        
        .conversation {
          margin-bottom: 3rem;
        }
        
        .message {
          margin-bottom: 2rem;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .user-message {
          background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
          border-left: 5px solid #6b7280;
        }
        
        .assistant-message {
          background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
          border-left: 5px solid #2563eb;
          border: 1px solid #e5e7eb;
        }
        
        .message-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem 0.5rem 1.5rem;
          background: rgba(255, 255, 255, 0.5);
        }
        
        .role-name {
          font-weight: 600;
          font-size: 1.1rem;
          color: #374151;
        }
        
        .timestamp {
          font-size: 0.875rem;
          color: #6b7280;
          font-family: 'SF Mono', 'Monaco', monospace;
        }
        
        .message-content {
          padding: 0.5rem 1.5rem 1.5rem 1.5rem;
          font-size: 1rem;
          line-height: 1.7;
        }
        
        .message-content h1, .message-content h2, .message-content h3 {
          margin: 1rem 0 0.5rem 0;
          color: #1e40af;
        }
        
        .message-content h1 { font-size: 1.5rem; }
        .message-content h2 { font-size: 1.3rem; }
        .message-content h3 { font-size: 1.1rem; }
        
        .message-content strong {
          font-weight: 600;
          color: #111827;
        }
        
        .message-content em {
          font-style: italic;
          color: #4b5563;
        }
        
        .message-content code {
          background: #f3f4f6;
          color: #dc2626;
          padding: 0.2rem 0.4rem;
          border-radius: 4px;
          font-family: 'SF Mono', 'Monaco', monospace;
          font-size: 0.9rem;
        }
        
        .files-section {
          margin-top: 3rem;
          padding-top: 2rem;
          border-top: 3px solid #e5e7eb;
        }
        
        .files-section h2 {
          font-size: 1.8rem;
          color: #1e40af;
          margin-bottom: 1.5rem;
          font-weight: 600;
        }
        
        .files-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1rem;
        }
        
        .file-item {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 1rem;
          transition: all 0.2s ease;
        }
        
        .file-item:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          transform: translateY(-2px);
        }
        
        .file-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }
        
        .file-icon {
          font-size: 1.5rem;
        }
        
        .file-name {
          font-weight: 600;
          color: #374151;
          word-break: break-word;
        }
        
        .file-details {
          display: flex;
          gap: 1rem;
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
          color: #6b7280;
        }
        
        .file-location {
          font-size: 0.875rem;
          color: #059669;
          font-weight: 500;
        }
        
        .footer {
          margin-top: 3rem;
          padding-top: 2rem;
          border-top: 2px solid #e5e7eb;
          text-align: center;
          color: #6b7280;
          font-size: 0.875rem;
        }
        
        .disclaimer {
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 1rem;
          margin-top: 1rem;
          font-size: 0.875rem;
          color: #92400e;
        }
        
        /* Print styles */
        @media print {
          body {
            padding: 1rem;
            max-width: none;
          }
          
          .header h1 {
            font-size: 2rem;
          }
          
          .message {
            break-inside: avoid;
            margin-bottom: 1rem;
          }
          
          .files-section {
            break-inside: avoid;
          }
        }
        
        /* Mobile styles */
        @media (max-width: 768px) {
          body {
            padding: 1rem;
          }
          
          .header h1 {
            font-size: 2rem;
          }
          
          .message-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }
          
          .files-grid {
            grid-template-columns: 1fr;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${threadTitle}</h1>
        <div class="subtitle">
          Digital Strategy Bot Conversation Export<br>
          Generated on ${new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      </div>
      
      <div class="conversation">
        ${messagesHTML}
      </div>
      
      ${filesHTML}
      
      <div class="footer">
        <div class="disclaimer">
          ⚠️ <strong>Important:</strong> This is AI-generated content and should be independently verified before use in decision-making or policy development.
        </div>
        <div style="margin-top: 1rem;">
          Exported from Digital Strategy Bot • Generated for Caribbean Government Digital Transformation
        </div>
      </div>
    </body>
    </html>
  `;
}

// Helper function to get appropriate file icon for HTML
function getFileIconForHTML(contentType: string): string {
  if (contentType.includes('pdf')) return '📄';
  if (contentType.includes('word') || contentType.includes('document')) return '📝';
  if (contentType.includes('excel') || contentType.includes('spreadsheet')) return '📊';
  if (contentType.includes('powerpoint') || contentType.includes('presentation')) return '📋';
  if (contentType.includes('image')) return '🖼️';
  if (contentType.includes('csv')) return '📈';
  if (contentType.includes('json')) return '🔗';
  if (contentType.includes('text')) return '📄';
  return '📎';
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id: threadId } = params;

    if (!threadId) {
      return NextResponse.json({ error: 'Thread ID is required' }, { status: 400 });
    }

    console.log(`Generating HTML + ZIP export for thread: ${threadId}`);

    // 1. Get thread messages from OpenAI
    let messages = [];
    let threadTitle = 'Conversation Export';
    
    try {
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      const openaiMessages = await openai.beta.threads.messages.list(threadId);
      
      messages = openaiMessages.data
        .reverse()
        .map((msg: any) => {
          let content = '';
          
          if (Array.isArray(msg.content)) {
            content = msg.content
              .map((item: any) => {
                if (item.type === 'text') {
                  let text = item.text?.value || '';
                  
                  // Handle file annotations - replace with clean references
                  if (item.text?.annotations) {
                    for (const annotation of item.text.annotations) {
                      if (annotation.type === 'file_path' && annotation.file_path?.file_id) {
                        const fileId = annotation.file_path.file_id;
                        // Replace sandbox URLs with clean file references
                        text = text.replace(annotation.text, `[📎 File: ${fileId} - See annexures folder]`);
                      }
                    }
                  }
                  
                  return text;
                }
                return '';
              })
              .join('');
          }
          
          return {
            role: msg.role,
            content: content,
            timestamp: new Date(msg.created_at * 1000).toLocaleString()
          };
        });

      // Generate smart title from first meaningful user message
      const firstUserMessage = messages.find(m => m.role === 'user' && m.content.length > 10);
      if (firstUserMessage) {
        threadTitle = firstUserMessage.content
          .substring(0, 60)
          .replace(/[^\w\s]/g, '')
          .trim() || 'Digital Strategy Conversation';
      }
      
    } catch (error) {
      console.error('Error fetching thread messages:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch conversation. Thread may have expired.' 
      }, { status: 500 });
    }

    // 2. Get thread files from Supabase
    const { data: threadFiles, error: filesError } = await supabase
      .from('blob_files')
      .select('*')
      .eq('thread_id', threadId);

    if (filesError) {
      console.warn('Error fetching thread files:', filesError);
    }

    const files = threadFiles || [];
    console.log(`Found ${files.length} files for thread ${threadId}`);

    // 3. Generate professional HTML
    const htmlContent = generateConversationHTML(threadTitle, messages, files);

    // 4. Create ZIP archive with better error handling
    const archive = archiver('zip', { 
      zlib: { level: 9 }, // Maximum compression
      comment: `Digital Strategy Bot Export - ${new Date().toISOString()}`
    });
    
    const chunks: Buffer[] = [];
    let archiveError: Error | null = null;

    // Handle archive events
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      archiveError = err;
    });

    archive.on('data', (chunk) => {
      chunks.push(chunk);
    });

    // 5. Add HTML file to ZIP
    archive.append(Buffer.from(htmlContent, 'utf-8'), { 
      name: 'conversation.html',
      //comment: 'Main conversation export in HTML format'
    });

    // 6. Add files to annexures folder with better error handling
    if (files.length > 0) {
      console.log('Adding files to ZIP...');
      
      for (const file of files) {
        try {
          console.log(`Downloading file: ${file.filename}`);
          
          // Download file from Vercel Blob with timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
          
          const fileResponse = await fetch(file.vercel_blob_url, {
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (!fileResponse.ok) {
            console.warn(`Failed to download ${file.filename}: ${fileResponse.status}`);
            // Add error placeholder instead of failing completely
            archive.append(
              Buffer.from(`File download failed: ${file.filename}\nOriginal URL: ${file.vercel_blob_url}`, 'utf-8'),
              { name: `annexures/ERROR_${file.filename}.txt` }
            );
            continue;
          }
          
          const fileBuffer = await fileResponse.arrayBuffer();
          
          // Add file to ZIP with proper path
          archive.append(Buffer.from(fileBuffer), { 
            name: `annexures/${file.filename}`,
            //comment: `Original file: ${file.content_type}, ${(file.file_size / 1024 / 1024).toFixed(2)}MB`
          });
          
          console.log(`Added to ZIP: ${file.filename}`);
          
        } catch (fileError) {
          console.error(`Error processing file ${file.filename}:`, fileError);
          
          // Add error placeholder
          archive.append(
            Buffer.from(`Error downloading file: ${file.filename}\nError: ${fileError}\nOriginal URL: ${file.vercel_blob_url}`, 'utf-8'),
            { name: `annexures/ERROR_${file.filename}.txt` }
          );
        }
      }
    }

    // 7. Finalize archive
    try {
      await archive.finalize();
      
      if (archiveError) {
        throw archiveError;
      }
      
    } catch (finalizeError) {
      console.error('Archive finalization error:', finalizeError);
      return NextResponse.json({ 
        error: 'Failed to create ZIP archive' 
      }, { status: 500 });
    }

    // 8. Check if archive was created successfully
    if (chunks.length === 0) {
      return NextResponse.json({ 
        error: 'ZIP generation failed - no content created' 
      }, { status: 500 });
    }

    // 9. Combine chunks and create response
    const zipBuffer = Buffer.concat(chunks);
    const fileName = `${threadTitle.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')}-${threadId.substring(0, 8)}.zip`;
    
    console.log(`ZIP created successfully: ${fileName} (${(zipBuffer.length / 1024 / 1024).toFixed(2)}MB)`);
    
    // 10. Return ZIP file with proper headers
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': zipBuffer.length.toString(),
        'Cache-Control': 'no-cache',
        'X-Export-Type': 'html-zip',
        'X-Files-Count': files.length.toString(),
        'X-Messages-Count': messages.length.toString(),
      },
    });

  } catch (error) {
    console.error('Thread download error:', error);
    
    // Enhanced error response
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Unknown error occurred during export';
      
    return NextResponse.json({ 
      error: 'Export generation failed',
      details: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}