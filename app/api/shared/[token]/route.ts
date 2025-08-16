// app/api/shared/[token]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const params = await context.params;
  const token = params.token;

  try {
    // Get share data with project and threads
    const { data: share, error: shareError } = await supabase
      .from('project_shares')
      .select(`
        *,
        project:projects(
          id,
          name,
          description,
          color,
          threads(id, title, last_activity)
        )
      `)
      .eq('share_token', token)
      .single();

    if (shareError || !share) {
      return NextResponse.json(
        { error: 'Share link not found' },
        { status: 404 }
      );
    }

    // Check if expired
    const now = new Date();
    const expiresAt = new Date(share.expires_at);
    
    if (expiresAt < now) {
      return NextResponse.json(
        { error: 'Share link has expired' },
        { status: 410 }
      );
    }

    // Return structured data
    return NextResponse.json({
      project: share.project,
      permissions: share.permissions,
      expires_at: share.expires_at,
      threads: share.project.threads || []
    });

  } catch (error) {
    console.error('Share validation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}