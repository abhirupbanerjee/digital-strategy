// components/chat/MessageItem.tsx

import React from 'react';
import { motion } from 'framer-motion';
import { Message } from '../../types/entities.types';
import { MarkdownMessage } from '../markdown/MarkdownMessage';
import { FileRenderer } from '../common/FileRenderer';

interface MessageItemProps {
  message: Message;
  index: number;
  isMobile?: boolean;
}

export const MessageItem: React.FC<MessageItemProps> = ({ 
  message, 
  index, 
  isMobile = false 
}) => {
  const getRoleName = (role: string) => {
    switch (role) {
      case "user": return "You";
      case "system": return "System";
      default: return "Digital Strategy Bot";
    }
  };

  const getMessageStyle = (role: string) => {
    switch (role) {
      case "user":
        return "bg-gray-200 text-black";
      case "system":
        return "bg-blue-50 text-blue-900 border-blue-200";
      default:
        return "bg-white text-black border";
    }
  };

  // Detect if message content contains tables
  const hasTableContent = React.useMemo(() => {
    if (typeof message.content !== 'string') return false;
    
    // Check for markdown table indicators
    const tablePatterns = [
      /\|.*\|.*\|/,  // Basic table row pattern
      /\|[\s]*:?-+:?[\s]*\|/,  // Table separator row
      /<table[\s\S]*<\/table>/i,  // HTML table
    ];
    
    return tablePatterns.some(pattern => pattern.test(message.content as string));
  }, [message.content]);

  // Dynamic overflow handling based on content
  const getOverflowClass = (role: string) => {
    const baseStyle = getMessageStyle(role);
    
    if (hasTableContent) {
      // Allow horizontal overflow for tables
      return `p-3 rounded-md overflow-y-hidden overflow-x-auto message-with-tables ${baseStyle}`;
    } else {
      // Maintain existing overflow behavior for other content
      return `p-3 rounded-md overflow-hidden ${baseStyle}`;
    }
  };

  return (
    <motion.div key={index}>
      <p className="font-bold mb-1 text-sm md:text-base">
        {getRoleName(message.role)}{" "}
        {message.timestamp && (
          <span className="text-xs text-gray-500">({message.timestamp})</span>
        )}
      </p>
      <div className={getOverflowClass(message.role)}>
        <MarkdownMessage 
          content={message.content} 
          className={hasTableContent ? "has-table-content" : ""} 
        />
        
        {message.files && message.files.length > 0 && (
          <div className="mt-3">
            {message.files.map((file, fileIndex) => {
              // Skip rendering if file is already linked in text content
              const isAlreadyLinkedInText = typeof message.content === 'string' && 
                message.content.includes(`/api/files/${file.file_id}`);
              
              if (isAlreadyLinkedInText) {
                return null;
              }
              
              return <FileRenderer key={fileIndex} file={file} isMobile={isMobile} />;
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
};