"use client";

// Import necessary libraries and modules
import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";
import remarkGfm from "remark-gfm";

// Define Message type
interface Message {
  role: string;
  content: string;
  timestamp?: string;
  fileIds?: string[]; // Track file IDs associated with messages
}

// Main ChatApp component
const ChatApp = () => {
  // Define States
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeRun, setActiveRun] = useState(false);
  const [typing, setTyping] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [fileIds, setFileIds] = useState<string[]>([]);
  const [searchInProgress, setSearchInProgress] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load chat history from localStorage on component mount
  useEffect(() => {
    const savedMessages = localStorage.getItem("chatHistory");
    const savedThreadId = localStorage.getItem("threadId");
    const savedWebSearch = localStorage.getItem("webSearchEnabled");
    
    if (savedMessages) {
      try {
        setMessages(JSON.parse(savedMessages));
      } catch (error) {
        console.error("Error parsing saved messages:", error);
      }
    }
    
    if (savedThreadId) {
      setThreadId(savedThreadId);
    }

    if (savedWebSearch) {
      setWebSearchEnabled(savedWebSearch === 'true');
    }
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  // Save chat history and settings in localStorage
  useEffect(() => {
    localStorage.setItem("chatHistory", JSON.stringify(messages));
    if (threadId) localStorage.setItem("threadId", threadId);
    localStorage.setItem("webSearchEnabled", String(webSearchEnabled));
  }, [messages, threadId, webSearchEnabled]);

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadingFile(true);
    const newFileIds: string[] = [];
    const successfulUploads: File[] = [];
    const failedUploads: string[] = [];

    try {
      for (const file of Array.from(files)) {
        // Validate file size (512MB limit)
        const MAX_SIZE = 512 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
          failedUploads.push(`${file.name} (exceeds 512MB)`);
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('purpose', 'assistants');

        try {
          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const error = await response.json();
            failedUploads.push(`${file.name} (${error.error || 'upload failed'})`);
            continue;
          }

          const data = await response.json();
          if (data.fileId) {
            newFileIds.push(data.fileId);
            successfulUploads.push(file);
          }
        } catch (err) {
          failedUploads.push(`${file.name} (network error)`);
        }
      }

      // Update state with successful uploads
      if (successfulUploads.length > 0) {
        setFileIds(prev => [...prev, ...newFileIds]);
        setUploadedFiles(prev => [...prev, ...successfulUploads]);
        
        // Add success message
        setMessages(prev => [...prev, {
          role: "system",
          content: `✅ Successfully uploaded ${successfulUploads.length} file(s): ${successfulUploads.map(f => f.name).join(', ')}`,
          timestamp: new Date().toLocaleString()
        }]);
      }

      // Show failed uploads if any
      if (failedUploads.length > 0) {
        setMessages(prev => [...prev, {
          role: "system",
          content: `❌ Failed to upload: ${failedUploads.join(', ')}`,
          timestamp: new Date().toLocaleString()
        }]);
      }

    } catch (error: any) {
      console.error("File upload error:", error);
      setMessages(prev => [...prev, {
        role: "system",
        content: `❌ Error uploading files: ${error.message}`,
        timestamp: new Date().toLocaleString()
      }]);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Remove individual file
  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    setFileIds(prev => prev.filter((_, i) => i !== index));
  };

  // Function to send user message and receive assistant response
  const sendMessage = async () => {
    if (activeRun || !input.trim()) return;

    setActiveRun(true);
    setLoading(true);
    
    // Set search indicator if web search is enabled
    if (webSearchEnabled) {
      setSearchInProgress(true);
    }

    const userMessage = {
      role: "user",
      content: input,
      timestamp: new Date().toLocaleString(),
      fileIds: fileIds.length > 0 ? [...fileIds] : undefined
    };
    setMessages((prev) => [...prev, userMessage]);
    const userInput = input;
    setInput("");

    // Show search indicator message if enabled
    if (webSearchEnabled) {
      setMessages(prev => [...prev, {
        role: "system",
        content: "🔍 Searching the web for current information...",
        timestamp: new Date().toLocaleString()
      }]);
    }

    try {
      setTyping(true);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userInput,
          threadId: threadId,
          webSearchEnabled: webSearchEnabled,
          fileIds: fileIds.length > 0 ? fileIds : undefined
        }),
      });

      // Check if response is ok first
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Get the response as text first to check if it's empty
      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse JSON response:', responseText);
        throw new Error('Invalid JSON response from server');
      }

      // Check if the parsed data has an error
      if (data.error) {
        throw new Error(data.error);
      }

      // Update thread ID if we got a new one
      if (data.threadId && data.threadId !== threadId) {
        setThreadId(data.threadId);
      }

      // Remove search indicator message
      if (webSearchEnabled) {
        setMessages(prev => prev.filter(msg => 
          !(msg.role === "system" && msg.content.includes("Searching the web"))
        ));
      }

      // Clear file IDs after successful message
      if (fileIds.length > 0) {
        setFileIds([]);
        setUploadedFiles([]);
      }

      // Add assistant response to messages
      setMessages((prev) => [
        ...prev,
        { 
          role: "assistant", 
          content: data.reply || "No response received", 
          timestamp: new Date().toLocaleString() 
        },
      ]);

    } catch (error: any) {
      console.error("Error:", error);
      
      // Remove search indicator on error
      if (webSearchEnabled) {
        setMessages(prev => prev.filter(msg => 
          !(msg.role === "system" && msg.content.includes("Searching the web"))
        ));
      }
      
      let errorMessage = "Unable to reach assistant.";
      
      if (error.message) {
        errorMessage = error.message;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${errorMessage}`,
          timestamp: new Date().toLocaleString(),
        },
      ]);
    } finally {
      setTyping(false);
      setLoading(false);
      setActiveRun(false);
      setSearchInProgress(false);
    }
  };

  // Copy chat to clipboard
  const copyChatToClipboard = async () => {
    const chatText = messages
      .map((msg) => `${msg.timestamp} - ${msg.role === "user" ? "You" : msg.role === "system" ? "System" : "Digital Strategy Assistant"}:\n${msg.content}`)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(chatText);
      alert("Chat copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy chat: ", err);
      alert("Failed to copy chat to clipboard.");
    }
  };

  // Clear all data
  const clearChat = () => {
    setMessages([]);
    setThreadId(null);
    setFileIds([]);
    setUploadedFiles([]);
    localStorage.removeItem("threadId");
    localStorage.removeItem("chatHistory");
  };

  return (
    <div className="h-screen w-full flex flex-col bg-white">
      {/* Header */}
      <header className="flex items-center justify-center w-full p-4 bg-white shadow-md">
        <img src="/icon.png" alt="Icon" className="h-12 w-12 sm:h-16 sm:w-16" />
        <h2 className="text-xl sm:text-2xl font-bold ml-2">Digital Strategy Assistant</h2>
      </header>

      {/* Chat Container */}
      <div className="flex-grow w-full max-w-4xl mx-auto flex flex-col p-4">
        <div
          ref={chatContainerRef}
          className="flex-grow overflow-y-auto border p-3 space-y-4 bg-white shadow rounded-lg h-[65vh] sm:h-[70vh]"
        >
          {messages.map((msg, index) => (
            <motion.div key={index}>
              <p className="font-bold mb-1">
                {msg.role === "user" ? "You" : msg.role === "system" ? "System" : "Digital Strategy Assistant"}{" "}
                {msg.timestamp && (
                  <span className="text-xs text-gray-500">({msg.timestamp})</span>
                )}
              </p>
              <div
                className={`p-3 rounded-md ${
                  msg.role === "user"
                    ? "bg-gray-200 text-black"
                    : msg.role === "system"
                    ? "bg-blue-50 text-blue-900 border-blue-200"
                    : "bg-white text-black border"
                }`}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ ...props }) => (
                      <h1 style={{ fontFamily: "'Segoe UI', sans-serif", fontSize: "1.75rem", fontWeight: "bold", margin: "1rem 0" }} {...props} />
                    ),
                    h2: ({ ...props }) => (
                      <h2 style={{ fontFamily: "'Segoe UI', sans-serif", fontSize: "1.5rem", fontWeight: "bold", margin: "1rem 0" }} {...props} />
                    ),
                    h3: ({ ...props }) => (
                      <h3 style={{ fontFamily: "'Segoe UI', sans-serif", fontSize: "1.25rem", fontWeight: "bold", margin: "1rem 0" }} {...props} />
                    ),
                    code: ({ ...props }) => (
                      <code style={{ fontFamily: "'Segoe UI', sans-serif", background: "#f3f4f6", padding: "0.2rem 0.4rem", borderRadius: "4px" }} {...props} />
                    ),
                    p: ({ node, ...props }) => (
                      <p style={{ marginBottom: "0.75rem", lineHeight: "1.6", fontFamily: "'Segoe UI', sans-serif", fontSize: "16px" }} {...props} />
                    ),
                    ul: ({ node, ...props }) => (
                      <ul style={{ listStyleType: "disc", paddingLeft: "1.5rem", marginBottom: "1rem" }} {...props} />
                    ),
                    ol: ({ node, ...props }) => (
                      <ol style={{ listStyleType: "decimal", paddingLeft: "1.5rem", marginBottom: "1rem" }} {...props} />
                    ),
                    li: ({ node, ...props }) => (
                      <li style={{ marginBottom: "0.4rem" }} {...props} />
                    ),
                    table: ({ node, ...props }) => (
                      <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: "1rem" }} {...props} />
                    ),
                    th: ({ node, ...props }) => (
                      <th style={{ border: "1px solid #ccc", background: "#f3f4f6", padding: "8px", textAlign: "left" }} {...props} />
                    ),
                    td: ({ node, ...props }) => (
                      <td style={{ border: "1px solid #ccc", padding: "8px", textAlign: "left" }} {...props} />
                    ),
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
            </motion.div>
          ))}
          {/* Typing Indicator */}
          {typing && (
            <div className="flex items-center gap-2 text-gray-500 italic p-2">
              <span className="flex gap-1">
                <span className="animate-bounce" style={{ animationDelay: '0ms' }}>●</span>
                <span className="animate-bounce" style={{ animationDelay: '150ms' }}>●</span>
                <span className="animate-bounce" style={{ animationDelay: '300ms' }}>●</span>
              </span>
              <span>Assistant is typing...</span>
            </div>
          )}
        </div>
      </div>

      {/* Settings & Features Bar */}
      <div className="w-full max-w-4xl mx-auto px-4 pb-2">
        <div className="flex flex-col gap-2 border-t pt-3">
          {/* Feature Toggles */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Web Search Toggle */}
              <label className="flex items-center cursor-pointer group">
                <input
                  type="checkbox"
                  checked={webSearchEnabled}
                  onChange={(e) => setWebSearchEnabled(e.target.checked)}
                  className="mr-2 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm flex items-center gap-1">
                  {searchInProgress ? (
                    <span className="animate-pulse">🔍</span>
                  ) : (
                    <span>🔍</span>
                  )}
                  Web Search
                  {webSearchEnabled && (
                    <span className="text-xs text-green-600 font-semibold">ON</span>
                  )}
                </span>
              </label>

              {/* File Upload */}
              <div className="flex items-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  accept=".txt,.pdf,.doc,.docx,.xls,.xlsx,.csv,.json,.xml,.html,.md"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
                >
                  {uploadingFile ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Uploading...
                    </>
                  ) : (
                    <>
                      📎 Attach Files
                      <span className="text-xs text-gray-500">(Max 512MB)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Status Indicators */}
            <div className="flex items-center gap-3 text-sm">
              {webSearchEnabled && (
                <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs">
                  Tavily Search Active
                </span>
              )}
              {threadId && (
                <span className="text-xs text-gray-500">
                  Session: {threadId.substring(0, 8)}...
                </span>
              )}
            </div>
          </div>

          {/* Uploaded Files Display */}
          {uploadedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 p-2 bg-gray-50 rounded-md">
              <span className="text-sm text-gray-600 font-medium">Attached:</span>
              {uploadedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded-md text-sm"
                >
                  <span>📄</span>
                  <span className="max-w-[150px] truncate">{file.name}</span>
                  <span className="text-xs text-gray-500">
                    ({(file.size / 1024).toFixed(1)}KB)
                  </span>
                  <button
                    onClick={() => removeFile(index)}
                    className="ml-1 text-red-500 hover:text-red-700"
                    title="Remove file"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  setUploadedFiles([]);
                  setFileIds([]);
                }}
                className="text-xs text-red-600 hover:text-red-700"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Input & Controls */}
      <div className="w-full max-w-4xl mx-auto p-4 flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <input
            className="border rounded p-3 w-full sm:w-4/5"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type a message..."
          />
          <button
            className="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded w-full sm:w-1/5"
            onClick={sendMessage}
            disabled={loading}
          >
            {loading ? "..." : "Send"}
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            className="bg-yellow-500 hover:bg-yellow-600 text-white p-3 rounded w-full"
            onClick={copyChatToClipboard}
          >
            Copy Chat
          </button>
          <button
            className="bg-red-400 hover:bg-red-500 text-white p-3 rounded w-full"
            onClick={clearChat}
          >
            Clear Chat
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatApp;