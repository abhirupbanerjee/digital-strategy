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
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Load chat history from localStorage on component mount
  useEffect(() => {
    const savedMessages = localStorage.getItem("chatHistory");
    const savedThreadId = localStorage.getItem("threadId");
    
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
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  // Save chat history and thread ID in localStorage
  useEffect(() => {
    localStorage.setItem("chatHistory", JSON.stringify(messages));
    if (threadId) localStorage.setItem("threadId", threadId);
  }, [messages, threadId]);

  // Function to send user message and receive assistant response
// Replace your sendMessage function with this version
const sendMessage = async () => {
  if (activeRun || !input.trim()) return;

  setActiveRun(true);
  setLoading(true);

  const userMessage = {
    role: "user",
    content: input,
    timestamp: new Date().toLocaleString(),
  };
  setMessages((prev) => [...prev, userMessage]);
  const userInput = input;
  setInput("");

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
  }
};

  // Copy chat to clipboard
  const copyChatToClipboard = async () => {
    const chatText = messages
      .map((msg) => `${msg.timestamp} - ${msg.role === "user" ? "You" : "Grenada AI Assistant"}:\n${msg.content}`)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(chatText);
      alert("Chat copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy chat: ", err);
      alert("Failed to copy chat to clipboard.");
    }
  };

  return (
    <div className="h-screen w-full flex flex-col bg-white">
      {/* Header */}
      <header className="flex items-center justify-center w-full p-4 bg-white shadow-md">
        <img src="/icon.png" alt="Icon" className="h-12 w-12 sm:h-16 sm:w-16" />
        <h2 className="text-xl sm:text-2xl font-bold ml-2">Grenada AI Assistant</h2>
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
                {msg.role === "user" ? "You" : "Grenada AI Assistant"}{" "}
                {msg.timestamp && (
                  <span className="text-xs text-gray-500">({msg.timestamp})</span>
                )}
              </p>
              <div
                className={`p-3 rounded-md ${
                  msg.role === "user"
                    ? "bg-gray-200 text-black"
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
            <div className="text-gray-500 italic text-center p-2">Assistant is typing...</div>
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
            onClick={() => {
              setMessages([]);
              setThreadId(null);
              localStorage.removeItem("threadId");
              localStorage.removeItem("chatHistory");
            }}
          >
            Clear Chat
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatApp;