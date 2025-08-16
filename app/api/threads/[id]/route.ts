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
  
  // Delete thread from Supabase
  const { error } = await supabase
    .from('threads')
    .delete()
    .eq('id', params.id);

  if (error) return NextResponse.json({ error }, { status: 500 });
  
  // Note: OpenAI thread remains (you can't delete via API)
  // but reference is removed from your database
  
  return NextResponse.json({ success: true });
}