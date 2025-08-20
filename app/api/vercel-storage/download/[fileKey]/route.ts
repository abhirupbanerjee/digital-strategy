// app/api/vercel-storage/download/[fileKey]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileKey: string }> }
) {
  try {
    const { fileKey } = await params;
    const { searchParams } = new URL(request.url);
    const preview = searchParams.get('preview');
    
    console.log(`Direct Vercel Blob download: ${fileKey}`);
    
    // Get file info from Supabase
    const { data: fileInfo, error } = await supabase
      .from('blob_files')
      .select('vercel_blob_url, filename, content_type, file_size, openai_file_id')
      .eq('vercel_file_key', fileKey)
      .single();
    
    if (error || !fileInfo) {
      console.error('File not found in database:', error);
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }
    
    // Update access timestamp
    await supabase
      .from('blob_files')
      .update({ accessed_at: new Date().toISOString() })
      .eq('vercel_file_key', fileKey);
    
    // Fetch from Vercel Blob
    const response = await fetch(fileInfo.vercel_blob_url);
    
    if (!response.ok) {
      console.error(`Failed to fetch from Vercel Blob: ${response.status}`);
      return NextResponse.json(
        { error: 'Failed to fetch file from storage' },
        { status: 502 }
      );
    }
    
    const fileBuffer = await response.arrayBuffer();
    
    console.log(`Serving file: ${fileInfo.filename} (${(fileInfo.file_size / 1024 / 1024).toFixed(2)}MB)`);
    
    // Set appropriate headers
    const headers = new Headers({
      'Content-Type': fileInfo.content_type || 'application/octet-stream',
      'Content-Length': fileBuffer.byteLength.toString(),
      'Cache-Control': 'public, max-age=31536000',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    
    // For downloads (not preview), add download headers
    if (!preview) {
      headers.set('Content-Disposition', `attachment; filename="${fileInfo.filename}"`);
      headers.set('X-Content-Type-Options', 'nosniff');
    } else {
      headers.set('Content-Disposition', `inline; filename="${fileInfo.filename}"`);
    }
    
    return new NextResponse(fileBuffer, { headers });
    
  } catch (error) {
    console.error('Direct download error:', error);
    return NextResponse.json(
      { error: 'Failed to download file' },
      { status: 500 }
    );
  }
}