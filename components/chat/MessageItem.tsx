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

  return (
    <motion.div key={index}>
      <p className="font-bold mb-1 text-sm md:text-base">
        {getRoleName(message.role)}{" "}
        {message.timestamp && (
          <span className="text-xs text-gray-500">({message.timestamp})</span>
        )}
      </p>
      <div className={`p-3 rounded-md overflow-hidden ${getMessageStyle(message.role)}`}>
        <MarkdownMessage content={message.content} />
        
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