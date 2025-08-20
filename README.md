# Digital Strategy Bot

A modern, AI-powered chat application specifically designed for government consultants working in the Caribbean region. Built with Next.js 15, this platform enables organized conversations through projects, real-time web search, file uploads, and collaborative sharing capabilities.

## 🌟 Key Features

### 🗂️ Project-Based Organization
- **Structured Conversations**: Organize related chats into projects with custom colors and descriptions
- **Thread Management**: Multiple conversation threads within each project
- **Smart Titles**: AI-generated contextual titles based on conversation content
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
- **Automatic Expiry**: Built-in security with configurable expiration

### 💾 Robust Data Management
- **Persistent Storage**: Supabase backend for reliable data persistence
- **File Storage**: Vercel Blob integration with automatic cleanup
- **Message History**: Complete conversation history with timestamps
- **Content Extraction**: Copy tables, code blocks, lists, or full responses

### 📱 Cross-Platform Design
- **Mobile Optimized**: Full mobile support with touch-friendly interface
- **Responsive Layout**: Adaptive design for all screen sizes
- **Desktop Features**: Advanced sidebar, keyboard shortcuts, and multi-panel layout
- **Real-time Updates**: Live typing indicators and message status

## 🏗️ Architecture Overview

### Technology Stack

**Frontend Framework**
- **Next.js 15**: React-based framework with App Router
- **TypeScript**: Full type safety throughout the application
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Framer Motion**: Smooth animations and transitions

**Backend Services**
- **Next.js API Routes**: Server-side API endpoints
- **OpenAI Assistant API**: AI conversation engine
- **Tavily API**: Web search capabilities
- **Supabase**: PostgreSQL database with real-time features

**Storage Solutions**
- **Vercel Blob**: File storage with automatic CDN distribution
- **Supabase Storage**: Metadata and file mapping
- **OpenAI File Storage**: Temporary file processing (48-hour retention)

**UI Libraries**
- **React Markdown**: Markdown rendering with GitHub-flavored markdown
- **Lucide React**: Modern icon library
- **Custom Components**: Project-specific UI elements

### File Structure

```
digital-strategy-bot/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── chat/                 # Main chat endpoint
│   │   │   └── route.ts          # Message processing and AI responses
│   │   ├── projects/             # Project management
│   │   │   ├── [id]/             # Individual project operations
│   │   │   │   ├── route.ts      # Get/delete project
│   │   │   │   └── shares/       # Project sharing
│   │   │   │       └── route.ts  # Create/manage share links
│   │   │   └── route.ts          # List/create projects
│   │   ├── threads/              # Thread operations
│   │   │   ├── [id]/             # Individual thread operations
│   │   │   │   └── route.ts      # Delete specific thread
│   │   │   └── route.ts          # List threads, save thread data
│   │   ├── files/                # File handling
│   │   │   └── [fileId]/         # File download endpoint
│   │   │       └── route.ts      # Serve files with fallback logic
│   │   ├── upload/               # File upload processing
│   │   │   └── route.ts          # Multi-format file upload to OpenAI
│   │   ├── shared/               # Share link validation
│   │   │   └── [token]/          # Validate and serve shared projects
│   │   │       └── route.ts      # Share token verification
│   │   ├── sync-threads/         # Thread synchronization
│   │   │   └── route.ts          # Sync OpenAI threads to database
│   │   ├── cleanup-threads/      # Database maintenance
│   │   │   └── route.ts          # Clean legacy data artifacts
│   │   ├── search/               # Web search integration
│   │   │   └── route.ts          # Tavily API integration
│   │   └── vercel-storage/       # Storage management
│   │       ├── cleanup/          # Storage cleanup automation
│   │       ├── download/         # Direct blob downloads
│   │       ├── stats/            # Storage usage metrics
│   │       └── upload/           # Manual blob uploads
│   ├── components/               # Reusable React components
│   │   └── ShareModal.tsx        # Share link management UI
│   ├── dashboard/                # Storage dashboard
│   │   └── page.tsx              # Admin panel for storage metrics
│   ├── shared/                   # Shared project viewer
│   │   └── [token]/              # Public project access
│   │       └── page.tsx          # Read-only/collaborative interface
│   ├── globals.css               # Global styles and responsive tables
│   ├── layout.tsx                # Root layout with metadata
│   ├── page.tsx                  # Main chat application
│   └── page (copy).tsx           # Development backup
├── lib/                          # Utility libraries
│   └── supabase-server.ts        # Server-side Supabase client
├── public/                       # Static assets
│   └── icon.png                  # Application icon
├── package.json                  # Dependencies and scripts
├── next.config.js                # Next.js configuration
├── tailwind.config.js            # Tailwind CSS configuration
├── tsconfig.json                 # TypeScript configuration
└── .env.local                    # Environment variables (not tracked)
```

