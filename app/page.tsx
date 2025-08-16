"use client";

import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import remarkGfm from "remark-gfm";
import { useMemo } from "react";

const randomColor = () => `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`;
const SEARCH_FLAG = '___WEB_SEARCH_IN_PROGRESS___';

// Define types
interface Message {
  role: string;
  content: string | any; // Allow both string and object content
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

interface ShareLink {
  id: string;
  share_token: string;
  permissions: 'read' | 'collaborate';
  expires_at: string;
  created_at: string;
  shareUrl: string;
}

// First, add this helper function at the top of your component (after the interfaces):
const extractTextContent = (content: any): string => {
  // If content is already a string, return it
  if (typeof content === 'string') {
    return content;
  }
  
  // If content is an object (like OpenAI structured response)
  if (typeof content === 'object' && content !== null) {
    // Handle OpenAI message content structure
    if (Array.isArray(content)) {
      return content
        .map(item => {
          if (typeof item === 'string') return item;
          if (item.type === 'text' && item.text) return item.text;
          if (item.text && typeof item.text === 'string') return item.text;
          return '';
        })
        .filter(Boolean)
        .join('\n');
    }
    
    // Handle single object with text property
    if (content.text && typeof content.text === 'string') {
      return content.text;
    }
    
    // Handle direct text property
    if (typeof content.content === 'string') {
      return content.content;
    }
    
    // Fallback: stringify the object
    try {
      return JSON.stringify(content, null, 2);
    } catch {
      return '[Complex content - cannot display]';
    }
  }
  
  // Fallback for any other type
  return String(content || '');
};

const ChatApp = () => {
  // Main States
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
  
  // Share States (consolidated - removed duplicates)
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [sharePermissions, setSharePermissions] = useState<'read' | 'collaborate'>('read');
  const [shareExpiryDays, setShareExpiryDays] = useState(1);
  const [creatingShare, setCreatingShare] = useState(false);
  
  // Mobile UI States
  const [isMobile, setIsMobile] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  // Add these state variables to your component:
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyOptions, setCopyOptions] = useState<{ label: string; content: string; type: string }[]>([]);

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
        const normalized = (data.projects || []).map((p: any) => ({
          ...p,
          threads: Array.isArray(p.threads) ? p.threads.map((t: any) => t.id) : (p.threads || [])
        }));
        setProjects(normalized);

