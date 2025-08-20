// app/api/vercel-storage/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { openaiFileId, filename, threadId, description } = await request.json();
    
    if (!openaiFileId || !filename) {
      return NextResponse.json(
        { error: 'Missing required parameters: openaiFileId, filename' },
        { status: 400 }
      );
    }
    
    console.log(`Manual upload to Vercel Blob: ${openaiFileId}`);
    
    // Download file from OpenAI
    const fileResponse = await fetch(`https://api.openai.com/v1/files/${openaiFileId}/content`, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'OpenAI-Organization': process.env.OPENAI_ORGANIZATION || '',
      },
    });
    
    if (!fileResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to download file from OpenAI' },
        { status: 404 }
      );
    }
    
    const fileBuffer = await fileResponse.arrayBuffer();
    const fileSize = fileBuffer.byteLength;
    
    // Get content type from filename
    const contentType = getContentTypeFromFilename(filename);
    
    // Generate unique filename for blob storage
    const timestamp = Date.now();
    const fileKey = `manual/${timestamp}-${filename}`;
    
    // Upload to Vercel Blob
    const blob = await put(fileKey, fileBuffer, {
      access: 'public',
      contentType: contentType,
      token: process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
    });
    
    // Store mapping in Supabase
    const { error: insertError } = await supabase
      .from('blob_files')
      .insert({
        openai_file_id: openaiFileId,
        vercel_blob_url: blob.url,
        vercel_file_key: fileKey,
        filename: filename,
        content_type: contentType,
        file_size: fileSize,
        thread_id: threadId,
        created_at: new Date().toISOString(),
        accessed_at: new Date().toISOString()
      });
    
    if (insertError) {
      console.error('Error storing file mapping:', insertError);
      return NextResponse.json(
        { error: 'Failed to store file mapping' },
        { status: 500 }
      );
    }
    
    // Update storage metrics
    await updateStorageMetrics(fileSize);
    
    console.log(`File ${openaiFileId} successfully uploaded to Vercel Blob`);
    
    return NextResponse.json({
      success: true,
      blobUrl: blob.url,
      fileKey: fileKey,
      fileSize: fileSize,
      contentType: contentType
    });
    
  } catch (error) {
    console.error('Manual upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file to Vercel Blob' },
      { status: 500 }
    );
  }
}

// Helper function to update storage metrics
async function updateStorageMetrics(addedSize: number): Promise<void> {
  try {
    const { data: currentMetrics } = await supabase
      .from('storage_metrics')
      .select('total_size_bytes, file_count')
      .single();
    
    const newTotalSize = (currentMetrics?.total_size_bytes || 0) + addedSize;
    const newFileCount = (currentMetrics?.file_count || 0) + 1;
    
    await supabase
      .from('storage_metrics')
      .upsert({
        id: '00000000-0000-0000-0000-000000000000',
        total_size_bytes: newTotalSize,
        file_count: newFileCount,
        updated_at: new Date().toISOString()
      });
    
  } catch (error) {
    console.error('Error updating storage metrics:', error);
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