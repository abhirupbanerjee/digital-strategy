// app/api/threads/[id]/download/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import archiver from 'archiver';
import puppeteer from 'puppeteer';
import { Readable } from 'stream';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Generate HTML for PDF conversion
function generateThreadHTML(threadTitle: string, messages: any[], files: any[]): string {
  const messagesHTML = messages.map(msg => `
    <div class="message ${msg.role}">
      <div class="message-header">
        <strong>${msg.role === 'user' ? 'User' : 'Digital Strategy Bot'}</strong>
        <span class="timestamp">${msg.timestamp || new Date().toLocaleString()}</span>
      </div>
      <div class="message-content">
        ${msg.content.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}
      </div>
    </div>
  `).join('');

  const filesHTML = files.length > 0 ? `
    <div class="files-section">
      <h3>Referenced Files</h3>
      <ul>
        ${files.map(file => `
          <li>
            <strong>${file.filename}</strong> 
            <span class="file-info">(${(file.file_size / 1024 / 1024).toFixed(2)} MB, ${file.content_type})</span>
            <br>
            <a href="${file.vercel_blob_url}" target="_blank">Download: ${file.vercel_blob_url}</a>
          </li>
        `).join('')}
      </ul>
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${threadTitle}</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #eee;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .header h1 {
          color: #2563eb;
          margin-bottom: 10px;
        }
        .header .subtitle {
          color: #666;
          font-size: 14px;
        }
        .message {
          margin-bottom: 25px;
          padding: 15px;
          border-radius: 8px;
          border-left: 4px solid #e5e7eb;
        }
        .message.user {
          background-color: #f3f4f6;
          border-left-color: #6b7280;
        }
        .message.assistant {
          background-color: #fefefe;
          border-left-color: #2563eb;
          border: 1px solid #e5e7eb;
        }
        .message-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
          font-size: 14px;
        }
        .message-header strong {
          color: #1f2937;
        }
        .timestamp {
          color: #6b7280;
          font-size: 12px;
        }
        .message-content {
          font-size: 14px;
          line-height: 1.7;
        }
        .files-section {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 2px solid #eee;
        }
        .files-section h3 {
          color: #2563eb;
          margin-bottom: 15px;
        }
        .files-section ul {
          list-style: none;
          padding: 0;
        }
        .files-section li {
          margin-bottom: 15px;
          padding: 10px;
          background-color: #f9fafb;
          border-radius: 6px;
        }
        .file-info {
          color: #6b7280;
          font-size: 12px;
        }
        .files-section a {
          color: #2563eb;
          text-decoration: none;
          font-size: 12px;
          word-break: break-all;
        }
        .disclaimer {
          position: fixed;
          bottom: 20px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 10px;
          color: #6b7280;
          background: white;
          padding: 10px;
          border-top: 1px solid #e5e7eb;
        }
        @page {
          margin: 1in;
          @bottom-center {
            content: "This is AI generated material and should be independently verified before use in decision-making. Page " counter(page) " of " counter(pages);
            font-size: 10px;
            color: #6b7280;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${threadTitle}</h1>
        <div class="subtitle">
          Conversation Export • Generated on ${new Date().toLocaleDateString()}
        </div>
      </div>
      
      <div class="messages">
        ${messagesHTML}
      </div>
      
      ${filesHTML}
    </body>
    </html>
  `;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id:threadId } = params;

    if (!threadId) {
      return NextResponse.json({ error: 'Thread ID is required' }, { status: 400 });
    }

    // 1. Get thread messages
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
                  
                  // Handle file annotations
                  if (item.text?.annotations) {
                    for (const annotation of item.text.annotations) {
                      if (annotation.type === 'file_path' && annotation.file_path?.file_id) {
                        const fileId = annotation.file_path.file_id;
                        text = text.replace(annotation.text, `[File: ${fileId}]`);
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

      // Generate thread title from first user message
      const firstUserMessage = messages.find(m => m.role === 'user');
      if (firstUserMessage) {
        threadTitle = firstUserMessage.content.substring(0, 50).replace(/[^a-zA-Z0-9\s]/g, '').trim() || 'Conversation Export';
      }
      
    } catch (error) {
      console.error('Error fetching thread messages:', error);
      return NextResponse.json({ error: 'Failed to fetch thread messages' }, { status: 500 });
    }

    // 2. Get thread files from blob_files table
    const { data: threadFiles } = await supabase
      .from('blob_files')
      .select('*')
      .eq('thread_id', threadId);

    const files = threadFiles || [];

    // 3. Generate PDF using Puppeteer
    let pdfBuffer: Buffer;
    
    try {
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      const html = generateThreadHTML(threadTitle, messages, files);
      
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '1in',
          right: '1in',
          bottom: '1in',
          left: '1in'
        }
      });
      
      await browser.close();
      
    } catch (error) {
      console.error('PDF generation error:', error);
      return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
    }

    // 4. Create ZIP with PDF and files
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    // Handle archive data
    archive.on('data', (chunk) => chunks.push(chunk));
    
    // Add PDF to ZIP
    archive.append(pdfBuffer, { name: 'chat-conversation.pdf' });

    // Add files to annexures folder
    if (files.length > 0) {
      for (const file of files) {
        try {
          // Download file from Vercel Blob
          const fileResponse = await fetch(file.vercel_blob_url);
          if (fileResponse.ok) {
            const fileBuffer = await fileResponse.arrayBuffer();
            archive.append(Buffer.from(fileBuffer), { 
              name: `annexures/${file.filename}` 
            });
          }
        } catch (fileError) {
          console.error(`Error downloading file ${file.filename}:`, fileError);
          // Continue with other files even if one fails
        }
      }
    }

    // Finalize archive
    await archive.finalize();

    // Combine all chunks
    const zipBuffer = Buffer.concat(chunks);

    // Return ZIP file
    const fileName = `thread-${threadId.substring(0, 8)}.zip`;
    
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('Thread download error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}