        if (!data.projects || data.projects.length === 0) {
          setShowProjectPanel(true);
          setShowNewProjectModal(true);
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

  // Load shares when modal opens
  useEffect(() => {
    if (currentProject && showShareModal) {
      loadProjectShares(currentProject.id);
    }
  }, [currentProject, showShareModal]);


  // Additional safety check in the initial projects loading:
useEffect(() => {
  fetch('/api/projects')
    .then(res => res.json())
    .then(data => {
      // Ensure all projects have threads array
      const normalized = (data.projects || []).map((p: any) => ({
        ...p,
        threads: Array.isArray(p.threads) ? p.threads.map((t: any) => typeof t === 'string' ? t : t.id) : []
      }));
      setProjects(normalized);

      if (!data.projects || data.projects.length === 0) {
        setShowProjectPanel(true);
        setShowNewProjectModal(true);
      }
    })
    .catch(err => console.error('Error loading projects:', err));
}, []);

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
          color: randomColor()
        })
      });
      if (!res.ok) throw new Error('Failed to create project');
      const payload = await res.json();
      const created = payload.project ?? payload;
      setProjects(prev => [...prev, created]);
      setCurrentProject(created);
      setNewProjectName('');
      setNewProjectDescription('');
      setShowNewProjectModal(false);
      setShowProjectPanel(true);
    } catch (err) {
      console.error('Create Project error:', err);
    }
  };

  const currentProjectThreadIdSet = useMemo(
    () => new Set(currentProject?.threads ?? []),
    [currentProject]
  );
  
  const loadProject = async (projectId: string) => {
    const response = await fetch(`/api/projects/${projectId}`);
    if (!response.ok) throw new Error('Failed to load project');
    const data = await response.json();

    const threadObjs = Array.isArray(data.threads) ? data.threads : [];
    const threadIds = threadObjs.map((t: any) => t.id);

    setCurrentProject({ ...data, threads: threadIds });

    setThreads(prev => {
      const next = [
        ...prev.filter(t => !threadIds.includes(t.id)),
        ...threadObjs.map((t: any) => ({
          id: t.id,
          projectId: data.id,
          title: t.title ?? 'Untitled',
          lastMessage: '',
          createdAt: t.created_at ?? new Date().toISOString()
        }))
      ];
      return next;
    });

    if (threadIds.length > 0) {
      await loadThread(threadIds[0]);
    } else {
      setMessages([]);
      setThreadId(null);
    }
  };

  const selectProject = (project: Project) => {
    loadProject(project.id);
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

  
    const saveThreadToProjectWithId = async (newThreadId: string) => {
  if (!currentProject) return;
  
  const thread: Thread = {
    id: newThreadId,
    projectId: currentProject.id,
    title: messages[0]?.content.substring(0, 50) || "New Chat",
    lastMessage: messages[messages.length - 1]?.content.substring(0, 100),
    createdAt: new Date().toISOString()
  };
  
  try {
    const response = await fetch('/api/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...thread, messages })
    });
    
    if (response.ok) {
      // Update local threads state
      setThreads(prev => [...prev.filter(t => t.id !== newThreadId), thread]);
      
      // Update projects state with null checks
      setProjects(prev => prev.map(p => {
        if (p.id === currentProject.id) {
          // Ensure threads array exists and check if thread is already included
          const currentThreads = Array.isArray(p.threads) ? p.threads : [];
          if (!currentThreads.includes(newThreadId)) {
            return { ...p, threads: [...currentThreads, newThreadId] };
          }
        }
        return p;
      }));
      
      console.log('Thread saved successfully:', newThreadId);
    } else {
      console.error('Failed to save thread:', await response.text());
    }
  } catch (error) {
    console.error("Save Thread To Project error:", error);
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
      if (p.id === currentProject.id) {
        // Ensure threads array exists
        const currentThreads = Array.isArray(p.threads) ? p.threads : [];
        if (!currentThreads.includes(threadId)) {
          return { ...p, threads: [...currentThreads, threadId] };
        }
      }
      return p;
    }));
  } catch (error) {
    console.error("Save Thread To Project error:", error);
  }
};


  // Share Functions (fixed API paths)
  const loadProjectShares = async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/shares`); // Fixed: /shares
      if (response.ok) {
        const data = await response.json();
        setShareLinks(data.shares || []);
      }
    } catch (error) {
      console.error('Load shares error:', error);
    }
  };

  const createShareLink = async () => {
    if (!currentProject || creatingShare) return;
    
    setCreatingShare(true);
    try {
      const response = await fetch(`/api/projects/${currentProject.id}/shares`, { // Fixed: /shares
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permissions: sharePermissions,
          expiryDays: shareExpiryDays
        })
      });

      if (!response.ok) throw new Error('Failed to create share link');
      
      const data = await response.json();
      
      await navigator.clipboard.writeText(data.shareUrl);
      alert(`Share link created and copied!\nExpires: ${new Date(data.expiresAt).toLocaleString()}`);
      
      loadProjectShares(currentProject.id);
      
    } catch (error) {
      console.error('Create share error:', error);
      alert('Failed to create share link');
    } finally {
      setCreatingShare(false);
    }
  };

  const revokeShareLink = async (shareToken: string) => {
    if (!currentProject || !confirm('Revoke this share link?')) return;
    
    try {
      const response = await fetch(`/api/projects/${currentProject.id}/shares?token=${shareToken}`, { // Fixed: /shares
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to revoke share');
      loadProjectShares(currentProject.id);
      
    } catch (error) {
      console.error('Revoke share error:', error);
      alert('Failed to revoke share link');
    }
  };

  const copyShareLink = async (shareUrl: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('Share link copied to clipboard!');
    } catch (error) {
      console.error('Copy error:', error);
    }
  };

  // 1. Function to copy the last bot response
const copyLastBotResponse = async () => {
  try {
    // Find the last assistant message
    const lastBotMessage = messages
      .slice()
      .reverse()
      .find(msg => msg.role === "assistant");
    
    if (!lastBotMessage) {
      alert("No bot response found to copy.");
      return;
    }
    
    const content = extractTextContent(lastBotMessage.content);
    await navigator.clipboard.writeText(content);
    alert("Last bot response copied to clipboard!");
  } catch (error) {
    console.error("Failed to copy last response:", error);
    alert("Failed to copy response to clipboard.");
  }
};

// 2. Function to extract and copy tables from content
const extractTables = (content: string): string[] => {
  const tables: string[] = [];
  
  // Extract markdown tables (format: | col1 | col2 |)
  const tableRegex = /\|[^|\n]*\|[^|\n]*\|[\s\S]*?(?=\n\n|\n$|$)/g;
  const markdownTables = content.match(tableRegex);
  
  if (markdownTables) {
    tables.push(...markdownTables.map(table => table.trim()));
  }
  
  return tables;
};

// 3. Function to extract and copy diagrams/code blocks
const extractCodeBlocks = (content: string): string[] => {
  const codeBlocks: string[] = [];
  
  // Extract code blocks (```language ... ```)
  const codeRegex = /```[\s\S]*?```/g;
  const matches = content.match(codeRegex);
  
  if (matches) {
    codeBlocks.push(...matches.map(block => block.trim()));
  }
  
  return codeBlocks;
};

// 4. Function to extract lists
const extractLists = (content: string): string[] => {
  const lists: string[] = [];
  
  // Extract numbered lists
  const numberedListRegex = /(?:^|\n)((?:\d+\.\s+[^\n]+(?:\n(?:\s{2,}[^\n]+|\d+\.\s+[^\n]+))*)+)/gm;
  const numberedMatches = content.match(numberedListRegex);
  
  if (numberedMatches) {
    lists.push(...numberedMatches.map(list => list.trim()));
  }
  
  // Extract bullet lists
  const bulletListRegex = /(?:^|\n)((?:[*-]\s+[^\n]+(?:\n(?:\s{2,}[^\n]+|[*-]\s+[^\n]+))*)+)/gm;
  const bulletMatches = content.match(bulletListRegex);
  
  if (bulletMatches) {
    lists.push(...bulletMatches.map(list => list.trim()));
  }
  
  return lists;
};

// 5. Main function to copy embedded content with selection
const copyEmbeddedContent = async () => {
  try {
    // Find the last assistant message
    const lastBotMessage = messages
      .slice()
      .reverse()
      .find(msg => msg.role === "assistant");
    
    if (!lastBotMessage) {
      alert("No bot response found.");
      return;
    }
    
    const content = extractTextContent(lastBotMessage.content);
    
    // Extract different types of content
    const tables = extractTables(content);
    const codeBlocks = extractCodeBlocks(content);
    const lists = extractLists(content);
    
    // Create options for user to choose from
    const options: { label: string; content: string; type: string }[] = [];
    
    // Add full response option
    options.push({
      label: "📄 Full Response",
      content: content,
      type: "full"
    });
    
    // Add tables
    tables.forEach((table, index) => {
      const preview = table.split('\n')[0].substring(0, 50) + '...';
      options.push({
        label: `📊 Table ${index + 1}: ${preview}`,
        content: table,
        type: "table"
      });
    });
    
    // Add code blocks
    codeBlocks.forEach((code, index) => {
      const firstLine = code.split('\n')[0].replace(/```\w*/, '').substring(0, 30);
      options.push({
        label: `💻 Code Block ${index + 1}: ${firstLine}...`,
        content: code,
        type: "code"
      });
    });
    
    // Add lists
    lists.forEach((list, index) => {
      const firstItem = list.split('\n')[0].substring(0, 40) + '...';
      options.push({
        label: `📋 List ${index + 1}: ${firstItem}`,
        content: list,
        type: "list"
      });
    });
    
    if (options.length === 1) {
      // Only full response available
      await navigator.clipboard.writeText(content);
      alert("Full response copied to clipboard!");
      return;
    }
    
    // Show selection modal
    setShowCopyModal(true);
    setCopyOptions(options);
    
  } catch (error) {
    console.error("Failed to extract content:", error);
    alert("Failed to extract content.");
  }
};

