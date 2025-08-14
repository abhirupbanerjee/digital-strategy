// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_ORGANIZATION = process.env.OPENAI_ORGANIZATION;

export async function POST(request: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'Missing OpenAI API key' },
        { status: 500 }
      );
    }

    // Parse the form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const purpose = formData.get('purpose') as string || 'assistants';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file size (OpenAI has a 512MB limit)
    const MAX_FILE_SIZE = 512 * 1024 * 1024; // 512MB in bytes
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 512MB limit' },
        { status: 400 }
      );
    }

    // Supported file types for assistants
    const supportedTypes = [
      'text/plain',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/json',
      'text/xml',
      'application/xml',
      'text/html',
      'text/markdown',
    ];

    // Check file type
    if (!supportedTypes.includes(file.type) && !file.name.endsWith('.md')) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 }
      );
    }

    // Convert file to FormData for OpenAI
    const openAIFormData = new FormData();
    openAIFormData.append('file', file);
    openAIFormData.append('purpose', purpose);

    // Upload to OpenAI
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    };

    if (OPENAI_ORGANIZATION) {
      headers['OpenAI-Organization'] = OPENAI_ORGANIZATION;
    }

    console.log(`Uploading file: ${file.name} (${file.size} bytes)`);

    const response = await axios.post(
      'https://api.openai.com/v1/files',
      openAIFormData,
      { 
        headers,
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      }
    );

    console.log('File uploaded successfully:', response.data.id);

    return NextResponse.json({
      fileId: response.data.id,
      filename: file.name,
      size: file.size,
      status: 'success'
    });

  } catch (error: any) {
    console.error('File upload error:', error.response?.data || error.message);
    
    let errorMessage = 'Failed to upload file';
    
    if (error.response?.data?.error?.message) {
      errorMessage = error.response.data.error.message;
    } else if (error.response?.status === 413) {
      errorMessage = 'File is too large';
    } else if (error.response?.status === 401) {
      errorMessage = 'Invalid API key';
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: error.response?.status || 500 }
    );
  }
}