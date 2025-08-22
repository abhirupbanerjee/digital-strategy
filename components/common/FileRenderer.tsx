// components/common/FileRenderer.tsx
import React from 'react';
import { MessageFile } from '../../types/entities.types';
import { getFileIcon } from '../../utils/fileUtils';

interface FileRendererProps {
  file: MessageFile;
  isMobile?: boolean;
}

export const FileRenderer: React.FC<FileRendererProps> = ({ file, isMobile = false }) => {
  const isImage = file.type === 'image' || file.type === 'image_url';
  const downloadUrl = file.file_id ? `/api/files/${file.file_id}` : file.url;
  const previewUrl = file.file_id ? `/api/files/${file.file_id}?preview=true` : file.url;
  
const handleDownload = (e: React.MouseEvent) => {
  e.preventDefault();

  const url = downloadUrl?.trim();
  if (!url) {
    console.error('No download URL available');
    return; // stop early if undefined/empty
  }

  const link = document.createElement('a');
  link.href = url; // now definitely a string
  link.download = (file?.description?.trim() || 'download');
  link.target = '_blank';
  link.rel = 'noopener noreferrer';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Optional: clean up blob URLs
  if (url.startsWith('blob:')) {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
};


  return (
    <div className="border rounded-lg p-3 mb-2 bg-gray-50">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {getFileIcon(file)} {file.description}
        </span>
        <div className="flex gap-2">
          {isImage && (
            <button 
              onClick={() => window.open(previewUrl, '_blank')}
              className="text-blue-600 text-sm px-2 py-1 border rounded hover:bg-blue-50"
            >
              👁️ Preview
            </button>
          )}
          <button
            onClick={handleDownload}
            className="text-blue-600 text-sm px-2 py-1 border rounded hover:bg-blue-50"
          >
            ⬇️ {isMobile ? 'Open' : 'Download'}
          </button>
        </div>
      </div>
      {isImage && (
        <div className="mt-2">
          <img 
            src={previewUrl} 
            alt={file.description}
            className="max-w-full h-auto max-h-64 rounded border"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      )}
    </div>
  );
};