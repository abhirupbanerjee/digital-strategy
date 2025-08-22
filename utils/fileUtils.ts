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
  
  try {
    for (const file of Array.from(files)) {
      if (file.size > CONSTANTS.MAX_FILE_SIZE) {
        console.log(`File ${file.name} exceeds 20MB limit`);
        continue;
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
          continue;
        }
        
        const data = await response.json();
        if (data.fileId) {
          newFileIds.push(data.fileId);
          successfulUploads.push(file);
        }
      } catch (err) {
        console.error(`Network error uploading ${file.name}:`, err);
      }
    }
    
    if (successfulUploads.length > 0) {
      onSuccess(newFileIds, successfulUploads);
    }
    
  } catch (error: any) {
    onError(error.message);
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