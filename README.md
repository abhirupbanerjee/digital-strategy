# Digital Strategy Bot

**AI-Powered Government Digital Transformation Assistant**

A sophistcated conversational AI platform built specifically for Caribbean government officials and public sector leaders. Features advanced file persistence, web search integration, and project-based organization for strategic planning and digital transformation initiatives.

## 🚀 Key Features

### Core AI Capabilities
- **OpenAI GPT-4 Integration**: Advanced reasoning with Assistant API
- **Thread-Level File Persistence**: Files remain accessible throughout entire conversations
- **Multi-format File Support**: PDF, DOC, Excel, PowerPoint, images, CSV, JSON, markdown
- **Web Search Integration**: Real-time information via Tavily API with source citations
- **Smart Context Management**: Automatic file relevance detection and context optimization

### File Management System
- **Intelligent Persistence**: Upload once, reference throughout entire thread
- **Usage Analytics**: Track file access patterns and relevance scores
- **Automatic Cleanup**: 400MB storage threshold with 7-day retention policy
- **Dual Storage**: OpenAI temporary + Vercel Blob permanent storage
- **File Tracking**: Complete audit trail with access statistics

### Project Organization
- **Multi-Project Workspace**: Organize conversations by initiatives or departments
- **Smart Title Generation**: Contextual titles with Caribbean country detection
- **Thread Management**: Save, share, and export conversation threads
- **Batch Import**: Sync existing OpenAI threads with intelligent categorization

### Collaboration & Sharing
- **Secure Share Links**: Token-based project and thread sharing
- **Permission Levels**: Read-only or full collaboration access
- **Time-Limited Access**: Configurable expiration (1 day to 1 month)
- **Export Capabilities**: PDF, HTML, and ZIP downloads with attachments

### Advanced UI/UX
- **Responsive Design**: Mobile-first with progressive web app capabilities
- **Real-time Features**: Live typing indicators and message status
- **Accessibility**: Full keyboard navigation and screen reader support

## 🏗️ Architecture Overview

### Technology Stack

**Frontend Framework**
- **Next.js 15**: React-based framework with App Router
- **React 19**: Latest React with hooks and server components
- **TypeScript 5**: Full type safety throughout the application
- **Tailwind CSS 4**: Utility-first CSS framework for styling
- **Framer Motion 12**: Smooth animations and transitions

**Backend Services**
- **Next.js API Routes**: Server-side API endpoints
- **OpenAI Assistant API**: AI conversation engine (GPT-4)
- **Tavily API**: Web search capabilities
- **Supabase**: PostgreSQL database with real-time features

**Storage Solutions**
- **Vercel Blob**: File storage with automatic CDN distribution
- **Supabase Storage**: Metadata and file mapping
- **OpenAI File Storage**: Temporary file processing (48-hour retention)

**File Persistence Architecture**
- **ThreadFileService**: Centralized file context management
- **Database Schema**: `thread_file_context` and `file_context_tracking` tables
- **Automatic Association**: Files persist across all messages in thread
- **Usage Statistics**: Track access patterns and relevance scoring

### Complete File Structure

