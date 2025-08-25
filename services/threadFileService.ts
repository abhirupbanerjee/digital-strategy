// services/threadFileService.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export interface ThreadFileContext {
  id: string;
  thread_id: string;
  file_id: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  relevance_score: number;
  last_used: string;
  usage_count: number;
  is_active: boolean;
  created_at: string;
}

export interface ActiveThreadFile {
  openai_file_id: string;
  filename: string;
  file_type: string;
  file_size: number;
  last_used: string;
  usage_count: number;
}

export class ThreadFileService {
  
  /**
   * Get all active files for a specific thread
   */
  static async getActiveThreadFiles(threadId: string): Promise<ActiveThreadFile[]> {
    try {
      const { data, error } = await supabase
        .from('thread_file_context')
        .select(`
          last_used,
          usage_count,
          file_context_tracking!inner(
            openai_file_id,
            original_filename,
            file_type,
            file_size
          )
        `)
        .eq('thread_id', threadId)
        .eq('is_active', true)
        .order('last_used', { ascending: false });

      if (error) {
        console.error('Error fetching active thread files:', error);
        return [];
      }

      return (data || []).map(item => {
        const fileContext = Array.isArray(item.file_context_tracking) 
          ? item.file_context_tracking[0] 
          : item.file_context_tracking;

        return {
          openai_file_id: fileContext?.openai_file_id || '',
          filename: fileContext?.original_filename || 'Unknown',
          file_type: fileContext?.file_type || 'unknown',
          file_size: fileContext?.file_size || 0,
          last_used: item.last_used,
          usage_count: item.usage_count
        };
      });

    } catch (error) {
      console.error('Error in getActiveThreadFiles:', error);
      return [];
    }
  }

  /**
   * Add a file to thread context (called after successful upload)
   */
  static async addFileToThread(
    threadId: string, 
    openaiFileId: string, 
    filename: string, 
    fileType: string,
    fileSize: number = 0
  ): Promise<boolean> {
    try {
      // First, check if file context tracking exists, if not create it
      let { data: fileContext, error: fetchError } = await supabase
        .from('file_context_tracking')
        .select('id')
        .eq('openai_file_id', openaiFileId)
        .maybeSingle();

      let fileContextId: string;

      if (fetchError || !fileContext) {
        // Create file context tracking entry
        const { data: newFileContext, error: insertError } = await supabase
          .from('file_context_tracking')
          .insert({
            openai_file_id: openaiFileId,
            original_filename: filename,
            file_type: fileType,
            file_size: fileSize,
            upload_timestamp: new Date().toISOString(),
            last_accessed: new Date().toISOString(),
            access_count: 1,
            relevance_score: 1.0
          })
          .select('id')
          .single();

        if (insertError) {
          console.error('Error creating file context tracking:', insertError);
          return false;
        }
        fileContextId = newFileContext.id;
      } else {
        fileContextId = fileContext.id;
      }

      // Check if thread-file association already exists
      const { data: existingAssociation } = await supabase
        .from('thread_file_context')
        .select('id, is_active')
        .eq('thread_id', threadId)
        .eq('file_id', fileContextId)
        .maybeSingle();

      if (existingAssociation) {
        // Reactivate if it was deactivated
        if (!existingAssociation.is_active) {
          const { error: updateError } = await supabase
            .from('thread_file_context')
            .update({
              is_active: true,
              last_used: new Date().toISOString(),
              usage_count: 1
            })
            .eq('id', existingAssociation.id);

          if (updateError) {
            console.error('Error reactivating thread file association:', updateError);
            return false;
          }
        }
        return true; // Already exists and active
      }

      // Create new thread-file association
      const { error: associationError } = await supabase
        .from('thread_file_context')
        .insert({
          thread_id: threadId,
          file_id: fileContextId,
          relevance_score: 1.0,
          last_used: new Date().toISOString(),
          usage_count: 1,
          is_active: true
        });

      if (associationError) {
        console.error('Error creating thread file association:', associationError);
        return false;
      }

      // Update thread's active file count
      await this.updateThreadFileCount(threadId);

      return true;

    } catch (error) {
      console.error('Error in addFileToThread:', error);
      return false;
    }
  }

