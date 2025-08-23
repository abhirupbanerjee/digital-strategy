# Digital Strategy Bot

A modern, AI-powered chat application specifically designed for government consultants working in the Caribbean region. Built with Next.js 15, this platform enables organized conversations through projects, real-time web search, file uploads, and collaborative sharing capabilities.

## 🌟 Key Features

### 🗂️ Project-Based Organization
- **Structured Conversations**: Organize related chats into projects with custom colors and descriptions
- **Thread Management**: Multiple conversation threads within each project
- **Smart Titles**: AI-generated contextual titles based on conversation content (Caribbean country detection)
- **Auto-sync**: Sync existing OpenAI assistant threads into your project database

### 🤖 Advanced AI Capabilities
- **OpenAI GPT Integration**: Powered by OpenAI's Assistant API with GPT-4
- **Real-time Web Search**: Tavily API integration for current information
- **Comprehensive File Support**: PDF, DOC, PPT, Excel, CSV, Images, TXT (up to 20MB)
- **Intelligent File Processing**: Automatic file analysis and content extraction
- **Response Formatting**: Default, bullet points, tables, or preserve existing structures

### 🔗 Collaboration & Sharing
- **Secure Link Sharing**: Generate time-limited share links (1 day to 1 month)
- **Granular Permissions**: Read-only or full collaboration access
- **Project-Level Sharing**: Share entire projects with all conversations
- **Thread-Level Sharing**: Share individual conversation threads
- **Automatic Expiry**: Built-in security with configurable expiration

### 💾 Robust Data Management
- **Persistent Storage**: Supabase backend for reliable data persistence
- **File Storage**: Vercel Blob integration with automatic cleanup
- **Message History**: Complete conversation history with timestamps
- **Content Extraction**: Copy tables, code blocks, lists, or full responses
- **Storage Management**: Automatic cleanup at 400MB threshold with 7-day retention policy

### 📱 Cross-Platform Design
- **Mobile Optimized**: Full mobile support with touch-friendly interface
- **Responsive Layout**: Adaptive design for all screen sizes
- **Desktop Features**: Advanced sidebar, keyboard shortcuts, and multi-panel layout
- **Real-time Updates**: Live typing indicators and message status

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

**UI Libraries**
- **React Markdown 10**: Markdown rendering with GitHub-flavored markdown
- **Lucide React**: Modern icon library
- **Remark GFM**: GitHub Flavored Markdown support
- **Custom Components**: Project-specific UI elements


## 📱 User Interface

### Desktop Interface
- **Three-Panel Layout**: Projects sidebar, thread list, main chat area
- **Collapsible Sidebar**: Toggle project panel visibility
- **Advanced Controls**: Keyboard shortcuts (Shift+Enter for new line, Ctrl+Enter for quick actions)
- **File Management**: Drag-and-drop file upload with preview
- **Multi-Tab Support**: Open multiple threads in tabs (planned)
- **Storage Dashboard**: Full metrics and management interface at `/dashboard`

### Mobile Interface
- **Single-Column Layout**: Optimized for touch interaction
- **Slide-Out Sidebar**: Swipe or tap to access projects
- **Simplified Controls**: Large touch targets, minimal UI
- **Contextual Actions**: Three-dot menus for thread/project options
- **Responsive Tables**: Horizontal scrolling for data tables
- **Quick Actions**: Bottom navigation for common tasks

### Responsive Breakpoints
- **Mobile**: < 768px (simplified UI, touch-optimized)
- **Tablet**: 768px - 1024px (hybrid layout)
- **Desktop**: > 1024px (full feature set)

### Complete File Structure