```
digital-strategy-bot/
├── app/                          # Next.js 15 App Router
│   ├── api/                      # API Routes
│   │   ├── chat/                 # Main chat endpoint with file persistence
│   │   │   └── route.ts          # Message processing, AI responses, file handling
│   │   ├── projects/             # Project management
│   │   │   ├── [id]/             # Individual project operations
│   │   │   │   ├── route.ts      # GET project details, DELETE project
│   │   │   │   └── shares/       # Project sharing
│   │   │   │       └── route.ts  # Create/manage/revoke share links
│   │   │   └── route.ts          # GET all projects, POST new project
│   │   ├── threads/              # Thread operations
│   │   │   ├── [id]/             # Individual thread operations
│   │   │   │   ├── route.ts      # DELETE specific thread
│   │   │   │   ├── shares/       # Thread-level sharing
│   │   │   │   │   └── route.ts  # Create/manage thread share links
│   │   │   │   └── download/     # Thread export
│   │   │   │       └── route.ts  # Generate ZIP export with files
│   │   │   └── route.ts          # GET thread messages, POST save thread
│   │   ├── files/                # File handling
│   │   │   └── [fileId]/         # File download endpoint
│   │   │       └── route.ts      # Serve files with Vercel Blob fallback
│   │   ├── upload/               # File upload processing
│   │   │   └── route.ts          # Multi-format file upload to OpenAI
│   │   ├── shared/               # Share link validation
│   │   │   ├── [token]/          # Project share access
│   │   │   │   └── route.ts      # Validate project share token
│   │   │   └── thread/           # Thread share access
│   │   │       └── [token]/      
│   │   │           └── route.ts  # Validate thread share token
│   │   ├── sync-threads/         # Thread synchronization
│   │   │   └── route.ts          # Sync OpenAI threads with smart titles
│   │   ├── cleanup-threads/      # Database maintenance
│   │   │   └── route.ts          # Clean legacy data, preserve file links
│   │   ├── search/               # Web search integration
│   │   │   └── route.ts          # Tavily API web search
│   │   └── vercel-storage/       # Storage management
│   │       ├── cleanup/          # Automatic storage cleanup
│   │       │   └── route.ts      # Delete old files when threshold reached
│   │       ├── download/         # Direct blob downloads
│   │       │   └── [fileKey]/   
│   │       │       └── route.ts  # Download files from Vercel Blob
│   │       ├── stats/            # Storage usage metrics
│   │       │   └── route.ts      # GET storage stats, POST recalculate
│   │       └── upload/           # Manual blob uploads
│   │           └── route.ts      # Upload files to Vercel Blob
│   │
│   ├── components/               # Reusable React components
│   │   ├── ShareModal.tsx        # Project share link management UI
│   │   └── ThreadShareModal.tsx  # Thread share link management UI
│   │
│   ├── dashboard/                # Storage dashboard
│   │   └── page.tsx              # Admin panel for storage metrics
│   │
│   ├── shared/                   # Shared project/thread viewer
│   │   ├── [token]/              # Project share viewer
│   │   │   └── page.tsx          # Public project access
│   │   └── thread/               # Thread share viewer
│   │       └── [token]/          
│   │           └── page.tsx      # Public thread access
│   │
│   ├── globals.css               # Global styles and Tailwind imports
│   ├── layout.tsx                # Root layout with providers
│   └── page.tsx                  # Main application interface
│
├── services/                     # Business logic services
│   ├── threadFileService.ts      # **NEW: File persistence management**
│   ├── apiClient.ts              # HTTP client configuration
│   ├── chatService.ts            # Chat API communication
│   ├── projectService.ts         # Project CRUD operations
│   ├── threadService.ts          # Thread management
│   └── storageService.ts         # Storage metrics and cleanup
│
├── hooks/                        # Custom React hooks
│   ├── useFileUpload.ts          # File upload with validation
│   ├── useProjects.ts            # Project state management
│   ├── useThreads.ts             # Thread operations and caching
│   └── useLocalStorage.ts        # Persistent local state
│
├── components/                   # UI components
│   ├── chat/                     # Chat interface components
│   │   ├── ChatInput.tsx         # Message input with file upload
│   │   ├── ChatMessage.tsx       # Individual message display
│   │   ├── FileDisplay.tsx       # File attachment rendering
│   │   └── MessageList.tsx       # Conversation thread display
│   ├── projects/                 # Project management UI
│   │   ├── ProjectList.tsx       # Project grid with thread counts
│   │   ├── ProjectCard.tsx       # Individual project cards
│   │   └── CreateProject.tsx     # New project modal
│   ├── ui/                       # Reusable UI elements
│   │   ├── Button.tsx            # Consistent button component
│   │   ├── Modal.tsx             # Modal dialog wrapper
│   │   ├── LoadingSpinner.tsx    # Loading indicators
│   │   └── Toast.tsx             # Notification system
│   └── layout/                   # Application layout
│       ├── Sidebar.tsx           # Navigation and project list
│       ├── Header.tsx            # Top navigation bar
│       └── MobileMenu.tsx        # Responsive mobile navigation
│
├── types/                        # TypeScript definitions
│   ├── entities.types.ts         # **UPDATED: Added thread file context types**
│   ├── constants.ts              # Application constants
│   └── api.types.ts              # API response interfaces
│
├── utils/                        # Utility functions
│   ├── fileUtils.ts              # File type detection and validation
│   ├── dateUtils.ts              # Date formatting and manipulation
│   ├── errorHandling.ts          # Centralized error management
│   └── titleGeneration.ts        # Smart title generation logic
│
└── database/                     # Database schema and migrations
    ├── schema.sql                # **UPDATED: Complete Supabase schema**
    └── migrations/               # Database migration scripts
        └── 001_add_is_active_column.sql  # **NEW: File persistence migration**
```

