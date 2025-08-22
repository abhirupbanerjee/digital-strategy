import { useState, useCallback } from 'react';
import { Message, ChatResponse } from '../types/entities.types';
import { ChatService } from '../services/chatService';
import { formatErrorMessage, logError } from '../utils/errorHandler';
import { CONSTANTS } from '../types/constants';

export const useChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [activeRun, setActiveRun] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);

  const sendMessage = useCallback(async (
    input: string,
    webSearchEnabled: boolean = false,
    fileIds: string[] = []
  ): Promise<ChatResponse> => {
    if (activeRun || !input.trim()) {
      throw new Error('Cannot send message while processing or with empty input');
    }

    setActiveRun(true);
    setLoading(true);
    setTyping(true);

    const userMessage: Message = {
      role: "user",
      content: input,
      timestamp: new Date().toLocaleString(),
      fileIds: fileIds.length > 0 ? fileIds : undefined
    };

    setMessages(prev => [...prev, userMessage]);

    // Show search indicator if web search is enabled
    if (webSearchEnabled) {
      setMessages(prev => [
        ...prev,
        {
          role: "system",
          content: `🔍 Searching the web for current information... ${CONSTANTS.SEARCH_FLAG}`,
          timestamp: new Date().toLocaleString(),
        }
      ]);
    }

    try {
      const response = await ChatService.sendMessage({
        message: input,
        originalMessage: input,
        threadId,
        webSearchEnabled,
        fileIds: fileIds.length > 0 ? fileIds : undefined
      });

      // Remove search indicator
      if (webSearchEnabled) {
        setMessages(prev => prev.filter(msg =>
          !(msg.role === "system" && typeof msg.content === 'string' && msg.content.includes(CONSTANTS.SEARCH_FLAG))
        ));
      }

      // Update thread ID if new
      if (response.threadId && response.threadId !== threadId) {
        setThreadId(response.threadId);
      }

      // Clean the response to remove any search context
      let cleanReply = response.reply || "No response received";
      cleanReply = cleanReply.replace(/\[Current Web Information[^\]]*\]:\s*/gi, '');
      cleanReply = cleanReply.replace(/Web Summary:\s*[^\n]*\n/gi, '');
      cleanReply = cleanReply.replace(/Top Search Results:\s*\n[\s\S]*?Instructions:[^\n]*\n/gi, '');
      cleanReply = cleanReply.replace(/Instructions: Please incorporate this current web information[^\n]*\n?/gi, '');

      const assistantMessage: Message = {
        role: "assistant",
        content: cleanReply,
        files: response.files,
        timestamp: new Date().toLocaleString()
      };

      setMessages(prev => [...prev, assistantMessage]);

      return response;
    } catch (error) {
      // Remove search indicator on error
      if (webSearchEnabled) {
        setMessages(prev => prev.filter(msg =>
          !(msg.role === "system" && typeof msg.content === 'string' && msg.content.includes(CONSTANTS.SEARCH_FLAG))
        ));
      }

      const errorMessage = formatErrorMessage(error);
      logError(error, 'Send message');

      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${errorMessage}`,
          timestamp: new Date().toLocaleString(),
        },
      ]);

      throw error;
    } finally {
      setTyping(false);
      setLoading(false);
      setActiveRun(false);
    }
  }, [activeRun, threadId]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setThreadId(null);
  }, []);

  const setMessagesFromThread = useCallback((threadMessages: Message[]) => {
    setMessages(threadMessages);
  }, []);

  return {
    messages,
    loading,
    typing,
    activeRun,
    threadId,
    setThreadId,
    setMessages,
    sendMessage,
    clearChat,
    setMessagesFromThread
  };
};