```
digital-strategy-bot/
├── app/                          # Next.js 15 App Router
│   ├── api/                      # API Routes
│   │   ├── chat/                 # Main chat endpoint
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
│   │   │   │   └── download/     # Thread export functionality
│   │   │   │       └── route.ts  # Generate ZIP with PDF and attachments
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
│   │   ├── [token]/              # Public project access
│   │   │   └── page.tsx          # Read-only/collaborative project interface
│   │   └── thread/               # Public thread access
│   │       └── [token]/          
│   │           └── page.tsx      # Read-only/collaborative thread interface
│   │
│   ├── globals.css               # Global styles, responsive tables
│   ├── layout.tsx                # Root layout with metadata
│   └── page.tsx                  # Main chat application
│
├── components/                   # Organized component library
│   ├── chat/                     # Chat-related components
│   │   ├── ChatInput.tsx         # Message input with file upload
│   │   ├── MessageItem.tsx       # Individual message display
│   │   ├── MessageList.tsx       # Message container with scroll
│   │   └── WebSearchToggle.tsx   # Web search enable/disable
│   ├── common/                   # Shared components
│   │   ├── FileRenderer.tsx      # File display and download
│   │   ├── JumpButtons.tsx       # Navigation jump to top/bottom
│   │   └── TypingIndicator.tsx   # AI typing animation
│   ├── error/                    # Error handling
│   │   └── ErrorBoundary.tsx     # React error boundary
│   ├── markdown/                 # Markdown rendering
│   │   └── MarkdownMessage.tsx   # Custom markdown renderer
│   ├── modals/                   # Modal dialogs
│   │   ├── NewProjectModal.tsx   # Create new project dialog
│   │   └── ShareModal.tsx        # Share link management
│   └── sidebar/                  # Sidebar components
│       ├── ProjectList.tsx       # Project list display
│       ├── ProjectSidebar.tsx    # Main sidebar container
│       └── ThreadList.tsx        # Thread list within projects
│
├── hooks/                        # Custom React hooks
│   ├── useAutoSave.ts            # Auto-save thread functionality
│   ├── useChat.ts                # Chat state management
│   ├── useFileUpload.ts          # File upload handling
│   ├── useProjects.ts            # Project state management
│   ├── useThreads.ts             # Thread state management
│   └── useWebSearch.ts           # Web search toggle state
│
├── lib/                          # Utility libraries
│   └── supabase-server.ts        # Server-side Supabase client
│
├── services/                     # API service layer
│   ├── apiClient.ts              # Base fetch wrapper with error handling
│   ├── chatService.ts            # Chat API interactions
│   ├── projectService.ts         # Project API interactions
│   └── threadService.ts          # Thread API interactions
│
├── types/                        # TypeScript type definitions
│   ├── constants.ts              # Application constants
│   ├── entities.types.ts         # Core data type definitions
│   └── ui.types.ts               # UI state type definitions
│
├── utils/                        # Utility functions
│   ├── contentUtils.ts           # Content processing and cleaning
│   ├── errorHandler.ts           # Error formatting and logging
│   ├── fileUtils.ts              # File upload and icon helpers
│   └── threadUtils.ts            # Thread title generation
│
├── public/                       # Static assets
│   └── icon.png                  # Application icon
│
├── package.json                  # Dependencies and scripts
├── next.config.js                # Next.js configuration
├── tailwind.config.js            # Tailwind CSS configuration
├── tsconfig.json                 # TypeScript configuration
└── .env.local                    # Environment variables (not tracked)
```



## 🔌 API Endpoints

### Chat Endpoints
- `POST /api/chat` - Send message, receive AI response
  - Supports web search, file attachments, JSON responses
  - Returns: reply, threadId, files, searchSources

### Project Endpoints
- `GET /api/projects` - List all projects with thread counts
- `POST /api/projects` - Create new project
- `GET /api/projects/[id]` - Get project details with threads
- `DELETE /api/projects/[id]` - Delete project (cascades to threads)
- `POST /api/projects/[id]/shares` - Create project share link
- `GET /api/projects/[id]/shares` - List active share links
- `DELETE /api/projects/[id]/shares?token=[token]` - Revoke share link

### Thread Endpoints
- `GET /api/threads?threadId=[id]` - Get thread messages
- `POST /api/threads` - Save thread to database
- `DELETE /api/threads/[id]` - Delete specific thread
- `POST /api/threads/[id]/shares` - Create thread share link
- `GET /api/threads/[id]/shares` - List thread share links
- `DELETE /api/threads/[id]/shares?token=[token]` - Revoke share
- `POST /api/threads/[id]/download` - Generate ZIP export

### File Endpoints
- `POST /api/upload` - Upload file to OpenAI
- `GET /api/files/[fileId]` - Download file (Vercel Blob priority)
- `GET /api/files/[fileId]?preview=true` - Preview file in browser

### Storage Management
- `GET /api/vercel-storage/stats` - Get storage metrics
- `POST /api/vercel-storage/stats` - Recalculate metrics
- `POST /api/vercel-storage/cleanup` - Trigger storage cleanup
- `POST /api/vercel-storage/upload` - Manual file upload to blob
- `GET /api/vercel-storage/download/[fileKey]` - Direct blob download

