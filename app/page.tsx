"use client";
import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import remarkGfm from "remark-gfm";
import { useMemo } from "react";

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

// Helper function to extract text content
const extractTextContent = (content: any): string => {
  if (typeof content === 'string') {
    // Convert <br> tags to newlines and clean up
    return content
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/&lt;br\s*\/?&gt;/gi, '\n')
      .replace(/\s*<br>\s*/gi, '\n')
      .replace(/\s*&lt;br&gt;\s*/gi, '\n');
  }
  
  if (typeof content === 'object' && content !== null) {
    if (Array.isArray(content)) {
      return content
        .map(item => {
          if (typeof item === 'string') return item.replace(/<br\s*\/?>/gi, '\n').replace(/&lt;br\s*\/?&gt;/gi, '\n');
          if (item.type === 'text' && item.text) return item.text.replace(/<br\s*\/?>/gi, '\n').replace(/&lt;br\s*\/?&gt;/gi, '\n');
          if (item.text && typeof item.text === 'string') return item.text.replace(/<br\s*\/?>/gi, '\n').replace(/&lt;br\s*\/?&gt;/gi, '\n');
          return '';
        })
        .filter(Boolean)
        .join('\n');
    }
    
    if (content.text && typeof content.text === 'string') {
      return content.text.replace(/<br\s*\/?>/gi, '\n').replace(/&lt;br\s*\/?&gt;/gi, '\n');
    }
    
    if (typeof content.content === 'string') {
      return content.content.replace(/<br\s*\/?>/gi, '\n').replace(/&lt;br\s*\/?&gt;/gi, '\n');
    }
    
    try {
      return JSON.stringify(content, null, 2);
    } catch {
      return '[Complex content - cannot display]';
    }
  }
  
  return String(content || '');
};

const randomColor = () => `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`;
const SEARCH_FLAG = '___WEB_SEARCH_IN_PROGRESS___';

