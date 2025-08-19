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

    // Validate file size (20MB limit)
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB in bytes
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 20MB limit' },
        { status: 400 }
      );
    }

    // UPDATED: Comprehensive file type support including PPT and images
    const supportedTypes = [
      // Documents
      'text/plain',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      
      // Spreadsheets  
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      
      // Presentations (PPT)
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      
      // Images
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
      'image/bmp',
      'image/tiff',
      
      // Data formats
      'application/json',
      'text/xml',
      'application/xml',
      'text/html',
      'text/markdown',
    ];

    // Check file type with fallback for file extensions
    const isTypeSupported = supportedTypes.includes(file.type) || 
                           file.name.endsWith('.md') ||
                           file.name.endsWith('.txt') ||
                           file.name.endsWith('.ppt') ||
                           file.name.endsWith('.pptx') ||
                           file.name.endsWith('.doc') ||
                           file.name.endsWith('.docx') ||
                           file.name.endsWith('.pdf') ||
                           file.name.endsWith('.xls') ||
                           file.name.endsWith('.xlsx') ||
                           file.name.endsWith('.csv') ||
                           file.name.endsWith('.jpg') ||
                           file.name.endsWith('.jpeg') ||
                           file.name.endsWith('.png') ||
                           file.name.endsWith('.gif') ||
                           file.name.endsWith('.webp');

    if (!isTypeSupported) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Supported: PDF, DOC, PPT, Excel, CSV, Images (JPG, PNG, GIF, WebP), TXT` },
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

    console.log(`Uploading file: ${file.name} (${file.size} bytes, type: ${file.type})`);

    const response = await axios.post(
      'https://api.openai.com/v1/files',
      openAIFormData,
      { 
        headers,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 60000 // 60 second timeout for large files
      }
    );

    console.log('File uploaded successfully:', response.data.id);

    return NextResponse.json({
      fileId: response.data.id,
      filename: file.name,
      size: file.size,
      type: file.type,
      status: 'success'
    });

  } catch (error: any) {
    console.error('File upload error:', error.response?.data || error.message);
    
    let errorMessage = 'Failed to upload file';
    
    if (error.response?.data?.error?.message) {
      errorMessage = error.response.data.error.message;
    } else if (error.response?.status === 413) {
      errorMessage = 'File is too large (max 20MB)';
    } else if (error.response?.status === 401) {
      errorMessage = 'Invalid OpenAI API key';
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Upload timeout - file may be too large';
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: error.response?.status || 500 }
    );
  }
}