### Utility Endpoints
- `POST /api/sync-threads` - Sync OpenAI threads with smart titles
- `POST /api/cleanup-threads` - Clean search artifacts from messages
- `POST /api/search` - Perform web search (Tavily API)
- `GET /api/shared/[token]` - Validate project share token
- `GET /api/shared/thread/[token]` - Validate thread share token

## 🔄 Data Flow Architecture

### 1. User Message Flow
```
User Input → React State → ChatInput Component
    ↓
File Selection (Optional) → Upload to OpenAI → File ID Generation
    ↓
API Route (/api/chat) → Message Enhancement
    ↓
Web Search (if enabled) → Tavily API → Search Results Integration
    ↓
OpenAI Assistant API → Thread Creation/Update → Run Execution
    ↓
Response Processing → File Extraction → Vercel Blob Upload
    ↓
Database Update (Supabase) → Frontend State Update → UI Render
```

### 2. File Storage Flow
```
File Selection → Frontend Validation (20MB limit, type check)
    ↓
Upload API (/api/upload) → OpenAI File API (temporary storage)
    ↓
Assistant Response → File Generation → Auto-upload to Vercel Blob
    ↓
Supabase Mapping (blob_files table) → URL Generation
    ↓
Storage Metrics Update → Threshold Check (400MB)
    ↓
Automatic Cleanup (if needed) → 7-day retention policy
```

### 3. Project Organization Flow
```
Create Project → Supabase Insert → Auto-assign Color
    ↓
Start Conversation → Thread Creation → OpenAI Thread ID
    ↓
Message Exchange → Auto-save to Project (5s delay)
    ↓
Smart Title Generation → Caribbean Country Detection
    ↓
Thread Sync → Batch Import from OpenAI → Database Update
```

### 4. Sharing & Collaboration Flow
```
Share Request → Permission Selection (read/collaborate)
    ↓
Token Generation (crypto.randomUUID) → Expiry Setting (1-30 days)
    ↓
Database Storage (project_shares/thread_shares) → URL Generation
    ↓
Share Link Access → Token Validation → Permission Check
    ↓
Collaborative Interface → Real-time Updates → Message Sync
```

## 🗄️ Database Schema (Supabase)