## 🔄 Data Flow Architecture

### 1. User Message Flow with File Persistence
```
User Input → React State → ChatInput Component
    ↓
File Selection (Optional) → Upload to OpenAI → File ID Generation
    ↓
API Route (/api/chat) → Retrieve Existing Thread Files → Combine with New Uploads
    ↓
Message Enhancement (Web Search if enabled) → Tavily API → Search Results Integration
    ↓
OpenAI Assistant API → Thread Creation/Update → Run Execution with ALL Thread Files
    ↓
Response Processing → File Extraction → Vercel Blob Upload
    ↓
Database Update (Supabase) → Update Thread File Context → Frontend State Update → UI Render
```

### 2. File Persistence Flow
```
File Upload → OpenAI Temporary Storage → Thread Association → Database Tracking
    ↓
Subsequent Messages → Retrieve Active Thread Files → Auto-attach to New Messages
    ↓
AI Processing → Access All Thread Files → Generate Context-Aware Responses
    ↓
Usage Analytics → Update Access Statistics → Relevance Score Calculation
```

### 3. Project Organization Flow
```
Create Project → Supabase Insert → Auto-assign Color
    ↓
Start Conversation → Thread Creation → OpenAI Thread ID → File Context Initialization
    ↓
Message Exchange → Auto-save to Project (5s delay) → Thread File Tracking
    ↓
Smart Title Generation → Caribbean Country Detection → Context Analysis
    ↓
Thread Sync → Batch Import from OpenAI → Database Update → File Association
```

## 📊 Database Schema

### Core Tables

**threads**: Conversation threads with metadata
```sql
- id (text, primary key)
- project_id (uuid, foreign key to projects)
- title (text)
- last_activity (timestamp)
- message_count (integer)
- active_file_count (integer) -- NEW: Track active files per thread
```

**file_context_tracking**: Global file metadata and usage
```sql
- id (uuid, primary key) 
- openai_file_id (text, unique)
- project_id (uuid, foreign key)
- original_filename (text)
- file_size (integer)
- file_type (text)
- upload_timestamp (timestamp)
- last_accessed (timestamp)
- access_count (integer)
- relevance_score (double precision)
```

**thread_file_context**: Thread-specific file associations
```sql
- id (uuid, primary key)
- thread_id (text, foreign key to threads)
- file_id (uuid, foreign key to file_context_tracking)
- relevance_score (double precision)
- last_used (timestamp)
- usage_count (integer)
- is_active (boolean) -- NEW: Enable/disable files per thread
- created_at (timestamp)
```

**blob_files**: Vercel Blob storage mapping
```sql
- id (uuid, primary key)
- openai_file_id (text, unique)
- vercel_blob_url (text)
- vercel_file_key (text) 
- filename (text)
- content_type (text)
- file_size (bigint)
- thread_id (text)
```

## 🔌 API Endpoints

### Enhanced Chat Endpoints
- `POST /api/chat` - Send message, receive AI response with automatic file persistence
  - Retrieves existing thread files and attaches to new messages
  - Supports web search, file attachments, JSON responses
  - Updates file usage statistics and thread file counts
  - Returns: reply, threadId, files, searchSources

### File Management Endpoints
- `POST /api/upload` - Upload file to OpenAI with comprehensive type support
- `GET /api/files/[fileId]` - Download file (Vercel Blob priority, OpenAI fallback)
- `GET /api/files/[fileId]?preview=true` - Preview file in browser

