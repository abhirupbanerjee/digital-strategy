// app/api/projects/[id]/shares/route.ts


import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const projectId = params.id;

  try {
    const body = await request.json();
    const { 
      permissions = 'read', // 'read' or 'collaborate'
      expiryDays = 1 // default 1 day
    } = body;

    // Validate permissions
    if (!['read', 'collaborate'].includes(permissions)) {
      return NextResponse.json(
        { error: 'Invalid permissions. Use "read" or "collaborate"' },
        { status: 400 }
      );
    }

    // Validate expiry days (1-30 days max)
    const days = Math.min(Math.max(parseInt(expiryDays) || 1, 1), 30);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    // Check if project exists
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Generate unique share token
    const shareToken = randomUUID();

    // Create share record
    const { data: share, error: shareError } = await supabase
      .from('project_shares')
      .insert({
        project_id: projectId,
        share_token: shareToken,
        permissions,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (shareError) {
      return NextResponse.json(
        { error: 'Failed to create share link' },
        { status: 500 }
      );
    }

    // Generate shareable URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const shareUrl = `${baseUrl}/shared/${shareToken}`;

    return NextResponse.json({
      shareUrl,
      shareToken,
      permissions,
      expiresAt: expiresAt.toISOString(),
      projectName: project.name
    });

  } catch (error) {
    console.error('Share creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET: List existing shares for project
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const projectId = params.id;

  try {
    const { data: shares, error } = await supabase
      .from('project_shares')
      .select('*')
      .eq('project_id', projectId)
      .gt('expires_at', new Date().toISOString()) // Only active shares
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch shares' },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const sharesWithUrls = shares.map(share => ({
      ...share,
      shareUrl: `${baseUrl}/shared/${share.share_token}`
    }));

    return NextResponse.json({ shares: sharesWithUrls });

  } catch (error) {
    console.error('Shares fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: Revoke share token
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const projectId = params.id;

  try {
    const { searchParams } = new URL(request.url);
    const shareToken = searchParams.get('token');

    if (!shareToken) {
      return NextResponse.json(
        { error: 'Share token required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('project_shares')
      .delete()
      .eq('project_id', projectId)
      .eq('share_token', shareToken);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to revoke share' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Share revoke error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}