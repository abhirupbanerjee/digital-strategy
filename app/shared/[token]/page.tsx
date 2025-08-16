// app/shared/[token]/page.tsx
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

interface ShareData {
  project: {
    id: string;
    name: string;
    description?: string;
    color?: string;
  };
  permissions: 'read' | 'collaborate';
  expires_at: string;
  threads: Array<{
    id: string;
    title: string;
    last_activity?: string;
  }>;
}

// Updated interface for Next.js 15 - params is now a Promise
interface PageProps {
  params: Promise<{ token: string }>;
}

export default function SharedProject({ params }: PageProps) {
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [token, setToken] = useState<string>("");

  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Extract token from params Promise
  useEffect(() => {
    const extractParams = async () => {
      const resolvedParams = await params;
      setToken(resolvedParams.token);
    };
    extractParams();
  }, [params]);

  // Load shared project when token is available
  useEffect(() => {
    if (token) {
      loadSharedProject();
    }
  }, [token]);

  useEffect(() => {
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const loadSharedProject = async () => {
    if (!token) return;

    try {
      const response = await fetch(`/api/shared/${token}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('Share link not found or expired');
        } else {
          setError('Failed to load shared project');
        }
        return;
      }

      const data = await response.json();
      setShareData(data);

      // Load first thread if available
      if (data.threads && data.threads.length > 0) {
        loadThread(data.threads[0].id);
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const loadThread = async (threadId: string) => {
    try {
      const response = await fetch(`/api/threads?threadId=${threadId}`);
      if (!response.ok) throw new Error('Failed to load thread');
      
      const data = await response.json();
      setMessages(data.messages || []);
      setActiveThreadId(threadId);
    } catch (err) {
      console.error('Load thread error:', err);
    }
  };

  const sendMessage = async () => {
    if (!shareData || shareData.permissions !== 'collaborate' || !input.trim() || sending) {
      return;
    }

    setSending(true);
    const userMessage = {
      role: "user",
      content: input,
      timestamp: new Date().toLocaleString()
    };

    setMessages(prev => [...prev, userMessage]);
    const messageContent = input;
    setInput("");

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageContent,
          threadId: activeThreadId,
          shareToken: token // Pass share token for validation
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }
      
      const data = await response.json();
      
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.reply || "No response received",
        timestamp: new Date().toLocaleString()
      }]);

      if (data.threadId && data.threadId !== activeThreadId) {
        setActiveThreadId(data.threadId);
      }

    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: "system",
        content: `Error: ${err.message || 'Failed to send message'}`,
        timestamp: new Date().toLocaleString()
      }]);
    } finally {
      setSending(false);
    }
  };

  if (loading || !token) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Loading shared project...</p>
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

  const isExpired = shareData && new Date(shareData.expires_at) < new Date();
  const canCollaborate = shareData?.permissions === 'collaborate' && !isExpired;

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-white shadow-md border-b">
        <div className="flex items-center gap-2">
          <div 
            className="w-4 h-4 rounded-full" 
            style={{ backgroundColor: shareData?.project.color || '#3b82f6' }}
          />
          <div>
            <h1 className="text-xl font-bold">{shareData?.project.name}</h1>
            {shareData?.project.description && (
              <p className="text-sm text-gray-600">{shareData.project.description}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            canCollaborate 
              ? 'bg-green-100 text-green-800' 
              : 'bg-blue-100 text-blue-800'
          }`}>
            {canCollaborate ? '✏️ Collaborate' : '👁️ View Only'}
          </span>
          
          {shareData && (
            <span className="text-xs text-gray-500">
              Expires: {new Date(shareData.expires_at).toLocaleDateString()}
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Threads Sidebar */}
        {shareData?.threads && shareData.threads.length > 0 && (
          <div className="w-64 bg-gray-50 border-r p-4">
            <h3 className="font-medium text-gray-700 mb-3">Conversations</h3>
            <div className="space-y-2">
              {shareData.threads.map((thread) => (
                <button
                  key={thread.id}
                  onClick={() => loadThread(thread.id)}
                  className={`w-full text-left p-2 rounded text-sm transition-colors ${
                    activeThreadId === thread.id
                      ? 'bg-blue-100 text-blue-800'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  <div className="font-medium truncate">{thread.title}</div>
                  {thread.last_activity && (
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(thread.last_activity).toLocaleDateString()}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Chat Messages */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4"
          >
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                <div className="text-4xl mb-4">💬</div>
                <p>No messages in this conversation yet.</p>
                {canCollaborate && (
                  <p className="text-sm mt-2">Start chatting below!</p>
                )}
              </div>
            ) : (
              messages.map((msg, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {msg.role === "user" ? "User" : 
                       msg.role === "system" ? "System" : "Assistant"}
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
    </div>
  );
}