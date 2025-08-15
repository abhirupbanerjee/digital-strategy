"use client";

import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import remarkGfm from "remark-gfm";

// Define types
interface Message {
  role: string;
  content: string;
  timestamp?: string;
  fileIds?: string[];
}

interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  threads: string[];
  color?: string;
}

interface Thread {
  id: string;
  projectId?: string;
  title: string;
  lastMessage?: string;
  createdAt: string;
}

const ChatApp = () => {
  // States
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
  const [formatPreference, setFormatPreference] = useState<'default' | 'bullets' | 'table'>('default');
  // Project Management States
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [showProjectPanel, setShowProjectPanel] = useState(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  // Mobile UI States
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check for mobile device
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initial load from API
  useEffect(() => {
  fetch('/api/projects')
    .then(res => res.json())
    .then(data => {
      // Even if no projects, show sidebar on desktop
      setProjects(data.projects || []);
      // Auto-create first project if none exist
      if (!data.projects || data.projects.length === 0) {
        // Optional: Create default project
        createProject();
      }
    })
    .catch(err => console.error('Error loading projects:', err));
}, []);


  // Scroll to bottom when messages change
  useEffect(() => {
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  // Project Management Functions
  const createProject = async () => {
  if (!newProjectName.trim()) return;
  try {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newProjectName,
        description: newProjectDescription,
        color: `#${Math.floor(Math.random()*16777215).toString(16)}`
      })
    });
    if (!res.ok) throw new Error('Failed to create project');
    const created = await res.json(); // canonical server record
    setProjects(prev => [...prev, created]);
    setCurrentProject(created);
    setNewProjectName('');
    setNewProjectDescription('');
    setShowNewProjectModal(false);
  } catch (err) {
    console.error('Create Project error:', err);
  }
};

  const loadProject = async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      if (!response.ok) throw new Error('Failed to load project');
      const data = await response.json();
      setCurrentProject(data);
      const threadIds = data.threads;
      if (threadIds && threadIds.length > 0) {
        const threadResponse = await fetch(`/api/threads?threadId=${threadIds[0]}`);
        if (!threadResponse.ok) throw new Error('Failed to load thread');
        const threadData = await threadResponse.json();
        setMessages(threadData.messages);
        setThreadId(threadIds[0]);
      } else {
        setMessages([]);
        setThreadId(null);
      }
    } catch (error) {
      console.error("Load Project:", error);
    }
  };


  const selectProject = (project: Project) => {
    setCurrentProject(project);
    // Load threads for this project
    const projectThreads = threads.filter(t => project.threads.includes(t.id));
    if (projectThreads.length > 0) {
      loadThread(projectThreads[0].id);
    } else {
      setMessages([]);
      setThreadId(null);
    }
  };

  const loadThread = async (threadId: string) => {
    try {
      const response = await fetch(`/api/threads?threadId=${threadId}`);
      if (!response.ok) throw new Error('Failed to load thread');
      const data = await response.json();
      setMessages(data.messages);
      setThreadId(threadId);
    } catch (error) {
      console.error("Load Thread:", error);
    }
  };

  const saveThreadToProject = async () => {
    if (!threadId || !currentProject) return;
    const thread: Thread = {
      id: threadId,
      projectId: currentProject.id,
      title: messages[0]?.content.substring(0, 50) || "New Chat",
      lastMessage: messages[messages.length - 1]?.content.substring(0, 100),
      createdAt: new Date().toISOString()
    };
    try {
      await fetch('/api/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...thread, messages })
      });
      setThreads(prev => {
        const existing = prev.find(t => t.id === threadId);
        if (existing) return prev;
        return [...prev, thread];
      });
      setProjects(prev => prev.map(p => {
        if (p.id === currentProject.id && !p.threads.includes(threadId)) {
          return { ...p, threads: [...p.threads, threadId] };
        }
        return p;
      }));
    } catch (error) {
      console.error("Save Thread To Project error:", error);
    }
  };

  // Handle file upload with 20MB limit
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setUploadingFile(true);
    const newFileIds: string[] = [];
    const successfulUploads: File[] = [];
    const failedUploads: string[] = [];
    try {
      for (const file of Array.from(files)) {
        const MAX_SIZE = 20 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
          failedUploads.push(`${file.name} (exceeds 20MB limit)`);
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
      if (successfulUploads.length > 0) {
        setFileIds(prev => [...prev, ...newFileIds]);
        setUploadedFiles(prev => [...prev, ...successfulUploads]);
        setMessages(prev => [...prev, {
          role: "system",
          content: `✅ Successfully uploaded ${successfulUploads.length} file(s): ${successfulUploads.map(f => f.name).join(', ')}`,
          timestamp: new Date().toLocaleString()
        }]);
      }
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

  // Send message function
  const sendMessage = async () => {
    if (activeRun || !input.trim()) return;
    setActiveRun(true);
    setLoading(true);
    if (webSearchEnabled) setSearchInProgress(true);
    let enhancedInput = input;
    if (formatPreference !== 'default') {
      const formatInstructions = {
        bullets: '\n\n[Format: Please structure your response using bullet points where appropriate]',
        table: '\n\n[Format: Please use tables to organize data when applicable]'
      };
      enhancedInput = input + formatInstructions[formatPreference];
    }
    const userMessage = {
      role: "user",
      content: input,
      timestamp: new Date().toLocaleString(),
      fileIds: fileIds.length > 0 ? [...fileIds] : undefined
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: enhancedInput,
          threadId: threadId,
          webSearchEnabled: webSearchEnabled,
          fileIds: fileIds.length > 0 ? fileIds : undefined
        }),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse JSON response:', responseText);
        throw new Error('Invalid JSON response from server');
      }
      if (data.error) throw new Error(data.error);
      if (data.threadId && data.threadId !== threadId) {
        setThreadId(data.threadId);
        if (currentProject) saveThreadToProject();
      }
      if (webSearchEnabled) {
        setMessages(prev => prev.filter(msg => 
          !(msg.role === "system" && msg.content.includes("Searching the web"))
        ));
      }
      if (fileIds.length > 0) {
        setFileIds([]);
        setUploadedFiles([]);
      }
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
      if (webSearchEnabled) {
        setMessages(prev => prev.filter(msg => 
          !(msg.role === "system" && msg.content.includes("Searching the web"))
        ));
      }
      let errorMessage = "Unable to reach assistant.";
      if (error.message) errorMessage = error.message;
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
      .map((msg) => `${msg.timestamp} - ${msg.role === "user" ? "You" : msg.role === "system" ? "System" : "Digital Strategy Bot"}:\n${msg.content}`)
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
  };

  // Start new chat in current project
  const startNewChat = () => {
    clearChat();
    setShowProjectPanel(false);
  };

