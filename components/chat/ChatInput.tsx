// components/chat/ChatInput.tsx
import React, { useState, useCallback } from 'react';
import { useFileUpload } from '../../hooks/useFileUpload';
import { getFileIcon } from '../../utils/fileUtils';

interface ChatInputProps {
  onSendMessage: (message: string, fileIds: string[]) => Promise<void>;
  disabled?: boolean;
  isMobile?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ 
  onSendMessage, 
  disabled = false, 
  isMobile = false 
}) => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { uploadedFiles, fileIds, uploading, uploadFiles, removeFile, clearFiles } = useFileUpload();

  const handleSend = useCallback(async () => {
    if (loading || !input.trim()) return;
    const messageToSend = input.trim();
    setInput('');
    setLoading(true);
    try {
      await onSendMessage(messageToSend, fileIds);
      
      clearFiles();
    } catch (error) {
      console.error('Send message error:', error);
    } finally {
      setLoading(false);
    }
  }, [input, fileIds, loading, onSendMessage, clearFiles]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    uploadFiles(e.target.files);
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  };

  return (
    <div className="p-3 md:p-4 bg-white/90 backdrop-blur border-t border-gray-200 z-40">
      <div className="flex flex-col gap-2">
        {/* File Upload Display */}
        {uploadedFiles.length > 0 && (
          <div className={`${isMobile ? 'bg-green-50 border border-green-200 rounded-md p-2' : 'flex flex-wrap gap-2 p-3 bg-green-50 border border-green-200 rounded-md'}`}>
            {isMobile ? (
              <>
                <div className="text-xs text-green-700 font-medium mb-1">
                  ✅ {uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''} ready:
                </div>
                <div className="flex gap-1 overflow-x-auto pb-1">
                  {uploadedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-1 px-2 py-1 bg-white border border-green-300 rounded text-xs whitespace-nowrap shadow-sm"
                    >
                      <span>{getFileIcon({ type: file.type })}</span>
                      <span className="max-w-[80px] truncate">{file.name}</span>
                      <button
                        onClick={() => removeFile(index)}
                        className="text-red-500 font-bold"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 w-full mb-2">
                  <span className="text-sm text-green-700 font-medium">
                    ✅ {uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''} ready to send:
                  </span>
                </div>
                {uploadedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-green-300 rounded-md text-sm shadow-sm"
                  >
                    <span className="text-green-600">{getFileIcon({ type: file.type })}</span>
                    <span className="max-w-[150px] truncate font-medium">{file.name}</span>
                    <span className="text-xs text-gray-500">
                      ({(file.size / 1024 / 1024).toFixed(1)}MB)
                    </span>
                    <button
                      onClick={() => removeFile(index)}
                      className="ml-2 text-red-500 hover:text-red-700 font-bold"
                      title="Remove file"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* Input Row */}
        <div className="flex items-end gap-2">
          <textarea
            className="flex-1 rounded-xl ring-1 ring-gray-100 px-3 py-2 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none min-h-[40px] max-h-[120px] overflow-y-auto"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              // Auto-resize textarea
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Shift+Enter for new line)"
            rows={1}
            disabled={disabled || loading}
          />

          {/* File Upload Button - Desktop only */}
          {!isMobile && (
            <>
              <input
                type="file"
                multiple
                onChange={handleFileInputChange}
                className="hidden"
                id="file-upload"
                accept=".txt,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.json,.xml,.html,.md,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff"
                disabled={uploading}
              />
              <label
                htmlFor="file-upload"
                className={`px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
                  uploading 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {uploading ? '⏳' : '📎'}
              </label>
            </>
          )}

          <button
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              loading || disabled
                ? 'bg-gray-300 text-gray-500' 
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
            onClick={handleSend}
            disabled={loading || disabled}
          >
            {loading ? (
              <span className="animate-pulse">...</span>
            ) : (
              <span>{isMobile ? '↗' : 'Send'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};