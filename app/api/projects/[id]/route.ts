import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { data, error } = await supabase
    .from('projects')
    .select('*, threads(id, title)')
    .eq('id', params.id)
    .single();

  if (error) return NextResponse.json({ error }, { status: 404 });
  return NextResponse.json(data);
}