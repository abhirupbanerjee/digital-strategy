import React from 'react';

export const TypingIndicator: React.FC = () => (
  <div className="flex items-center gap-2 text-gray-500 italic p-2">
    <span className="flex gap-1">
      <span className="animate-bounce" style={{ animationDelay: '0ms' }}>●</span>
      <span className="animate-bounce" style={{ animationDelay: '150ms' }}>●</span>
      <span className="animate-bounce" style={{ animationDelay: '300ms' }}>●</span>
    </span>
    <span className="text-sm">Assistant is typing...</span>
  </div>
);