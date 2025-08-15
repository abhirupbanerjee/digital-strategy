// app/api/projects/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function GET() {
  const { data: projects, error } = await supabase
    .from('projects')
    .select('*, threads(id, title, last_activity)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ projects: [] });
  return NextResponse.json({ projects: projects || [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  
  const { data, error } = await supabase
    .from('projects')
    .insert({
      name: body.name,
      description: body.description,
      color: body.color
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json(data);
}