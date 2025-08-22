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
  const [token, setToken] = useState<string>("");

  const chatContainerRef = useRef<HTMLDivElement>(null);

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
        timestamp: new Date().toLocaleString()
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
    }
  };

  if (loading || !token) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Loading shared thread...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔗</div>
          <h1 className="text-2xl font-bold mb-2">Share Link Issue</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">
            This link may have expired or been revoked.
          </p>
        </div>
      </div>
    );
  }

  if (!threadData) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <p>No thread data available</p>
        </div>
      </div>
    );
  }

  const isExpired = new Date(threadData.share.expires_at) < new Date();
  const canCollaborate = threadData.share.permissions === 'collaborate' && !isExpired;

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-white shadow-md border-b">
        <div className="flex items-center gap-3">
          {threadData.thread.project && (
            <div 
              className="w-4 h-4 rounded-full" 
              style={{ backgroundColor: threadData.thread.project.color || '#3b82f6' }}
            />
          )}
          <div>
            <h1 className="text-xl font-bold">{threadData.thread.title}</h1>
            {threadData.thread.project && (
              <p className="text-sm text-gray-600">
                From project: {threadData.thread.project.name}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            canCollaborate 
              ? 'bg-green-100 text-green-800' 
              : 'bg-blue-100 text-blue-800'
          }`}>
            {canCollaborate ? 'Collaborate' : 'View Only'}
          </span>
          
          <span className="text-xs text-gray-500">
            Expires: {new Date(threadData.share.expires_at).toLocaleDateString()}
          </span>
        </div>
      </header>

      {/* Chat Messages */}
      <div className="flex-1 flex flex-col">
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {threadData.thread.messages.length === 0 ? (
            <div className="text-center text-gray-500 mt-8">
              <div className="text-4xl mb-4">💬</div>
              <p>No messages in this conversation yet.</p>
              {canCollaborate && (
                <p className="text-sm mt-2">Start chatting below!</p>
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
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {msg.role === "user" ? "User" : 
                     msg.role === "system" ? "System" : "Digital Strategy Bot"}
                  </span>
                  {msg.timestamp && (
                    <span className="text-xs text-gray-500">({msg.timestamp})</span>
                  )}
                </div>
                
                <div className={`p-3 rounded-lg ${
                  msg.role === "user" ? "bg-gray-100" :
                  msg.role === "system" ? "bg-blue-50 border-blue-200" :
                  "bg-white border shadow-sm"
                }`}>
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ href, children, ...props }) => {
                          if (href?.startsWith('/api/files/')) {
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
                              className="text-blue-600 hover:text-blue-800 underline"
                              {...props}
                            >
                              {children}
                            </a>
                          );
                        },
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Input Area */}
        {canCollaborate ? (
          <div className="border-t p-4 bg-white">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Type your message..."
                className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={sending}
              />
              <button
                onClick={sendMessage}
                disabled={sending || !input.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? "..." : "Send"}
              </button>
            </div>
          </div>
        ) : (
          <div className="border-t p-4 bg-gray-50 text-center">
            <p className="text-sm text-gray-600">
              {isExpired ? "This share link has expired" : "View-only access - cannot send messages"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}