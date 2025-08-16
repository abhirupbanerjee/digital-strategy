import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  
  // This will cascade delete all threads due to ON DELETE CASCADE
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', params.id);

  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Await the params since it's now a Promise in Next.js 15+
  const params = await context.params;
  
  const { data, error } = await supabase
    .from('projects')
    .select('*, threads(id, title)')
    .eq('id', params.id)
    .single();

  if (error) return NextResponse.json({ error }, { status: 404 });
  return NextResponse.json(data);
}