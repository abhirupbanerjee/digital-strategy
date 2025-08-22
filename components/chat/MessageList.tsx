// components/chat/MessageList.tsx
import React, { useRef, useEffect, useState } from 'react';
import { Message } from '../../types/entities.types';
import { MessageItem } from './MessageItem';
import { TypingIndicator } from '../common/TypingIndicator';
import { JumpButtons } from '../common/JumpButtons';

interface MessageListProps {
  messages: Message[];
  typing?: boolean;
  isMobile?: boolean;
}

export const MessageList: React.FC<MessageListProps> = React.memo(({ 
  messages, 
  typing = false, 
  isMobile = false 
}) => {
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [showJumpButtons, setShowJumpButtons] = useState(false);

  // Scroll to bottom when messages change
  useEffect(() => {
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  // Handle scroll to show/hide jump buttons
  useEffect(() => {
    const chatContainer = chatContainerRef.current;
    if (!chatContainer) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = chatContainer;
      const isNearTop = scrollTop < 200;
      const isNearBottom = scrollTop + clientHeight > scrollHeight - 200;
      
      setShowJumpButtons(!isNearTop || !isNearBottom);
    };

    chatContainer.addEventListener('scroll', handleScroll);
    return () => chatContainer.removeEventListener('scroll', handleScroll);
  }, []);

  const jumpToTop = () => {
    chatContainerRef.current?.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const jumpToBottom = () => {
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  };

  return (
    <div className="flex-1 flex flex-col p-2 md:p-4 overflow-hidden">
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto ring-1 ring-gray-200 shadow-sm rounded-2xl bg-white p-4 md:p-5 space-y-4 pb-28 chat-container"
      >
        {messages.map((msg, index) => (
          <MessageItem 
            key={index} 
            message={msg} 
            index={index} 
            isMobile={isMobile} 
          />
        ))}

        {typing && <TypingIndicator />}
      </div>

      <JumpButtons
        onJumpToTop={jumpToTop}
        onJumpToBottom={jumpToBottom}
        visible={showJumpButtons && messages.length > 5}
      />
    </div>
  );
});

MessageList.displayName = 'MessageList';