const ChatApp = () => {
  // Main States
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true); // Fixed: Proper sidebar state
  
  const [threadId, setThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeRun, setActiveRun] = useState(false);
  const [typing, setTyping] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [fileIds, setFileIds] = useState<string[]>([]);
  const [searchInProgress, setSearchInProgress] = useState(false);
  const [formatPreference, setFormatPreference] = useState<'default' | 'bullets' | 'table' | 'preserve_tables'>('default');
  
  // Project Management States
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [showProjectPanel, setShowProjectPanel] = useState(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  
  // Share States
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [sharePermissions, setSharePermissions] = useState<'read' | 'collaborate'>('read');
  const [shareExpiryDays, setShareExpiryDays] = useState(1);
  const [creatingShare, setCreatingShare] = useState(false);
  
  // Mobile UI States
  const [isMobile, setIsMobile] = useState(false);

  // Copy Modal States
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyOptions, setCopyOptions] = useState<{ label: string; content: string; type: string }[]>([]);

  // Mobile delete menu states
  const [showProjectDeleteMenu, setShowProjectDeleteMenu] = useState<string | null>(null);
  const [showThreadDeleteMenu, setShowThreadDeleteMenu] = useState<string | null>(null);

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

  const currentProjectThreadIdSet = useMemo(
    () => new Set(currentProject?.threads ?? []),
    [currentProject]
  );

  // Project Management Functions
  const deleteProject = async (projectId: string) => {
    if (!confirm('Delete this project and all its chats? This cannot be undone.')) {
      return;
    }
    
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE'
      });
      
      if (!res.ok) throw new Error('Failed to delete project');
      
      setProjects(prev => prev.filter(p => p.id !== projectId));
      
      if (currentProject?.id === projectId) {
        setCurrentProject(null);
        setMessages([]);
        setThreadId(null);
      }
    } catch (err) {
      console.error('Delete project error:', err);
      alert('Failed to delete project');
    }
  };

  const deleteThread = async (threadId: string) => {
    if (!confirm('Delete this chat? This cannot be undone.')) {
      return;
    }
    
    try {
      const res = await fetch(`/api/threads/${threadId}`, {
        method: 'DELETE'
      });
      
      if (!res.ok) throw new Error('Failed to delete thread');
      
      setThreads(prev => prev.filter(t => t.id !== threadId));
      
      if (currentProject) {
        setProjects(prev => prev.map(p => {
          if (p.id === currentProject.id) {
            return {
              ...p,
              threads: p.threads.filter(id => id !== threadId)
            };
          }
          return p;
        }));
      }
      
      if (threadId === threadId) {
        setMessages([]);
        setThreadId(null);
      }
    } catch (err) {
      console.error('Delete thread error:', err);
      alert('Failed to delete chat');
    }
  };

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
        setThreads(prev => [...prev.filter(t => t.id !== newThreadId), thread]);
        
        setProjects(prev => prev.map(p => {
          if (p.id === currentProject.id) {
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

  // Share Functions
  const loadProjectShares = async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/shares`);
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
      const response = await fetch(`/api/projects/${currentProject.id}/shares`, {
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
      const response = await fetch(`/api/projects/${currentProject.id}/shares?token=${shareToken}`, {
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

  // Copy Functions
  const copyLastBotResponse = async () => {
    try {
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

  const extractTables = (content: string): string[] => {
    const tables: string[] = [];
    const tableRegex = /\|[^|\n]*\|[^|\n]*\|[\s\S]*?(?=\n\n|\n$|$)/g;
    const markdownTables = content.match(tableRegex);
    
    if (markdownTables) {
      tables.push(...markdownTables.map(table => table.trim()));
    }
    
    return tables;
  };

  const extractCodeBlocks = (content: string): string[] => {
    const codeBlocks: string[] = [];
    const codeRegex = /```[\s\S]*?```/g;
    const matches = content.match(codeRegex);
    
    if (matches) {
      codeBlocks.push(...matches.map(block => block.trim()));
    }
    
    return codeBlocks;
  };

  const extractLists = (content: string): string[] => {
    const lists: string[] = [];
    
    const numberedListRegex = /(?:^|\n)((?:\d+\.\s+[^\n]+(?:\n(?:\s{2,}[^\n]+|\d+\.\s+[^\n]+))*)+)/gm;
    const numberedMatches = content.match(numberedListRegex);
    
    if (numberedMatches) {
      lists.push(...numberedMatches.map(list => list.trim()));
    }
    
    const bulletListRegex = /(?:^|\n)((?:[*-]\s+[^\n]+(?:\n(?:\s{2,}[^\n]+|[*-]\s+[^\n]+))*)+)/gm;
    const bulletMatches = content.match(bulletListRegex);
    
    if (bulletMatches) {
      lists.push(...bulletMatches.map(list => list.trim()));
    }
    
    return lists;
  };

  const copyEmbeddedContent = async () => {
    try {
      const lastBotMessage = messages
        .slice()
        .reverse()
        .find(msg => msg.role === "assistant");
      
      if (!lastBotMessage) {
        alert("No bot response found.");
        return;
      }
      
      const content = extractTextContent(lastBotMessage.content);
      
      const tables = extractTables(content);
      const codeBlocks = extractCodeBlocks(content);
      const lists = extractLists(content);
      
      const options: { label: string; content: string; type: string }[] = [];
      
      options.push({
        label: "📄 Full Response",
        content: content,
        type: "full"
      });
      
      tables.forEach((table, index) => {
        const preview = table.split('\n')[0].substring(0, 50) + '...';
        options.push({
          label: `📊 Table ${index + 1}: ${preview}`,
          content: table,
          type: "table"
        });
      });
      
      codeBlocks.forEach((code, index) => {
        const firstLine = code.split('\n')[0].replace(/```\w*/, '').substring(0, 30);
        options.push({
          label: `💻 Code Block ${index + 1}: ${firstLine}...`,
          content: code,
          type: "code"
        });
      });
      
      lists.forEach((list, index) => {
        const firstItem = list.split('\n')[0].substring(0, 40) + '...';
        options.push({
          label: `📋 List ${index + 1}: ${firstItem}`,
          content: list,
          type: "list"
        });
      });
      
      if (options.length === 1) {
        await navigator.clipboard.writeText(content);
        alert("Full response copied to clipboard!");
        return;
      }
      
      setShowCopyModal(true);
      setCopyOptions(options);
      
    } catch (error) {
      console.error("Failed to extract content:", error);
      alert("Failed to extract content.");
    }
  };

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

  // File handling functions
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
        table: '\n\n[Format: Please use tables to organize data when applicable]',
        preserve_tables: '\n\n[IMPORTANT: If the previous response contained a table, please maintain the EXACT same table structure and format. Add new information as additional rows or columns, but keep it in proper markdown table format with | separators |]'
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
    <div className="h-[100svh] md:h-screen w-full flex flex-col bg-neutral-50 md:flex-row overflow-hidden">
      {/* Desktop Sidebar / Mobile Menu */}
      <AnimatePresence>
        {(showProjectPanel || !isMobile) && (
          <motion.div
            initial={{ x: isMobile ? -300 : 0 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className={`${
              isMobile 
                ? 'fixed inset-y-0 left-0 z-50 w-80 bg-gray-50' 
                : `relative bg-white/80 backdrop-blur flex flex-col ring-1 ring-gray-200 shadow-sm transition-[width] duration-300 ease-in-out ${sidebarOpen ? "w-80" : "w-0 overflow-hidden"}`
            } flex flex-col`}
          >
            {/* Project Header */}
            <div className="sticky top-0 z-30 p-4 bg-white/80 backdrop-blur border-b border-gray-200">
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
                  <div key={project.id} className="relative group">
                    <button
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
                    
                    {/* Desktop delete button */}
                    {!isMobile && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteProject(project.id);
                        }}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 rounded"
                        title="Delete project"
                      >
                        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                    
                    {/* Mobile three-dot menu */}
                    {isMobile && (
                      <div className="absolute top-2 right-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowProjectDeleteMenu(showProjectDeleteMenu === project.id ? null : project.id);
                          }}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>
                        
                        {/* Mobile delete dropdown */}
                        {showProjectDeleteMenu === project.id && (
                          <div className="absolute right-0 top-8 bg-white rounded-xl ring-1 ring-gray-100 shadow-lg py-1 z-20 min-w-[120px]">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteProject(project.id);
                                setShowProjectDeleteMenu(null);
                              }}
                              className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              🗒️ Delete Project
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
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
                        <div key={thread.id} className="relative group">
                          <button
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
                          
                          {/* Desktop delete button */}
                          {!isMobile && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteThread(thread.id);
                              }}
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 rounded"
                              title="Delete chat"
                            >
                              <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                          
                          {/* Mobile three-dot menu */}
                          {isMobile && (
                            <div className="absolute top-2 right-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowThreadDeleteMenu(showThreadDeleteMenu === thread.id ? null : thread.id);
                                }}
                                className="p-1 hover:bg-gray-100 rounded"
                              >
                                <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                </svg>
                              </button>
                              
                              {showThreadDeleteMenu === thread.id && (
                                <div className="absolute right-0 top-6 bg-white rounded-xl ring-1 ring-gray-100 shadow-lg py-1 z-20 min-w-[100px]">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteThread(thread.id);
                                      setShowThreadDeleteMenu(null);
                                    }}
                                    className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                                  >
                                    🗒️ Delete Chat
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
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
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header - Fixed according to OpenAI suggestions */}
        <header className="sticky top-0 z-40 w-full p-3 md:p-4 bg-white/80 backdrop-blur border-b border-gray-200">
          <div className="relative flex items-center justify-between">
            {/* Left: Desktop toggle button */}
            {!isMobile && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100"
                aria-pressed={sidebarOpen}
                title={sidebarOpen ? "Hide panel" : "Show panel"}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h10" />
                </svg>
                <span className="text-sm text-gray-700">{sidebarOpen ? "Hide panel" : "Show panel"}</span>
              </button>
            )}
            
            {/* Mobile hamburger button */}
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

            {/* Center: Title block - Fixed positioning */}
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
              <img src="/icon.png" alt="Icon" className="h-8 w-8 md:h-10 md:w-10" />
              <h2 className="text-lg md:text-xl font-semibold tracking-tight text-gray-900">
                Digital Strategy Bot
              </h2>
            </div>
            
            {/* Right: Optional status */}
            <div className="flex items-center gap-2">
              {!isMobile && currentProject && (
                <>
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: currentProject.color }}
                  />
                  <span className="text-sm">{currentProject.name}</span>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Chat Container */}
        <div className="flex-1 flex flex-col p-2 md:p-4 overflow-hidden">
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto ring-1 ring-gray-200 shadow-sm rounded-2xl bg-white p-4 md:p-5 space-y-4 pb-28"
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
                        <table className="min-w-full border-collapse border border-gray-300 text-sm md:text-base table-auto" {...props}>
                          {children}
                        </table>
                      </div>
                    ),
                    th: ({ children, ...props }) => (
                      <th className="border border-gray-300 px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-900 bg-gray-100 text-sm md:text-base align-top" {...props}>
                        {children}
                      </th>
                    ),
                    td: ({ children, ...props }) => (
                      <td className="border border-gray-300 px-2 md:px-4 py-2 md:py-3 text-gray-700 text-sm md:text-base whitespace-pre-line align-top" {...props}>
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
                      onChange={(e) => setFormatPreference(e.target.value as 'default' | 'bullets' | 'table' | 'preserve_tables')}
                      className="text-sm border rounded px-2 py-1"
                    >
                      <option value="default">Default</option>
                      <option value="bullets">• Bullets</option>
                      <option value="table">⊞ Tables</option>
                      <option value="preserve_tables">📋 Keep Table Format</option>
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
                          <span className="animate-spin">⟳</span>
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
                  onChange={(e) => setFormatPreference(e.target.value as 'default' | 'bullets' | 'table' | 'preserve_tables')}
                  className="flex-1 py-2 px-3 rounded-lg text-sm border bg-white"
                >
                  <option value="default">Format: Default</option>
                  <option value="bullets">Format: Bullets</option>
                  <option value="table">Format: Tables</option>
                  <option value="preserve_tables">Format: Keep Tables</option>
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
        <div className="p-3 md:p-4 bg-white/90 backdrop-blur border-t border-gray-200 z-40">
          <div className="flex flex-col gap-2">
            {/* Input Row */}
            <div className="flex items-center gap-2">
              <input
                className="flex-1 rounded-xl ring-1 ring-gray-100 px-3 py-2 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  <span>{isMobile ? '↑' : 'Send'}</span>
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
                   🗒️ Clear Chat
                  </button>
                   </>
              )}
              
              {isMobile && (
                <div className="flex gap-2 w-full">
                  <button
                    className="flex-1 py-2 px-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm"
                    onClick={clearChat}
                  >
                    🗒️ Clear
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
                    className="w-full rounded-xl ring-1 ring-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full rounded-xl ring-1 ring-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
      
      {/* Share Modal */}
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
                      className="w-full rounded-xl ring-1 ring-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="w-full rounded-xl ring-1 ring-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                          className={`rounded-xl ring-1 ring-gray-100 p-3 ${isExpired ? 'bg-red-50 border-red-200' : 'bg-white'}`}
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
                                🗒️ Revoke
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

      {/* Click outside handler for mobile delete menus */}
      {isMobile && (showProjectDeleteMenu || showThreadDeleteMenu) && (
        <div 
          className="fixed inset-0 z-10" 
          onClick={() => {
            setShowProjectDeleteMenu(null);
            setShowThreadDeleteMenu(null);
          }}
        />
      )}
    </div>
  );
};

export default ChatApp;