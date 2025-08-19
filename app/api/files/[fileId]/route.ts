// app/api/files/[fileId]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    // Fix for Next.js async params
    const { fileId } = await params;
    const { searchParams } = new URL(request.url);
    const preview = searchParams.get('preview');
    
    console.log(`Fetching file: ${fileId}`);
    
    // First, get file metadata from OpenAI to determine the correct filename and type
    let fileMetadata = null;
    try {
      const metadataResponse = await fetch(`https://api.openai.com/v1/files/${fileId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'OpenAI-Organization': process.env.OPENAI_ORGANIZATION || '',
        },
      });
      
      if (metadataResponse.ok) {
        fileMetadata = await metadataResponse.json();
        console.log('File metadata:', fileMetadata);
      }
    } catch (metaError) {
      console.warn('Could not fetch file metadata:', metaError);
    }
    
    // Fetch file content from OpenAI
    const response = await fetch(`https://api.openai.com/v1/files/${fileId}/content`, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'OpenAI-Organization': process.env.OPENAI_ORGANIZATION || '',
      },
    });

    if (!response.ok) {
      console.error(`OpenAI file fetch failed: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    const fileBuffer = await response.arrayBuffer();
    
    // Determine content type and filename
    let contentType = response.headers.get('content-type') || 'application/octet-stream';
    let filename = `file-${fileId}`;
    
    // Use metadata filename if available
    if (fileMetadata?.filename) {
      filename = fileMetadata.filename;
      // Determine content type from filename extension
      const detectedType = getContentTypeFromFilename(filename);
      if (detectedType) {
        contentType = detectedType;
      }
    } else {
      // Fallback: detect from content type and add appropriate extension
      filename = `file-${fileId}${getFileExtension(contentType)}`;
    }
    
    console.log(`Serving file: ${filename}, Content-Type: ${contentType}`);
    
    // Enhanced headers for mobile compatibility
    const headers = new Headers({
      'Content-Type': contentType,
      'Content-Length': fileBuffer.byteLength.toString(),
      'Cache-Control': 'public, max-age=31536000',
      // Add mobile-friendly headers
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    });

    // For downloads (not preview), add download headers
    if (!preview) {
      headers.set('Content-Disposition', `attachment; filename="${filename}"`);
      headers.set('X-Content-Type-Options', 'nosniff');
    } else {
      // For preview, use inline disposition
      headers.set('Content-Disposition', `inline; filename="${filename}"`);
    }

    return new NextResponse(fileBuffer, { headers });
    
  } catch (error) {
    console.error('File download error:', error);
    return NextResponse.json(
      { error: 'Failed to download file' },
      { status: 500 }
    );
  }
}

// Enhanced function to get content type from filename
function getContentTypeFromFilename(filename: string): string | null {
  const extension = filename.toLowerCase().split('.').pop();
  
  const contentTypes: { [key: string]: string } = {
    // Microsoft Office
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'doc': 'application/msword',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'xls': 'application/vnd.ms-excel',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'ppt': 'application/vnd.ms-powerpoint',
    
    // Documents
    'pdf': 'application/pdf',
    'txt': 'text/plain',
    'rtf': 'application/rtf',
    'odt': 'application/vnd.oasis.opendocument.text',
    'ods': 'application/vnd.oasis.opendocument.spreadsheet',
    
    // Data formats
    'json': 'application/json',
    'csv': 'text/csv',
    'xml': 'application/xml',
    'html': 'text/html',
    'htm': 'text/html',
    'md': 'text/markdown',
    
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp',
    'webp': 'image/webp',
    
    // Archives
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',
  };
  
  return extension ? contentTypes[extension] || null : null;
}

// Helper function to get file extension based on content type
function getFileExtension(contentType: string): string {
  const extensions: { [key: string]: string } = {
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/pdf': '.pdf',
    'text/plain': '.txt',
    'application/json': '.json',
    'text/csv': '.csv',
    'text/html': '.html',
    'text/markdown': '.md',
    'application/xml': '.xml',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
    'application/zip': '.zip',
    'application/rtf': '.rtf',
  };
  
  return extensions[contentType] || '';
}