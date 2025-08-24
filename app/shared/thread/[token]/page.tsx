// app/shared/thread/[token]/page.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";
import remarkGfm from "remark-gfm";

interface Message {
  role: string;
  content: string;
  timestamp?: string;
  files?: any[];
}

interface SharedThreadData {
  thread: {
    id: string;
    title: string;
    messages: Message[];
    project: {
      id: string;
      name: string;
      description?: string;
      color?: string;
    } | null;
  };
  share: {
    permissions: 'read' | 'collaborate';
    expires_at: string;
    created_at: string;
  };
}

interface PageProps {
  params: Promise<{ token: string }>;
}

export default function SharedThread({ params }: PageProps) {
  const [threadData, setThreadData] = useState<SharedThreadData | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [token, setToken] = useState<string>("");
  const [isMobile, setIsMobile] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Check for mobile device
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Extract token from params
  useEffect(() => {
    const extractParams = async () => {
      const resolvedParams = await params;
      setToken(resolvedParams.token);
    };
    extractParams();
  }, [params]);

  // Load shared thread when token is available
  useEffect(() => {
    if (token) {
      loadSharedThread();
    }
  }, [token]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [threadData?.thread.messages]);

  const loadSharedThread = async () => {
    if (!token) return;

    try {
      const response = await fetch(`/api/shared/thread/${token}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('Share link not found');
        } else if (response.status === 410) {
          setError('Share link has expired');
        } else {
          setError('Failed to load shared thread');
        }
        return;
      }

      const data = await response.json();
      setThreadData(data);

    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!threadData || threadData.share.permissions !== 'collaborate' || !input.trim() || sending) {
      return;
    }

    setSending(true);
    setTyping(true);
    
    const userMessage = {
      role: "user",
      content: input,
      timestamp: new Date().toLocaleString()
    };

    // Optimistically add user message
    setThreadData(prev => prev ? {
      ...prev,
      thread: {
        ...prev.thread,
        messages: [...prev.thread.messages, userMessage]
      }
    } : null);

    const messageContent = input;
    setInput("");

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageContent,
          threadId: threadData.thread.id,
          shareToken: token // Pass share token for validation
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }
      
      const data = await response.json();
      
      // Add assistant response
      const assistantMessage = {
        role: "assistant",
        content: data.reply || "No response received",
        timestamp: new Date().toLocaleString(),
        files: data.files || []
      };

      setThreadData(prev => prev ? {
        ...prev,
        thread: {
          ...prev.thread,
          messages: [...prev.thread.messages, assistantMessage]
        }
      } : null);

    } catch (err: any) {
      // Add error message
      const errorMessage = {
        role: "system",
        content: `Error: ${err.message || 'Failed to send message'}`,
        timestamp: new Date().toLocaleString()
      };

      setThreadData(prev => prev ? {
        ...prev,
        thread: {
          ...prev.thread,
          messages: [...prev.thread.messages, errorMessage]
        }
      } : null);
    } finally {
      setSending(false);
      setTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

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

  const getFileIcon = (file: any): string => {
    if (file.type === 'image' || file.type === 'image_url') return '🖼️';
    if (file.type?.includes('pdf')) return '📄';
    if (file.type?.includes('word') || file.type?.includes('document')) return '📝';
    if (file.type?.includes('powerpoint') || file.type?.includes('presentation')) return '📊';
    if (file.type?.includes('excel') || file.type?.includes('spreadsheet')) return '📈';
    if (file.type?.includes('csv')) return '📋';
    return '📎';
  };

  // Loading state
  if (loading || !token) {
    return (
      <div className="h-[100svh] md:h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading shared conversation...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-[100svh] md:h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-6xl mb-4">🔗</div>
          <h1 className="text-2xl font-bold mb-4 text-gray-900">Share Link Issue</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">
            This link may have expired or been revoked. Please contact the person who shared this conversation for a new link.
          </p>
        </div>
      </div>
    );
  }

  // No data state
  if (!threadData) {
    return (
      <div className="h-[100svh] md:h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <p className="text-gray-600">No conversation data available</p>
        </div>
      </div>
    );
  }

  const isExpired = new Date(threadData.share.expires_at) < new Date();
  const canCollaborate = threadData.share.permissions === 'collaborate' && !isExpired;

  return (
    <div className="h-[100svh] md:h-screen w-full flex flex-col bg-neutral-50 overflow-hidden">
      {/* Header matching main app */}
      <header className="sticky top-0 z-40 w-full p-3 md:p-4 bg-white/80 backdrop-blur border-b border-gray-200">
        <div className="relative flex items-center justify-between">
          {/* App branding like main app */}
          <div className="flex items-center gap-2">
            <img src="/icon.png" alt="Icon" className="h-8 w-8 md:h-10 md:w-10" />
            <h2 className="font-semibold tracking-tight text-gray-900 text-lg md:text-xl">
              Digital Strategy Bot
            </h2>
          </div>

          {/* Center title */}
          <div className="absolute left-1/2 -translate-x-1/2 text-center">
            <div className="font-medium text-sm md:text-base truncate max-w-xs md:max-w-md">
              {threadData.thread.title}
            </div>
            {threadData.thread.project && (
              <div className="text-xs text-gray-500 truncate max-w-xs md:max-w-md">
                {threadData.thread.project.name}
              </div>
            )}
          </div>

          {/* Status indicators */}
          <div className="flex items-center gap-2">
            <span className={`px-2 md:px-3 py-1 rounded-full text-xs md:text-sm font-medium ${
              canCollaborate 
                ? 'bg-green-100 text-green-800' 
                : 'bg-blue-100 text-blue-800'
            }`}>
              {canCollaborate ? (isMobile ? '✏️' : '✏️ Collaborate') : (isMobile ? '👁️' : '👁️ View Only')}
            </span>
            {!isMobile && (
              <span className="text-xs text-gray-500">
                Expires: {new Date(threadData.share.expires_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Messages - matching main app MessageList */}
      <div className="flex-1 flex flex-col p-2 md:p-4 overflow-hidden">
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto ring-1 ring-gray-200 shadow-sm rounded-2xl bg-white p-4 md:p-5 space-y-4 pb-8 chat-container"
        >
          {threadData.thread.messages.length === 0 ? (
            <div className="text-center text-gray-500 mt-8">
              <div className="text-4xl mb-4">💬</div>
              <p className="text-lg mb-2">Shared Conversation</p>
              <p className="text-sm">No messages in this conversation yet.</p>
              {canCollaborate && (
                <p className="text-sm mt-2 text-blue-600">Start chatting below to collaborate!</p>
              )}
            </div>
          ) : (
            threadData.thread.messages.map((msg, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2"
              >
                <p className="font-bold mb-1 text-sm md:text-base">
                  {getRoleName(msg.role)}{" "}
                  {msg.timestamp && (
                    <span className="text-xs text-gray-500">({msg.timestamp})</span>
                  )}
                </p>
                
                <div className={`p-3 rounded-md overflow-hidden ${getMessageStyle(msg.role)}`}>
                  <div className="message-content">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ children, ...props }) => (
                          <h1 className="text-xl md:text-2xl font-bold mt-4 md:mt-6 mb-3 md:mb-4 text-gray-900" {...props}>
                            {children}
                          </h1>
                        ),
                        h2: ({ children, ...props }) => (
                          <h2 className="text-lg md:text-xl font-semibold mt-3 md:mt-5 mb-2 md:mb-3 text-gray-800" {...props}>
                            {children}
                          </h2>
                        ),
                        h3: ({ children, ...props }) => (
                          <h3 className="text-base md:text-lg font-semibold mt-3 md:mt-4 mb-2 text-gray-800" {...props}>
                            {children}
                          </h3>
                        ),
                        p: ({ children, ...props }) => (
                          <p className="mb-3 md:mb-4 leading-relaxed text-sm md:text-base text-gray-700" {...props}>
                            {children}
                          </p>
                        ),
                        a: ({ href, children, ...props }) => {
                          const isFileDownload = href?.startsWith('/api/files/');
                          const isCitation = href?.startsWith('http');
                          
                          if (isFileDownload) {
                            return (
                              <a 
                                href={href}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 underline"
                                {...props}
                              >
                                {children}
                              </a>
                            );
                          }
                          
                          return (
                            <a 
                              href={href} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className={isCitation 
                                ? "text-blue-600 hover:text-blue-800 underline decoration-1 hover:decoration-2 transition-colors"
                                : "text-blue-600 hover:text-blue-800 underline"
                              }
                              {...props}
                            >
                              {children}
                              {isCitation && <span className="text-xs ml-1">↗</span>}
                            </a>
                          );
                        },
                        code: ({ inline, className, children, ...props }: any) => {
                          return inline ? (
                            <code className="bg-gray-100 text-red-600 px-1 py-0.5 rounded text-xs md:text-sm font-mono" {...props}>
                              {children}
                            </code>
                          ) : (
                            <div className="my-3 md:my-4">
                              <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 md:p-4 overflow-x-auto text-xs md:text-sm">
                                <code className={className} {...props}>
                                  {children}
                                </code>
                              </pre>
                            </div>
                          );
                        },
                        ul: ({ children, ...props }) => (
                          <ul className="list-disc pl-5 md:pl-6 mb-3 md:mb-4 space-y-1 md:space-y-2 text-sm md:text-base" {...props}>
                            {children}
                          </ul>
                        ),
                        ol: ({ children, ...props }) => (
                          <ol className="list-decimal pl-5 md:pl-6 mb-3 md:mb-4 space-y-1 md:space-y-2 text-sm md:text-base" {...props}>
                            {children}
                          </ol>
                        ),
                        li: ({ children, ...props }) => (
                          <li className="text-gray-700 leading-relaxed text-sm md:text-base" {...props}>
                            {children}
                          </li>
                        ),
                        table: ({ children, ...props }) => (
                          <div className="table-scroll-container my-4">
                            <table className="min-w-full" {...props}>
                              {children}
                            </table>
                          </div>
                        ),
                        blockquote: ({ children, ...props }) => (
                          <blockquote className="border-l-4 border-gray-300 pl-3 md:pl-4 py-2 mb-3 md:mb-4 italic text-gray-600 text-sm md:text-base" {...props}>
                            {children}
                          </blockquote>
                        ),
                        strong: ({ children, ...props }) => (
                          <strong className="font-semibold text-gray-900" {...props}>
                            {children}
                          </strong>
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                  
                  {/* File rendering */}
                  {msg.files && msg.files.length > 0 && (
                    <div className="mt-3">
                      {msg.files.map((file, fileIndex) => (
                        <div key={fileIndex} className="border rounded-lg p-3 mb-2 bg-gray-50">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {getFileIcon(file)} {file.description}
                            </span>
                            <div className="flex gap-2">
                              {file.type === 'image' && (
                                <button 
                                  onClick={() => window.open(file.url || `/api/files/${file.file_id}?preview=true`, '_blank')}
                                  className="text-blue-600 text-sm px-2 py-1 border rounded hover:bg-blue-50"
                                >
                                  👁️ Preview
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  const url = file.url || `/api/files/${file.file_id}`;
                                  const link = document.createElement('a');
                                  link.href = url;
                                  link.download = file.description || 'download';
                                  link.target = '_blank';
                                  link.rel = 'noopener noreferrer';
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                }}
                                className="text-blue-600 text-sm px-2 py-1 border rounded hover:bg-blue-50"
                              >
                                ⬇️ {isMobile ? 'Get' : 'Download'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}

          {/* Typing indicator */}
          {typing && (
            <div className="flex items-center gap-2 text-gray-500 italic p-2">
              <span className="flex gap-1">
                <span className="animate-bounce" style={{ animationDelay: '0ms' }}>●</span>
                <span className="animate-bounce" style={{ animationDelay: '150ms' }}>●</span>
                <span className="animate-bounce" style={{ animationDelay: '300ms' }}>●</span>
              </span>
              <span className="text-sm">Assistant is typing...</span>
            </div>
          )}
        </div>
      </div>

      {/* Input Area - matching main app ChatInput */}
      {canCollaborate ? (
        <div className="p-3 md:p-4 bg-white/90 backdrop-blur border-t border-gray-200 z-40">
          <div className="flex flex-col gap-2">
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
                disabled={sending}
              />

              <button
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  sending || !input.trim()
                    ? 'bg-gray-300 text-gray-500' 
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
                onClick={sendMessage}
                disabled={sending || !input.trim()}
              >
                {sending ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  <span>{isMobile ? '↗' : 'Send'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="border-t p-4 bg-gray-50 text-center">
          <p className="text-sm text-gray-600">
            {isExpired 
              ? "⏰ This share link has expired" 
              : "👁️ View-only access - cannot send messages"
            }
          </p>
          {isExpired && (
            <p className="text-xs text-gray-500 mt-1">
              Please request a new share link to collaborate
            </p>
          )}
        </div>
      )}
    </div>
  );
}