### Projects Table
```sql
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Threads Table
```sql
CREATE TABLE threads (
  id TEXT PRIMARY KEY,              -- OpenAI thread ID
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Project Shares Table
```sql
CREATE TABLE project_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  share_token TEXT UNIQUE NOT NULL,
  permissions TEXT CHECK (permissions IN ('read', 'collaborate')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Thread Shares Table
```sql
CREATE TABLE thread_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id TEXT REFERENCES threads(id) ON DELETE CASCADE,
  share_token TEXT UNIQUE NOT NULL,
  permissions TEXT CHECK (permissions IN ('read', 'collaborate')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Blob Files Table (File Storage Mapping)
```sql
CREATE TABLE blob_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  openai_file_id TEXT UNIQUE NOT NULL,
  vercel_blob_url TEXT NOT NULL,
  vercel_file_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT,
  file_size BIGINT,
  thread_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Storage Metrics Table
```sql
CREATE TABLE storage_metrics (
  id UUID DEFAULT '00000000-0000-0000-0000-000000000000' PRIMARY KEY,
  total_size_bytes BIGINT DEFAULT 0,
  file_count INTEGER DEFAULT 0,
  last_cleanup_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 18+ and npm/yarn
- OpenAI API account with Assistant configured
- Supabase project with tables created
- Tavily API key (optional, for web search)
- Vercel account for blob storage

### 1. Environment Setup
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
```

### 2. Installation & Setup
```bash
# Clone repository
git clone <repository-url>
cd digital-strategy-bot

# Install dependencies
npm install

# Setup database tables (run in Supabase SQL editor)
# See database schema section above

# Start development server
npm run dev
```

### 3. Production Deployment
```bash
# Build application
npm run build

# Deploy to Vercel (recommended)
vercel --prod

# Or deploy to other platforms
npm start
```

## 🔧 Configuration Options

### OpenAI Assistant Setup
- Create an Assistant in OpenAI Playground
- Configure with tools: `code_interpreter`, `file_search`
- Note the Assistant ID for environment variables
- Optionally set custom instructions for Caribbean government focus

### Web Search Integration
- Sign up for Tavily API key
- Enable in environment variables
- Toggle on/off per conversation
- Automatic source citation in responses

### File Storage Configuration
- **Vercel Blob**: Primary storage with CDN
- **Cleanup Policy**: Automatic cleanup at 400MB threshold
- **Retention**: Files older than 7 days eligible for cleanup
- **Size Limits**: 20MB per file, 500MB total storage

### Sharing Security
- **Token-based**: Cryptographically secure share tokens
- **Time-limited**: Configurable expiration (1 day to 1 month)
- **Permission levels**: Read-only or full collaboration
- **Auto-revocation**: Expired links automatically invalidated

## 📊 Advanced Features

### Smart Title Generation
- **Context Analysis**: Analyzes first 3 substantial user messages
- **Caribbean Detection**: Recognizes all Caribbean countries and territories
- **Topic Patterns**: Identifies government, digital strategy topics
- **Fallback Logic**: Graceful handling of edge cases
- **Multi-language**: Supports various input formats

### Response Format Options
- **Default**: Natural AI conversation
- **Bullets**: Structured bullet-point responses
- **Tables**: Data organized in HTML tables
- **Preserve Tables**: Maintains existing table structures
- **JSON Format**: Structured JSON responses for integration

### Mobile Optimization
- **Touch Interface**: Optimized for mobile interaction
- **Responsive Tables**: Horizontal scrolling for large tables
- **Gesture Support**: Swipe and touch-friendly controls
- **Offline Viewing**: Cached conversations available offline
- **Progressive Web App**: Installable on mobile devices

### Storage Management
- **Usage Dashboard**: Real-time storage metrics at `/dashboard`
- **Automatic Cleanup**: Background cleanup when threshold exceeded
- **File Deduplication**: Prevents duplicate file storage
- **Access Tracking**: Last accessed timestamps for cleanup prioritization
- **Manual Controls**: Force cleanup and metrics recalculation

## 🛠️ Development Guidelines

### Code Organization
- **Component Structure**: Modular, reusable components
- **Type Safety**: Full TypeScript coverage
- **API Standards**: RESTful API design with proper error handling
- **State Management**: React hooks with local state
- **Service Layer**: Abstracted API calls for maintainability

### Performance Optimization
- **Server Components**: Leverage Next.js 15 server components
- **Image Optimization**: Automatic image optimization
- **Code Splitting**: Automatic route-based code splitting
- **Caching**: Proper HTTP caching headers
- **Lazy Loading**: Component and route lazy loading

### Security Best Practices
- **Environment Variables**: Sensitive data in environment variables only
- **Input Validation**: Server-side validation for all inputs
- **SQL Injection Prevention**: Parameterized queries via Supabase
- **XSS Protection**: Sanitized markdown rendering
- **CORS Configuration**: Proper cross-origin resource sharing

## 🔍 Troubleshooting

### Common Issues

**File Upload Failures**
- Check file size (max 20MB)
- Verify supported file types
- Ensure OpenAI API key has file permissions
- Check Vercel Blob token validity

**Thread Sync Issues**
- Verify OpenAI Assistant ID
- Check thread permissions
- Run manual sync via project panel
- Ensure thread exists in OpenAI

**Share Link Problems**
- Verify link hasn't expired
- Check permissions (read vs collaborate)
- Ensure database connectivity
- Validate share token format

**Storage Issues**
- Monitor storage usage at `/dashboard`
- Run manual cleanup if needed
- Check Vercel Blob token permissions
- Verify cleanup threshold settings

### Debug Mode
Enable detailed logging by setting:
```env
NODE_ENV=development
DEBUG=true
DEBUG_CHAT=true
DEBUG_SYNC=true
```

### Code Standards
- **TypeScript**: All new code must be typed
- **Components**: Use functional components with hooks
- **Styling**: Tailwind CSS for all styling
- **Testing**: Test on multiple screen sizes
- **Documentation**: Update README for new features

## 📄 License

This project is licensed under the MIT License. See LICENSE file for details.

## 🆘 Support

For questions, issues, or feature requests:
- **Issues**: GitHub Issues tracker
- **Documentation**: This README and inline code comments


---

**Built with ❤️ for Caribbean Digital Transformation**