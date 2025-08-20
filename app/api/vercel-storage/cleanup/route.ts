// app/api/vercel-storage/cleanup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    console.log('Starting storage cleanup...');
    
    // Get current storage metrics
    const { data: metrics } = await supabase
      .from('storage_metrics')
      .select('total_size_bytes, file_count')
      .single();
    
    const currentSize = metrics?.total_size_bytes || 0;
    const CLEANUP_THRESHOLD = 400 * 1024 * 1024; // 400MB
    
    console.log(`Current storage: ${(currentSize / 1024 / 1024).toFixed(2)}MB`);
    
    if (currentSize <= CLEANUP_THRESHOLD) {
      return NextResponse.json({
        success: true,
        message: 'No cleanup needed',
        currentSize: currentSize,
        threshold: CLEANUP_THRESHOLD
      });
    }
    
    // Calculate how much to clean (bring down to 300MB)
    const TARGET_SIZE = 300 * 1024 * 1024; // 300MB
    const sizeToClean = currentSize - TARGET_SIZE;
    
    console.log(`Need to clean ${(sizeToClean / 1024 / 1024).toFixed(2)}MB`);
    
    // Get files to delete (oldest first, but preserve recent files)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7); // 7 days ago
    
    const { data: filesToDelete, error: queryError } = await supabase
      .from('blob_files')
      .select('*')
      .lt('accessed_at', cutoffDate.toISOString()) // Only files not accessed in 7 days
      .order('accessed_at', { ascending: true }); // Oldest first
    
    if (queryError) {
      console.error('Error querying files for cleanup:', queryError);
      return NextResponse.json(
        { error: 'Failed to query files for cleanup' },
        { status: 500 }
      );
    }
    
    if (!filesToDelete || filesToDelete.length === 0) {
      console.log('No files eligible for cleanup (all accessed within 7 days)');
      return NextResponse.json({
        success: true,
        message: 'No files eligible for cleanup - all files accessed recently',
        currentSize: currentSize
      });
    }
    
    // Delete files until we reach target size
    let deletedSize = 0;
    let deletedCount = 0;
    const deletedFiles = [];
    
    for (const file of filesToDelete) {
      if (deletedSize >= sizeToClean) {
        break; // We've cleaned enough
      }
      
      try {
        // Delete from Vercel Blob
        await del(file.vercel_blob_url, {
          token: process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
        });
        console.log(`Deleted from Vercel Blob: ${file.filename}`);
        
        // Delete from Supabase
        const { error: deleteError } = await supabase
          .from('blob_files')
          .delete()
          .eq('id', file.id);
        
        if (deleteError) {
          console.error(`Error deleting file ${file.id} from Supabase:`, deleteError);
          continue;
        }
        
        deletedSize += file.file_size;
        deletedCount++;
        deletedFiles.push({
          filename: file.filename,
          size: file.file_size,
          created_at: file.created_at
        });
        
        console.log(`Deleted: ${file.filename} (${(file.file_size / 1024 / 1024).toFixed(2)}MB)`);
        
      } catch (error) {
        console.error(`Error deleting file ${file.filename}:`, error);
        continue;
      }
    }
    
    // Update storage metrics
    const newTotalSize = currentSize - deletedSize;
    const newFileCount = (metrics?.file_count || 0) - deletedCount;
    
    await supabase
      .from('storage_metrics')
      .upsert({
        id: '00000000-0000-0000-0000-000000000000',
        total_size_bytes: newTotalSize,
        file_count: newFileCount,
        last_cleanup_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    
    console.log(`Cleanup complete: Deleted ${deletedCount} files, ${(deletedSize / 1024 / 1024).toFixed(2)}MB`);
    
    return NextResponse.json({
      success: true,
      message: 'Cleanup completed',
      deletedCount: deletedCount,
      deletedSize: deletedSize,
      newTotalSize: newTotalSize,
      deletedFiles: deletedFiles
    });
    
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup storage' },
      { status: 500 }
    );
  }
}