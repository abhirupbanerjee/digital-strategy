// app/api/projects/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET() {
  // Get all projects
  const { data, error } = await supabaseServer
    .from('projects')
    .select('*, threads(id, title, last_activity)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { name, description } = await request.json();
  
  const { data, error } = await supabaseServer
    .from('projects')
    .insert({
      name,
      description,
      color: `#${Math.floor(Math.random()*16777215).toString(16)}`
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json(data);
} 