  /**
   * Remove a file from thread context (mark as inactive)
   */
  static async removeFileFromThread(threadId: string, openaiFileId: string): Promise<boolean> {
    try {
      // Find the file context tracking record
      const { data: fileContext, error: fetchError } = await supabase
        .from('file_context_tracking')
        .select('id')
        .eq('openai_file_id', openaiFileId)
        .single();

      if (fetchError || !fileContext) {
        console.error('File context not found for removal:', openaiFileId);
        return false;
      }

      // Deactivate the thread-file association
      const { error: deactivateError } = await supabase
        .from('thread_file_context')
        .update({ 
          is_active: false,
          last_used: new Date().toISOString()
        })
        .eq('thread_id', threadId)
        .eq('file_id', fileContext.id);

      if (deactivateError) {
        console.error('Error deactivating thread file association:', deactivateError);
        return false;
      }

      // Update thread's active file count
      await this.updateThreadFileCount(threadId);

      return true;

    } catch (error) {
      console.error('Error in removeFileFromThread:', error);
      return false;
    }
  }

  /**
   * Update usage statistics for thread files (called when files are accessed)
   */
  static async updateFileUsage(threadId: string, openaiFileIds: string[]): Promise<void> {
    try {
      for (const openaiFileId of openaiFileIds) {
        // Get file context id and current counts
        const { data: fileContext } = await supabase
          .from('file_context_tracking')
          .select('id, access_count')
          .eq('openai_file_id', openaiFileId)
          .single();

        if (fileContext) {
          // Get current thread context data
          const { data: currentThreadData } = await supabase
            .from('thread_file_context')
            .select('usage_count')
            .eq('thread_id', threadId)
            .eq('file_id', fileContext.id)
            .single();

          // Update both file context tracking and thread file context
          await Promise.all([
            supabase
              .from('file_context_tracking')
              .update({
                last_accessed: new Date().toISOString(),
                access_count: (fileContext.access_count || 0) + 1
              })
              .eq('id', fileContext.id),
            
            supabase
              .from('thread_file_context')
              .update({
                last_used: new Date().toISOString(),
                usage_count: (currentThreadData?.usage_count || 0) + 1
              })
              .eq('thread_id', threadId)
              .eq('file_id', fileContext.id)
          ]);
        }
      }
    } catch (error) {
      console.error('Error updating file usage:', error);
    }
  }

  /**
   * Get detailed thread file context with metadata
   */
  static async getThreadFileContext(threadId: string): Promise<ThreadFileContext[]> {
    try {
      const { data, error } = await supabase
        .from('thread_file_context')
        .select(`
          id,
          thread_id,
          relevance_score,
          last_used,
          usage_count,
          is_active,
          created_at,
          file_context_tracking!inner(
            openai_file_id,
            original_filename,
            file_type,
            file_size
          )
        `)
        .eq('thread_id', threadId)
        .order('last_used', { ascending: false });

      if (error) {
        console.error('Error fetching thread file context:', error);
        return [];
      }

      return (data || []).map(item => {
        const fileContext = Array.isArray(item.file_context_tracking) 
          ? item.file_context_tracking[0] 
          : item.file_context_tracking;

        return {
          id: item.id,
          thread_id: item.thread_id,
          file_id: fileContext?.openai_file_id || '',
          original_filename: fileContext?.original_filename || 'Unknown',
          file_type: fileContext?.file_type || 'unknown',
          file_size: fileContext?.file_size || 0,
          relevance_score: item.relevance_score,
          last_used: item.last_used,
          usage_count: item.usage_count,
          is_active: item.is_active,
          created_at: item.created_at
        };
      });

    } catch (error) {
      console.error('Error in getThreadFileContext:', error);
      return [];
    }
  }

  /**
   * Update thread's active file count
   */
  private static async updateThreadFileCount(threadId: string): Promise<void> {
    try {
      // Count active files for this thread
      const { count } = await supabase
        .from('thread_file_context')
        .select('*', { count: 'exact', head: true })
        .eq('thread_id', threadId)
        .eq('is_active', true);

      // Update thread record
      const { error } = await supabase
        .from('threads')
        .upsert({
          id: threadId,
          active_file_count: count || 0,
          last_activity: new Date().toISOString()
        });

      if (error) {
        console.error('Error updating thread file count:', error);
      }

    } catch (error) {
      console.error('Error in updateThreadFileCount:', error);
    }
  }

  /**
   * Clean up orphaned file associations (utility function)
   */
  static async cleanupOrphanedFiles(): Promise<number> {
    try {
      // This would be called by a cleanup job to remove associations 
      // for files that no longer exist in OpenAI
      return 0;
    } catch (error) {
      console.error('Error in cleanupOrphanedFiles:', error);
      return 0;
    }
  }
}