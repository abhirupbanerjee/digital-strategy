// app/api/files/[fileId]/route.ts
import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_ORGANIZATION = process.env.OPENAI_ORGANIZATION;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ fileId: string }> }
) {
  try {
    const params = await context.params;
    const fileId = params.fileId;

    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'Missing OpenAI API key' },
        { status: 500 }
      );
    }

    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      );
    }

    // Prepare headers for OpenAI API
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    };

    if (OPENAI_ORGANIZATION) {
      headers['OpenAI-Organization'] = OPENAI_ORGANIZATION;
    }

    // First get file metadata to determine content type
    const metadataResponse = await fetch(`https://api.openai.com/v1/files/${fileId}`, {
      headers
    });

    if (!metadataResponse.ok) {
      return NextResponse.json(
        { error: 'File not found or access denied' },
        { status: 404 }
      );
    }

    const metadata = await metadataResponse.json();
    
    // Get file content
    const contentResponse = await fetch(`https://api.openai.com/v1/files/${fileId}/content`, {
      headers
    });

    if (!contentResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch file content' },
        { status: 500 }
      );
    }

    // Determine content type and filename
    let contentType = contentResponse.headers.get('content-type') || 'application/octet-stream';
    let filename = metadata.filename || `file_${fileId}`;
    
    // Override content type based on file extension if needed
    if (filename.endsWith('.png')) contentType = 'image/png';
    else if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) contentType = 'image/jpeg';
    else if (filename.endsWith('.svg')) contentType = 'image/svg+xml';
    else if (filename.endsWith('.pdf')) contentType = 'application/pdf';
    else if (filename.endsWith('.csv')) contentType = 'text/csv';
    else if (filename.endsWith('.xlsx')) contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    else if (filename.endsWith('.docx')) contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    // Check if it's a preview request (for images and PDFs)
    const url = new URL(request.url);
    const isPreview = url.searchParams.get('preview') === 'true';

    return new NextResponse(contentResponse.body, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': isPreview ? 'inline' : `attachment; filename="${filename}"`,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error: any) {
    console.error('File download error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}