return (
  <div className="h-screen w-full flex flex-col bg-white md:flex-row">
    {/* Desktop Sidebar / Mobile Menu */}
    <AnimatePresence>
      {(showProjectPanel || (!isMobile && projects.length > 0)) && (
          <motion.div
            initial={{ x: isMobile ? -300 : 0 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className={`${
              isMobile 
                ? 'fixed inset-y-0 left-0 z-50 w-80' 
                : 'relative w-80 border-r'
            } bg-gray-50 flex flex-col`}
          >
            {/* Project Header */}
            <div className="p-4 border-b bg-white">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Projects</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowNewProjectModal(true)}
                    className="text-blue-600 hover:text-blue-700 text-sm"
                  >
                    + New
                  </button>
                  {isMobile && (
                    <button
                      onClick={() => setShowProjectPanel(false)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
              
              {currentProject && (
                <div className="mt-2 p-2 bg-blue-50 rounded-md">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: currentProject.color }}
                    />
                    <span className="text-sm font-medium">{currentProject.name}</span>
                  </div>
                  {currentProject.description && (
                    <p className="text-xs text-gray-600 mt-1">{currentProject.description}</p>
                  )}
                </div>
              )}
            </div>

            {/* Projects List */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => selectProject(project)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      currentProject?.id === project.id
                        ? 'bg-blue-100 border-blue-300'
                        : 'bg-white hover:bg-gray-100'
                    } border`}
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: project.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{project.name}</div>
                        <div className="text-xs text-gray-500">
                          {project.threads.length} chat(s)
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Recent Threads in Current Project */}
              {currentProject && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Chats</h4>
                  <div className="space-y-1">
                    {threads
                      .filter(t => currentProject.threads.includes(t.id))
                      .slice(0, 5)
                      .map((thread) => (
                        <button
                          key={thread.id}
                          onClick={() => loadThread(thread.id)}
                          className={`w-full text-left p-2 rounded text-sm ${
                            threadId === thread.id
                              ? 'bg-blue-50 text-blue-700'
                              : 'hover:bg-gray-100'
                          }`}
                        >
                          <div className="truncate">{thread.title}</div>
                          <div className="text-xs text-gray-500 truncate">
                            {thread.lastMessage}
                          </div>
                        </button>
                      ))}
                  </div>
                  <button
                    onClick={startNewChat}
                    className="mt-2 w-full text-center text-sm text-blue-600 hover:text-blue-700 py-2"
                  >
                    + Start New Chat
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between w-full p-3 md:p-4 bg-white shadow-md">
          <div className="flex items-center gap-2">
            {isMobile && (
              <button
                onClick={() => setShowProjectPanel(!showProjectPanel)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
            <img src="/icon.png" alt="Icon" className="h-8 w-8 md:h-12 md:w-12" />
            <h2 className="text-lg md:text-xl font-bold">Digital Strategy Bot</h2>
          </div>
          {!isMobile && currentProject && (
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: currentProject.color }}
              />
              <span className="text-sm">{currentProject.name}</span>
            </div>
          )}
        </header>

        {/* Chat Container */}
        <div className="flex-grow flex flex-col p-2 md:p-4">
          <div
            ref={chatContainerRef}
            className="flex-grow overflow-y-auto border p-3 space-y-4 bg-white shadow rounded-lg"
          >
            {messages.map((msg, index) => (
              <motion.div key={index}>
                <p className="font-bold mb-1 text-sm md:text-base">
                  {msg.role === "user" ? "You" : msg.role === "system" ? "System" : "Digital Strategy Bot"}{" "}
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
                      // Headers with OpenAI-style formatting
                      h1: ({ children, ...props }) => (
                        <h1 className="text-xl md:text-2xl font-bold mt-4 md:mt-6 mb-3 md:mb-4 text-gray-900" {...props}>{children}</h1>
                      ),
                      h2: ({ children, ...props }) => (
                        <h2 className="text-lg md:text-xl font-semibold mt-3 md:mt-5 mb-2 md:mb-3 text-gray-800" {...props}>{children}</h2>
                      ),
                      h3: ({ children, ...props }) => (
                        <h3 className="text-base md:text-lg font-semibold mt-3 md:mt-4 mb-2 text-gray-800" {...props}>{children}</h3>
                      ),
                      // Paragraphs
                      p: ({ children, ...props }) => (
                        <p className="mb-3 md:mb-4 leading-relaxed text-sm md:text-base text-gray-700" {...props}>{children}</p>
                      ),
                      // Links with citation support
                      a: ({ href, children, ...props }) => {
                        const isCitation = href?.startsWith('http');
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
                      // Code blocks
                      code: ({ inline, className, children, ...props }: any) => {
                        return !inline ? (
                          <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 md:p-4 overflow-x-auto mb-3 md:mb-4 text-xs md:text-sm">
                            <code className={className} {...props}>
                              {children}
                            </code>
                          </pre>
                        ) : (
                          <code className="bg-gray-100 text-red-600 px-1 py-0.5 rounded text-xs md:text-sm font-mono" {...props}>
                            {children}
                          </code>
                        );
                      },
                      // Lists
                      ul: ({ children, ...props }) => (
                        <ul className="list-disc pl-5 md:pl-6 mb-3 md:mb-4 space-y-1 md:space-y-2 text-sm md:text-base" {...props}>{children}</ul>
                      ),
                      ol: ({ children, ...props }) => (
                        <ol className="list-decimal pl-5 md:pl-6 mb-3 md:mb-4 space-y-1 md:space-y-2 text-sm md:text-base" {...props}>{children}</ol>
                      ),
                      li: ({ children, ...props }) => (
                        <li className="text-gray-700 leading-relaxed text-sm md:text-base" {...props}>{children}</li>
                      ),
                      // Tables
                      table: ({ children, ...props }) => (
                        <div className="overflow-x-auto mb-3 md:mb-4">
                          <table className="min-w-full border-collapse border border-gray-300 text-sm md:text-base" {...props}>
                            {children}
                          </table>
                        </div>
                      ),
                      th: ({ children, ...props }) => (
                        <th className="border border-gray-300 px-2 md:px-4 py-1 md:py-2 text-left font-semibold text-gray-900 bg-gray-100 text-sm md:text-base" {...props}>
                          {children}
                        </th>
                      ),
                      td: ({ children, ...props }) => (
                        <td className="border border-gray-300 px-2 md:px-4 py-1 md:py-2 text-gray-700 text-sm md:text-base" {...props}>
                          {children}
                        </td>
                      ),
                      // Blockquotes
                      blockquote: ({ children, ...props }) => (
                        <blockquote className="border-l-4 border-gray-300 pl-3 md:pl-4 py-2 mb-3 md:mb-4 italic text-gray-600 text-sm md:text-base" {...props}>
                          {children}
                        </blockquote>
                      ),
                      // Strong/Bold
                      strong: ({ children, ...props }) => (
                        <strong className="font-semibold text-gray-900" {...props}>{children}</strong>
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
                <span className="text-sm">Assistant is typing...</span>
              </div>
            )}
          </div>
        </div>

        {/* Settings & Features Bar */}
        <div className="border-t bg-gray-50">
          {/* Desktop Layout */}
          {!isMobile && (
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-4">
                  {/* Web Search Toggle */}
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={webSearchEnabled}
                      onChange={(e) => setWebSearchEnabled(e.target.checked)}
                      className="mr-2 w-4 h-4 text-blue-600 rounded"
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

                  {/* Format Options */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Format:</span>
                    <select
                      value={formatPreference}
                      onChange={(e) => setFormatPreference(e.target.value as 'default' | 'bullets' | 'table')}
                      className="text-sm border rounded px-2 py-1"
                    >
                      <option value="default">Default</option>
                      <option value="bullets">• Bullets</option>
                      <option value="table">⊞ Tables</option>
                    </select>
                  </div>

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
                          <span className="text-xs text-gray-500">(Max 20MB)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Status Indicators */}
                <div className="flex items-center gap-3 text-sm">
                  {webSearchEnabled && (
                    <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs">
                      Tavily Active
                    </span>
                  )}
                  {threadId && (
                    <span className="text-xs text-gray-500">
                      ID: {threadId.substring(0, 8)}...
                    </span>
                  )}
                </div>
              </div>

              {/* Uploaded Files Display */}
              {uploadedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 p-2 bg-white rounded-md border">
                  <span className="text-sm text-gray-600 font-medium">Files:</span>
                  {uploadedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-1 px-2 py-1 bg-gray-50 border border-gray-200 rounded-md text-sm"
                    >
                      <span>📄</span>
                      <span className="max-w-[150px] truncate">{file.name}</span>
                      <span className="text-xs text-gray-500">
                        ({(file.size / 1024 / 1024).toFixed(1)}MB)
                      </span>
                      <button
                        onClick={() => removeFile(index)}
                        className="ml-1 text-red-500 hover:text-red-700"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Mobile Layout */}
          {isMobile && (
            <div className="p-2">
              {/* Compact Mobile Controls */}
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    webSearchEnabled 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  🔍 Search {webSearchEnabled && '✓'}
                </button>
                
                <select
                  value={formatPreference}
                  onChange={(e) => setFormatPreference(e.target.value as 'default' | 'bullets' | 'table')}
                  className="flex-1 py-2 px-3 rounded-lg text-sm border bg-white"
                >
                  <option value="default">Format: Default</option>
                  <option value="bullets">Format: Bullets</option>
                  <option value="table">Format: Tables</option>
                </select>
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile}
                  className="p-2 rounded-lg bg-gray-200 text-gray-700"
                >
                  📎
                </button>
              </div>

              {/* Mobile File Display */}
              {uploadedFiles.length > 0 && (
                <div className="flex gap-1 overflow-x-auto pb-2">
                  {uploadedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs whitespace-nowrap"
                    >
                      <span>{file.name}</span>
                      <button
                        onClick={() => removeFile(index)}
                        className="text-red-500"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input & Controls */}
        <div className="p-3 md:p-4 bg-white border-t">
          <div className="flex flex-col gap-2">
            {/* Input Row */}
            <div className="flex items-center gap-2">
              <input
                className="flex-1 border rounded-lg px-3 py-2 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Type a message..."
              />
              <button
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  loading 
                    ? 'bg-gray-300 text-gray-500' 
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
                onClick={sendMessage}
                disabled={loading}
              >
                {loading ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  <span>{isMobile ? '→' : 'Send'}</span>
                )}
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {!isMobile && (
                <>
                  <button
                    className="flex-1 py-2 px-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-medium transition-colors"
                    onClick={copyChatToClipboard}
                  >
                    Copy Chat
                  </button>
                  <button
                    className="flex-1 py-2 px-3 bg-red-400 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
                    onClick={clearChat}
                  >
                    Clear Chat
                  </button>
                </>
              )}
              {isMobile && (
                <div className="flex gap-2 w-full">
                  <button
                    className="flex-1 py-2 px-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm"
                    onClick={copyChatToClipboard}
                  >
                    📋 Copy
                  </button>
                  <button
                    className="flex-1 py-2 px-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm"
                    onClick={clearChat}
                  >
                    🗑️ Clear
                  </button>
                  {currentProject && (
                    <button
                      className="flex-1 py-2 px-3 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm"
                      onClick={saveThreadToProject}
                    >
                      💾 Save
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* New Project Modal */}
      <AnimatePresence>
        {showNewProjectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowNewProjectModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4">Create New Project</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Research Project"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Brief description of the project..."
                  />
                </div>
              </div>
              
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setShowNewProjectModal(false)}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={createProject}
                  disabled={!newProjectName.trim()}
                  className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  Create Project
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChatApp;