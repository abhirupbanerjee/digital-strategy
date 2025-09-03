import { CONSTANTS } from '../types/constants';

export const handleFileUpload = async (
  files: FileList | null,
  onProgress: (uploading: boolean) => void,
  onSuccess: (fileIds: string[], files: File[]) => void,
  onError: (error: string) => void
): Promise<void> => {
  if (!files || files.length === 0) return;
  
  onProgress(true);
  const newFileIds: string[] = [];
  const successfulUploads: File[] = [];
  const oversizedFiles: string[] = [];
  const failedUploads: string[] = [];
  
  try {
    for (const file of Array.from(files)) {
      // Check file size before attempting upload
      if (file.size > CONSTANTS.MAX_FILE_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        oversizedFiles.push(`${file.name} (${sizeMB}MB)`);
        console.error(`File ${file.name} is ${sizeMB}MB, exceeds 4MB limit`);
        continue; // Skip this file
      }
      
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('purpose', 'assistants');
        
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          const error = await response.json();
          console.error(`Failed to upload ${file.name}:`, error.error);
          failedUploads.push(file.name);
          continue;
        }
        
        const data = await response.json();
        if (data.fileId) {
          newFileIds.push(data.fileId);
          successfulUploads.push(file);
          console.log(`Successfully uploaded: ${file.name}`);
        }
      } catch (err: any) {
        // Handle network errors including 413
        if (err.message?.includes('413') || err.message?.includes('Request Entity Too Large')) {
          const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
          oversizedFiles.push(`${file.name} (${sizeMB}MB)`);
          console.error(`File ${file.name} triggered 413 error`);
        } else {
          console.error(`Network error uploading ${file.name}:`, err);
          failedUploads.push(file.name);
        }
      }
    }
    
    // Provide comprehensive feedback based on results
    const totalFiles = Array.from(files).length;
    const hasOversized = oversizedFiles.length > 0;
    const hasSuccess = successfulUploads.length > 0;
    const hasFailed = failedUploads.length > 0;
    
    // Build detailed feedback messages
    const messages: string[] = [];
    
    // Success message
    if (hasSuccess) {
      if (successfulUploads.length === totalFiles) {
        // All files succeeded
        messages.push(`✅ All ${successfulUploads.length} file(s) uploaded successfully!`);
      } else {
        // Partial success
        messages.push(`✅ ${successfulUploads.length} of ${totalFiles} file(s) uploaded successfully`);
      }
      
      // Call success callback for successful uploads
      onSuccess(newFileIds, successfulUploads);
    }
    
    // Oversized files message
    if (hasOversized) {
      if (oversizedFiles.length === 1) {
        messages.push(`❌ File exceeds 4MB limit: ${oversizedFiles[0]}`);
        messages.push(`💡 Tip: Compress PDFs at smallpdf.com or split large documents`);
      } else {
        messages.push(`❌ ${oversizedFiles.length} file(s) exceed 4MB limit:`);
        oversizedFiles.forEach(file => messages.push(`   • ${file}`));
        messages.push(`💡 Tip: Compress or split these files to upload them`);
      }
    }
    
    // Failed uploads message (other errors)
    if (hasFailed) {
      if (failedUploads.length === 1) {
        messages.push(`⚠️ Failed to upload: ${failedUploads[0]}`);
      } else {
        messages.push(`⚠️ Failed to upload ${failedUploads.length} file(s):`);
        failedUploads.forEach(file => messages.push(`   • ${file}`));
      }
    }
    
    // Display appropriate messages
    if (hasOversized || hasFailed) {
      // Show error message if any files failed
      const errorMessage = messages.join('\n');
      onError(errorMessage);
    } else if (hasSuccess && messages.length > 0) {
      // If only success, you might want to show success message
      // This depends on your UI - you might have an onInfo callback
      console.log(messages.join('\n'));
    }
    
    // Log summary to console for debugging
    console.log(`Upload Summary: ${successfulUploads.length} succeeded, ${oversizedFiles.length} oversized, ${failedUploads.length} failed`);
    
  } catch (error: any) {
    console.error('Unexpected error in handleFileUpload:', error);
    onError(`Unexpected error: ${error.message}`);
  } finally {
    onProgress(false);
  }
};

export const getFileIcon = (file: any): string => {
  if (file.type === 'image' || file.type === 'image_url') return '🖼️';
  if (file.type?.includes('pdf')) return '📄';
  if (file.type?.includes('word') || file.type?.includes('document')) return '📝';
  if (file.type?.includes('powerpoint') || file.type?.includes('presentation')) return '📊';
  if (file.type?.includes('excel') || file.type?.includes('spreadsheet')) return '📈';
  if (file.type?.includes('csv')) return '📋';
  return '📎';
};

// Helper function to format file size
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

// Helper function to validate file before upload
export const validateFileBeforeUpload = (file: File): {
  valid: boolean;
  error?: string;
  warning?: string;
} => {
  const sizeMB = file.size / (1024 * 1024);
  
  // Check file size
  if (sizeMB > CONSTANTS.MAX_FILE_SIZE_MB) {
    return {
      valid: false,
      error: `File "${file.name}" is ${sizeMB.toFixed(1)}MB. Maximum allowed is ${CONSTANTS.MAX_FILE_SIZE_MB}MB.`,
    };
  }
  
  // Warning for files close to limit (>3.5MB)
  if (sizeMB > 3.5) {
    return {
      valid: true,
      warning: `File "${file.name}" is ${sizeMB.toFixed(1)}MB, close to the 4MB limit.`,
    };
  }
  
  return { valid: true };
};