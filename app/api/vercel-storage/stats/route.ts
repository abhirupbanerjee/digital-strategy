// app/api/vercel-storage/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Get storage metrics
    const { data: metrics, error: metricsError } = await supabase
      .from('storage_metrics')
      .select('*')
      .single();
    
    if (metricsError) {
      console.error('Error fetching storage metrics:', metricsError);
      // Return default metrics if none exist
      return NextResponse.json({
        totalSizeBytes: 0,
        totalSizeMB: 0,
        fileCount: 0,
        lastCleanupAt: null,
        limit: {
          bytes: 500 * 1024 * 1024, // 500MB
          mb: 500
        },
        usage: {
          percentage: 0,
          remaining: {
            bytes: 500 * 1024 * 1024,
            mb: 500
          }
        }
      });
    }
    
    const totalSizeBytes = metrics?.total_size_bytes || 0;
    const totalSizeMB = Math.round((totalSizeBytes / 1024 / 1024) * 100) / 100;
    const fileCount = metrics?.file_count || 0;
    
    // Vercel Hobby plan limit: 500MB
    const limitBytes = 500 * 1024 * 1024;
    const limitMB = 500;
    
    const usagePercentage = Math.round((totalSizeBytes / limitBytes) * 100 * 100) / 100;
    const remainingBytes = limitBytes - totalSizeBytes;
    const remainingMB = Math.round((remainingBytes / 1024 / 1024) * 100) / 100;
    
    // Get recent files for additional info
    const { data: recentFiles, error: filesError } = await supabase
      .from('blob_files')
      .select('filename, file_size, created_at, accessed_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    const responseData = {
      totalSizeBytes: totalSizeBytes,
      totalSizeMB: totalSizeMB,
      fileCount: fileCount,
      lastCleanupAt: metrics?.last_cleanup_at,
      updatedAt: metrics?.updated_at,
      limit: {
        bytes: limitBytes,
        mb: limitMB
      },
      usage: {
        percentage: usagePercentage,
        remaining: {
          bytes: remainingBytes,
          mb: remainingMB
        }
      },
      recentFiles: filesError ? [] : recentFiles?.map(file => ({
        filename: file.filename,
        sizeMB: Math.round((file.file_size / 1024 / 1024) * 100) / 100,
        createdAt: file.created_at,
        accessedAt: file.accessed_at
      })) || [],
      cleanup: {
        threshold: {
          bytes: 400 * 1024 * 1024,
          mb: 400
        },
        triggered: usagePercentage > 80,
        required: totalSizeBytes > (400 * 1024 * 1024)
      }
    };
    
    return NextResponse.json(responseData);
    
  } catch (error) {
    console.error('Storage stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch storage statistics' },
      { status: 500 }
    );
  }
}

// POST endpoint to manually trigger metrics recalculation
export async function POST(request: NextRequest) {
  try {
    console.log('Recalculating storage metrics...');
    
    // Query all files and calculate totals
    const { data: allFiles, error: filesError } = await supabase
      .from('blob_files')
      .select('file_size');
    
    if (filesError) {
      console.error('Error querying files for metrics:', filesError);
      return NextResponse.json(
        { error: 'Failed to query files' },
        { status: 500 }
      );
    }
    
    const totalSize = allFiles?.reduce((sum, file) => sum + (file.file_size || 0), 0) || 0;
    const fileCount = allFiles?.length || 0;
    
    // Update storage metrics
    const { error: updateError } = await supabase
      .from('storage_metrics')
      .upsert({
        id: '00000000-0000-0000-0000-000000000000',
        total_size_bytes: totalSize,
        file_count: fileCount,
        updated_at: new Date().toISOString()
      });
    
    if (updateError) {
      console.error('Error updating storage metrics:', updateError);
      return NextResponse.json(
        { error: 'Failed to update metrics' },
        { status: 500 }
      );
    }
    
    console.log(`Metrics recalculated: ${fileCount} files, ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
    
    return NextResponse.json({
      success: true,
      message: 'Metrics recalculated',
      totalSizeBytes: totalSize,
      totalSizeMB: Math.round((totalSize / 1024 / 1024) * 100) / 100,
      fileCount: fileCount
    });
    
  } catch (error) {
    console.error('Metrics recalculation error:', error);
    return NextResponse.json(
      { error: 'Failed to recalculate metrics' },
      { status: 500 }
    );
  }
}