// 6. Function to copy selected content
const copySelectedContent = async (content: string, label: string) => {
  try {
    await navigator.clipboard.writeText(content);
    alert(`${label} copied to clipboard!`);
    setShowCopyModal(false);
  } catch (error) {
    console.error("Failed to copy content:", error);
    alert("Failed to copy content to clipboard.");
  }
};


  // File handling functions (unchanged)
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

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    setFileIds(prev => prev.filter((_, i) => i !== index));
  };

  // Send message function (unchanged)
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
      setMessages(prev => [
        ...prev,
        {
          role: "system",
          content: `🔍 Searching the web for current information... ${SEARCH_FLAG}`,
          timestamp: new Date().toLocaleString(),
        }
      ]);
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
        if (currentProject) {
          // Save immediately with the NEW threadId from API response
          saveThreadToProjectWithId(data.threadId);
        }
      }

      if (webSearchEnabled) {
        setMessages(prev => prev.filter(msg =>
          !(msg.role === "system" && typeof msg.content === 'string' && msg.content.includes(SEARCH_FLAG))
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
          !(msg.role === "system" && typeof msg.content === 'string' && msg.content.includes(SEARCH_FLAG))
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

  // Utility functions
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

  const clearChat = () => {
    setMessages([]);
    setThreadId(null);
    setFileIds([]);
    setUploadedFiles([]);
  };

  const startNewChat = () => {
    clearChat();
    setShowProjectPanel(false);
  };

  return (
    <div className="h-screen w-full flex flex-col bg-white md:flex-row">
      {/* Desktop Sidebar / Mobile Menu */}
      <AnimatePresence>
        {(showProjectPanel || !isMobile) && (
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
                  {currentProject && (
                    <button
                      onClick={() => setShowShareModal(true)}
                      className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                      🔗 Share
                    </button>
                  )}
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
                          {Array.isArray(project.threads) ? project.threads.length : 0} chat(s)
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

        {/* Chat Container - keeping the existing markdown rendering */}
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
    p: ({ children, ...props }) => (
      <p className="mb-3 md:mb-4 leading-relaxed text-sm md:text-base text-gray-700" {...props}>{children}</p>
    ),
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
    ul: ({ children, ...props }) => (
      <ul className="list-disc pl-5 md:pl-6 mb-3 md:mb-4 space-y-1 md:space-y-2 text-sm md:text-base" {...props}>{children}</ul>
    ),
    ol: ({ children, ...props }) => (
      <ol className="list-decimal pl-5 md:pl-6 mb-3 md:mb-4 space-y-1 md:space-y-2 text-sm md:text-base" {...props}>{children}</ol>
    ),
    li: ({ children, ...props }) => (
      <li className="text-gray-700 leading-relaxed text-sm md:text-base" {...props}>{children}</li>
    ),
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
    blockquote: ({ children, ...props }) => (
      <blockquote className="border-l-4 border-gray-300 pl-3 md:pl-4 py-2 mb-3 md:mb-4 italic text-gray-600 text-sm md:text-base" {...props}>
        {children}
      </blockquote>
    ),
    strong: ({ children, ...props }) => (
      <strong className="font-semibold text-gray-900" {...props}>{children}</strong>
    ),
  }}
>
  {extractTextContent(msg.content)}

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
                  className="flex-1 py-2 px-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                  onClick={copyLastBotResponse}
                  >
                  📋 Copy Last Response
                 </button>
                <button
                  className="flex-1 py-2 px-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors"
                  onClick={copyEmbeddedContent}
                  >
                  📊 Copy Content
                </button>
                <button
                  className="flex-1 py-2 px-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-medium transition-colors"
                   onClick={copyChatToClipboard}
                  >
                  💬 Copy Chat
                  </button>
                  <button
                    className="flex-1 py-2 px-3 bg-red-400 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
                    onClick={clearChat}
                    >
                   🗑️ Clear Chat
                  </button>
                   </>
              )}
              
              {isMobile && (
                <div className="flex gap-2 w-full">
                  <button
                    className="flex-1 py-2 px-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm"
                    onClick={copyLastBotResponse}
                  >
                    📋 Last
                  </button>
                  <button
                    className="flex-1 py-2 px-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm"
                    onClick={copyEmbeddedContent}
                  >
                    📊 Content
                  </button>
                  <button
                    className="flex-1 py-2 px-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm"
                    onClick={copyChatToClipboard}
                  >
                    💬 All
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
      
      {/* Share Modal - Inline Implementation */}
      <AnimatePresence>
        {showShareModal && currentProject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowShareModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span>🔗</span>
                Share "{currentProject.name}"
              </h3>
              
              {/* Create New Share */}
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <h4 className="font-medium mb-3">Create New Share Link</h4>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Access Level
                    </label>
                    <select
                      value={sharePermissions}
                      onChange={(e) => setSharePermissions(e.target.value as 'read' | 'collaborate')}
                      className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="read">👁️ Read Only - Can view conversations</option>
                      <option value="collaborate">✏️ Collaborate - Can chat and contribute</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expires In
                    </label>
                    <select
                      value={shareExpiryDays}
                      onChange={(e) => setShareExpiryDays(Number(e.target.value))}
                      className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={1}>1 Day (Default)</option>
                      <option value={3}>3 Days</option>
                      <option value={7}>1 Week</option>
                      <option value={14}>2 Weeks</option>
                      <option value={30}>1 Month</option>
                    </select>
                  </div>
                  
                  <button
                    onClick={createShareLink}
                    disabled={creatingShare}
                    className="w-full py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 font-medium"
                  >
                    {creatingShare ? 'Creating...' : '🔗 Create & Copy Link'}
                  </button>
                </div>
              </div>
              
              {/* Existing Shares */}
              <div>
                <h4 className="font-medium mb-3">Active Share Links ({shareLinks.length})</h4>
                
                {shareLinks.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">
                    No active share links. Create one above.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {shareLinks.map((share) => {
                      const isExpired = new Date(share.expires_at) < new Date();
                      return (
                        <div
                          key={share.id}
                          className={`border rounded-lg p-3 ${isExpired ? 'bg-red-50 border-red-200' : 'bg-white'}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              share.permissions === 'collaborate' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {share.permissions === 'collaborate' ? '✏️ Collaborate' : '👁️ Read Only'}
                            </span>
                            
                            <div className="flex gap-1">
                              {!isExpired && (
                                <button
                                  onClick={() => copyShareLink(share.shareUrl)}
                                  className="text-blue-600 hover:text-blue-700 text-sm px-2 py-1"
                                >
                                  📋 Copy
                                </button>
                              )}
                              <button
                                onClick={() => revokeShareLink(share.share_token)}
                                className="text-red-600 hover:text-red-700 text-sm px-2 py-1"
                              >
                                🗑️ Revoke
                              </button>
                            </div>
                          </div>
                          
                          <div className="text-xs text-gray-600">
                            <div>Created: {new Date(share.created_at).toLocaleDateString()}</div>
                            <div className={isExpired ? 'text-red-600 font-medium' : ''}>
                              {isExpired ? 'Expired: ' : 'Expires: '}
                              {new Date(share.expires_at).toLocaleString()}
                            </div>
                          </div>
                          
                          {!isExpired && (
                            <div className="mt-2 text-xs text-gray-500 break-all bg-gray-50 p-1 rounded">
                              {share.shareUrl}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setShowShareModal(false)}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
     
      {/* Copy Content Selection Modal */}
      <AnimatePresence>
        {showCopyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCopyModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span>📊</span>
                Select Content to Copy
              </h3>
              
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {copyOptions.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => copySelectedContent(option.content, option.label)}
                    className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                  >
                    <div className="font-medium text-sm">{option.label}</div>
                    <div className="text-xs text-gray-500 mt-1 truncate">
                      {option.content.substring(0, 100)}...
                    </div>
                  </button>
                ))}
              </div>
              
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setShowCopyModal(false)}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
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