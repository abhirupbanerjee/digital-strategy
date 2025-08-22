import { useState, useCallback } from 'react';
import { handleFileUpload } from '../utils/fileUtils';

export const useFileUpload = () => {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [fileIds, setFileIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const uploadFiles = useCallback(async (files: FileList | null) => {
    await handleFileUpload(
      files,
      setUploading,
      (newFileIds, newFiles) => {
        setFileIds(prev => [...prev, ...newFileIds]);
        setUploadedFiles(prev => [...prev, ...newFiles]);
      },
      (error) => {
        console.error('File upload error:', error);
      }
    );
  }, []);

  const removeFile = useCallback((index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    setFileIds(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearFiles = useCallback(() => {
    setUploadedFiles([]);
    setFileIds([]);
  }, []);

  return {
    uploadedFiles,
    fileIds,
    uploading,
    uploadFiles,
    removeFile,
    clearFiles
  };
};