### Thread Endpoints (Enhanced)
- `GET /api/threads?threadId=[id]` - Get thread messages with file context
- `POST /api/threads` - Save thread to database with file associations
- `DELETE /api/threads/[id]` - Delete specific thread and file associations
- `POST /api/threads/[id]/download` - Generate ZIP export with all attachments

### Project Endpoints
- `GET /api/projects` - List all projects with thread and file counts
- `POST /api/projects` - Create new project
- `GET /api/projects/[id]` - Get project details with threads and file summary
- `DELETE /api/projects/[id]` - Delete project (cascades to threads and file associations)

## 🚀 Environment Setup

### Prerequisites
- Node.js 20+ (recommended for Supabase compatibility)
- OpenAI API key with Assistant access
- Supabase project with PostgreSQL database
- Vercel Blob storage token
- Tavily API key (optional, for web search)

### Environment Configuration
Create `.env.local` file:
```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_ASSISTANT_ID=your_assistant_id
OPENAI_ORGANIZATION=your_org_id  # Optional

# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key

# Vercel Blob Storage
VERCEL_BLOB_READ_WRITE_TOKEN=your_vercel_blob_token

# Web Search (Optional)
TAVILY_API_KEY=your_tavily_api_key

# App Configuration
NEXT_PUBLIC_BASE_URL=http://localhost:3000  # Update for production
DEBUG_CHAT=true  # Enable debug logging in development
```

### Installation & Setup
```bash
# Clone repository
git clone <repository-url>
cd digital-strategy-bot

# Install dependencies
npm install

# Setup database tables (run in Supabase SQL editor)
# Import schema.sql and run migration scripts

# Start development server
npm run dev
```

### Database Migration (Required)
Run this SQL in your Supabase SQL Editor to enable file persistence:
```sql
-- Add is_active column to thread_file_context table
ALTER TABLE public.thread_file_context 
ADD COLUMN is_active boolean DEFAULT true NOT NULL;

-- Create performance index
CREATE INDEX IF NOT EXISTS idx_thread_file_context_active 
ON public.thread_file_context(thread_id, is_active) 
WHERE is_active = true;
```

## 🔧 Configuration Options

### OpenAI Assistant Setup
- Create an Assistant in OpenAI Playground
- Configure with tools: `code_interpreter`, `file_search`
- Set custom instructions for Caribbean government focus
- Note the Assistant ID for environment variables

### File Persistence Configuration
- **Storage Threshold**: 400MB automatic cleanup trigger
- **Retention Policy**: Files older than 7 days eligible for cleanup
- **Size Limits**: 20MB per file, 500MB total storage
- **Supported Formats**: PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, Images, CSV, JSON, TXT, MD

### Web Search Integration
- Sign up for Tavily API key for real-time web search
- Enable/disable per conversation with toggle
- Automatic source citation in responses
- Configurable search depth and result count

## 🎯 Upcoming Features

### Phase 1: File Management UI
- Visual file management panel with metadata display
- File renaming, removal, and status controls
- Usage analytics dashboard per thread
- Bulk file operations and cleanup tools

### Phase 2: Smart File Context Detection
- Natural language processing for file relevance analysis
- Automatic context optimization based on message content
- Manual override options for explicit file inclusion
- Reduced token usage through intelligent file selection

### Phase 3: Cross-Thread File Sharing
- Project-level file libraries accessible across threads
- File categorization and tagging system
- Advanced search and discovery for uploaded documents
- Collaborative file management for team projects

## 📊 Performance & Monitoring

### Storage Metrics
- Real-time storage usage tracking
- Automated cleanup when thresholds exceeded
- File access analytics and usage patterns
- Performance optimization recommendations

### Response Times
- Average response time: 15-30 seconds with file processing
- File persistence adds <500ms to request processing
- Database operations optimized with strategic indexing
- CDN acceleration for file downloads via Vercel Blob

## 🤝 Contributing

Contributions welcome! Please review the file persistence architecture before making changes to chat or file handling logic. All database modifications should include proper migration scripts.

## 📄 License

MIT License - See LICENSE file for details

---
