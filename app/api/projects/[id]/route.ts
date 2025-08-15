import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

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