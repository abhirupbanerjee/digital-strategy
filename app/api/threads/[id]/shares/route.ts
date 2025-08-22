// app/api/threads/[id]/shares/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Generate secure share token
function generateShareToken(): string {
  return randomBytes(32).toString('hex');
}

// Create thread share
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id } = params;
    const { permissions, expiryDays } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Thread ID is required' }, { status: 400 });
    }

    if (!permissions || !['read', 'collaborate'].includes(permissions)) {
      return NextResponse.json({ error: 'Valid permissions required' }, { status: 400 });
    }

    const days = expiryDays || 1;
    if (days < 1 || days > 30) {
      return NextResponse.json({ error: 'Expiry days must be between 1 and 30' }, { status: 400 });
    }

    // Verify thread exists (check both database and OpenAI)
    try {
      // Check if thread exists in our database
      const { data: threadCheck } = await supabase
        .from('threads')
        .select('id')
        .eq('id', id)
        .single();

      // If not in database, verify with OpenAI
      if (!threadCheck) {
        const OpenAI = (await import('openai')).default;
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        
        try {
          await openai.beta.threads.retrieve(id);
        } catch (openaiError) {
          return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
        }
      }
    } catch (error) {
      return NextResponse.json({ error: 'Thread verification failed' }, { status: 500 });
    }

    // Generate share token and expiry
    const shareToken = generateShareToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    // Create share record
    const { data: share, error } = await supabase
      .from('thread_shares')
      .insert({
        thread_id: id,
        share_token: shareToken,
        permissions,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Share creation error:', error);
      return NextResponse.json({ error: 'Failed to create share' }, { status: 500 });
    }

    // Generate share URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const shareUrl = `${baseUrl}/shared/thread/${shareToken}`;

    return NextResponse.json({
      shareToken,
      shareUrl,
      permissions,
      expiresAt: share.expires_at,
      createdAt: share.created_at
    });

  } catch (error) {
    console.error('Thread share creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// List thread shares
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: 'Thread ID is required' }, { status: 400 });
    }

    const { data: shares, error } = await supabase
      .from('thread_shares')
      .select('*')
      .eq('thread_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Share list error:', error);
      return NextResponse.json({ error: 'Failed to load shares' }, { status: 500 });
    }

    // Add share URLs and check expiry status
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const sharesWithUrls = shares.map(share => ({
      ...share,
      shareUrl: `${baseUrl}/shared/thread/${share.share_token}`,
      isExpired: new Date(share.expires_at) < new Date()
    }));

    return NextResponse.json({ shares: sharesWithUrls });

  } catch (error) {
    console.error('Thread share list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Revoke share (DELETE)
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id} = params;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!id || !token) {
      return NextResponse.json({ error: 'Thread ID and token are required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('thread_shares')
      .delete()
      .eq('thread_id', id)
      .eq('share_token', token);

    if (error) {
      console.error('Share revoke error:', error);
      return NextResponse.json({ error: 'Failed to revoke share' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Thread share revoke error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}