### Database Schema (Supabase)

**Projects Table**
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

**Threads Table**
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

**Project Shares Table**
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

**Blob Files Table** (File Storage Mapping)
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

**Storage Metrics Table**
```sql
CREATE TABLE storage_metrics (
  id UUID DEFAULT '00000000-0000-0000-0000-000000000000' PRIMARY KEY,
  total_size_bytes BIGINT DEFAULT 0,
  file_count INTEGER DEFAULT 0,
  last_cleanup_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🔄 Data Flow Architecture

### 1. User Message Flow
```
User Input → Frontend State → API Route (/api/chat) → OpenAI Assistant API
    ↓
Enhanced with:
- Web Search (Tavily API) if enabled
- File attachments (OpenAI File API)
- Response formatting preferences
    ↓
AI Response → File Processing (Vercel Blob) → Database Storage → Frontend Update
```

### 2. File Upload Flow
```
File Selection → Frontend Validation → Upload API (/api/upload)
    ↓
OpenAI File API → File Processing → Vercel Blob Storage
    ↓
Database Mapping → Storage Metrics Update → Cleanup Check
```

### 3. Project Sharing Flow
```
Share Request → Token Generation → Database Storage (/api/projects/[id]/shares)
    ↓
Share Link → Token Validation (/api/shared/[token]) → Project Access
    ↓
Permission Check → Read-only or Collaborative Interface
```

### 4. Thread Synchronization Flow
```
Project Selection → OpenAI Thread Detection → Sync Request (/api/sync-threads)
    ↓
Thread Fetching → Message Processing → Smart Title Generation
    ↓
Database Storage → Project Update → Frontend Refresh
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
- **Topic Detection**: Recognizes Caribbean countries and government topics
- **Fallback Logic**: Graceful handling of edge cases
- **Multi-language**: Supports various input formats

### Response Format Options
- **Default**: Natural AI conversation
- **Bullets**: Structured bullet-point responses
- **Tables**: Data organized in HTML tables
- **Preserve Tables**: Maintains existing table structures

### Mobile Optimization
- **Touch Interface**: Optimized for mobile interaction
- **Responsive Tables**: Horizontal scrolling for large tables
- **Gesture Support**: Swipe and touch-friendly controls
- **Offline Viewing**: Cached conversations available offline

### Storage Management
- **Usage Dashboard**: Real-time storage metrics at `/dashboard`
- **Automatic Cleanup**: Background cleanup when threshold exceeded
- **File Deduplication**: Prevents duplicate file storage
- **Access Tracking**: Last accessed timestamps for cleanup prioritization

## 🛠️ Development Guidelines

### Code Organization
- **Component Structure**: Modular, reusable components
- **Type Safety**: Full TypeScript coverage
- **API Standards**: RESTful API design with proper error handling
- **State Management**: React hooks with local state

### Performance Optimization
- **Server Components**: Leverage Next.js server components
- **Image Optimization**: Automatic image optimization
- **Code Splitting**: Automatic route-based code splitting
- **Caching**: Proper HTTP caching headers

### Security Best Practices
- **Environment Variables**: Sensitive data in environment variables only
- **Input Validation**: Server-side validation for all inputs
- **SQL Injection Prevention**: Parameterized queries via Supabase
- **XSS Protection**: Sanitized markdown rendering

## 🔍 Troubleshooting

### Common Issues

**File Upload Failures**
- Check file size (max 20MB)
- Verify supported file types
- Ensure OpenAI API key has file permissions

**Thread Sync Issues**
- Verify OpenAI Assistant ID
- Check thread permissions
- Run manual sync via project panel

**Share Link Problems**
- Verify link hasn't expired
- Check permissions (read vs collaborate)
- Ensure database connectivity

**Storage Issues**
- Monitor storage usage at `/dashboard`
- Run manual cleanup if needed
- Check Vercel Blob token permissions

### Debug Mode
Enable detailed logging by setting:
```env
NODE_ENV=development
DEBUG=true
```

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Make changes with proper TypeScript types
4. Test thoroughly on mobile and desktop
5. Submit pull request with clear description

### Code Standards
- **TypeScript**: All new code must be typed
- **Components**: Use functional components with hooks
- **Styling**: Tailwind CSS for all styling
- **Testing**: Test on multiple screen sizes

## 📄 License

This project is licensed under the MIT License. See LICENSE file for details.

## 🆘 Support

For questions, issues, or feature requests:
- **Issues**: GitHub Issues tracker
- **Documentation**: This README and inline code comments
- **Community**: Project discussions

---

