# Digital Strategy Bot

A modern, AI-powered chat application specifically designed for government consultants working in the Caribbean region. Built with Next.js 15, this platform enables organized conversations through projects, real-time web search, file uploads, and collaborative sharing capabilities.

## 🌟 Key Features

### 🗂️ Project-Based Organization
- **Structured Conversations**: Organize related chats into projects with custom colors and descriptions
- **Thread Management**: Multiple conversation threads within each project
- **Paginated Thread Display**: Shows 10 threads initially with "Show More" functionality
- **Auto-save**: New threads automatically saved and appear at top of list
- **Date-based Sorting**: Threads sorted by most recent activity
- **Smart Titles**: AI-generated contextual titles based on conversation content
- **Auto-sync**: Sync existing OpenAI assistant threads into your project database

### 🤖 Advanced AI Capabilities
- **OpenAI GPT Integration**: Powered by OpenAI's Assistant API with GPT-4
- **Real-time Web Search**: Tavily API integration for current information
- **Comprehensive File Support**: PDF, DOC, PPT, Excel, CSV, Images, TXT (up to 20MB)
  - Uses OpenAI's code_interpreter for Excel/CSV analysis
  - Supports multiple file uploads in a single message
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
- **Progressive Web App**: Installable on mobile devices

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

## 🚀 Quick Start Guide

### System Requirements
- **Node.js**: 20.0.0 or later (Node.js 18 is deprecated)
- **NPM**: 8.0.0 or later
- **Operating System**: macOS, Windows, or Linux
- **Browser**: Modern browser with JavaScript enabled

> ⚠️ **Important**: Node.js 18 and below are deprecated for Supabase compatibility and will cause warnings. Please upgrade to Node.js 20+.

### Prerequisites
- OpenAI API account with Assistant configured
- Supabase project with tables created
- Tavily API key (optional, for web search)
- Vercel account for blob storage and deployment

### 1. Environment Setup

Create `.env.local` file in the project root:

```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_ASSISTANT_ID=your_assistant_id
OPENAI_ORGANIZATION=your_org_id  # Optional

# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
SUPABASE_ANON_KEY=your_supabase_anon_key

# Vercel Blob Storage
VERCEL_BLOB_READ_WRITE_TOKEN=your_vercel_blob_token

# Web Search (Optional)
TAVILY_API_KEY=your_tavily_api_key

# App Configuration
NEXT_PUBLIC_BASE_URL=http://localhost:3000  # Update for production
SHARE_DEFAULT_EXPIRY_DAYS=1
SHARE_MAX_EXPIRY_DAYS=30

# Debug Configuration (Optional)
DEBUG=false
DEBUG_CHAT=false
DEBUG_SYNC=false
```

### 2. Installation & Setup

```bash
# Clone repository
git clone <repository-url>
cd digital-strategy-bot

# Verify Node.js version (should be 20+)
node --version

# Install dependencies
npm install

# Setup database tables (see Database Schema section)

# Start development server
npm run dev
```

### 3. Database Setup

Execute the following SQL in your Supabase SQL editor:

<details>
<summary>Click to view SQL schema</summary>

```sql
-- Projects Table
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Threads Table
CREATE TABLE threads (
  id TEXT PRIMARY KEY,              -- OpenAI thread ID
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project Shares Table
CREATE TABLE project_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  share_token TEXT UNIQUE NOT NULL,
  permissions TEXT CHECK (permissions IN ('read', 'collaborate')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Thread Shares Table
CREATE TABLE thread_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id TEXT REFERENCES threads(id) ON DELETE CASCADE,
  share_token TEXT UNIQUE NOT NULL,
  permissions TEXT CHECK (permissions IN ('read', 'collaborate')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Blob Files Table
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

-- Storage Metrics Table
CREATE TABLE storage_metrics (
  id UUID DEFAULT '00000000-0000-0000-0000-000000000000' PRIMARY KEY,
  total_size_bytes BIGINT DEFAULT 0,
  file_count INTEGER DEFAULT 0,
  last_cleanup_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

</details>

## 🚀 Deployment

### Development Deployment Pipeline: `Local → Git → Vercel`

The application is optimized for Vercel deployment with automatic builds from Git commits.

### Available Scripts

```bash
# Development
npm run dev          # Start development server (localhost:3000)

# Production Testing
npm run build        # Build for production
npm start           # Test production build locally

# Deployment
npm run deploy       # Deploy to Vercel production
npm run deploy:preview  # Deploy to Vercel preview

# Maintenance
npm run lint        # Run ESLint checks
```

### Vercel Deployment Setup

1. **Connect Repository**: Link your Git repository to Vercel
2. **Configure Environment Variables**: Add all `.env.local` variables to Vercel dashboard
3. **Automatic Deployments**: Every `git push` triggers automatic deployment

#### Manual Deployment (if needed)
```bash
# Install Vercel CLI
npm i -g vercel

# Login and deploy
vercel login
npm run deploy
```

### Production Checklist

- [ ] Node.js 20+ verified
- [ ] All environment variables configured in Vercel
- [ ] Database tables created in Supabase
- [ ] OpenAI Assistant configured with proper tools
- [ ] Vercel Blob storage token active
- [ ] Custom domain configured (optional)

## 🔧 Configuration Options

### OpenAI Assistant Setup
- Create an Assistant in OpenAI Playground
- Configure with tools: `code_interpreter`, `file_search`
- Note the Assistant ID for environment variables
- Optionally set custom instructions for Caribbean government focus

### Next.js Configuration

Create `next.config.js` for development CORS handling:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/(.*)',
          headers: [
            { key: 'Access-Control-Allow-Origin', value: '*' },
            { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
            { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' }
          ]
        }
      ]
    }
    return []
  }
}

module.exports = nextConfig
```

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

## 🔍 Troubleshooting

### Common Issues

#### **Node.js Version Warnings**
```
⚠️  Node.js 18 and below are deprecated and will no longer be supported in future versions of @supabase/supabase-js
```
**Solution**: Upgrade to Node.js 20+
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version  # Should show v20.x.x
```

#### **Next.js Cross-Origin Warnings**
```
⚠ Cross origin request detected... you will need to explicitly configure "allowedDevOrigins"
```
**Solution**: Add `next.config.js` (see Configuration section above)

#### **File Upload Failures**
- Check file size (max 20MB)
- Verify supported file types
- Ensure OpenAI API key has file permissions
- Check Vercel Blob token validity

#### **Thread Sync Issues**
- Verify OpenAI Assistant ID
- Check thread permissions
- Run manual sync via project panel
- Ensure thread exists in OpenAI

### Debug Mode
Enable detailed logging:
```env
DEBUG=true
DEBUG_CHAT=true
DEBUG_SYNC=true
```

## 📊 Performance & Optimization

### Built-in Optimizations
- **Code Splitting**: Automatic route-based code splitting
- **Caching**: Proper HTTP caching headers
- **Lazy Loading**: Component and route lazy loading
- **Image Optimization**: Next.js automatic image optimization
- **Bundle Analysis**: Built-in bundle analyzer

### Security Best Practices
- **Environment Variables**: Sensitive data in environment variables only
- **Input Validation**: Server-side validation for all inputs
- **SQL Injection Prevention**: Parameterized queries via Supabase
- **XSS Protection**: Sanitized markdown rendering
- **CORS Configuration**: Proper cross-origin resource sharing

## 🛠️ Development

### Code Standards
- **TypeScript**: All new code must be typed
- **Components**: Use functional components with hooks
- **Styling**: Tailwind CSS for all styling
- **Testing**: Test on multiple screen sizes
- **Documentation**: Update README for new features

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
│   │   │   │       └── route.ts  # Generate ZIP downloads with conversation & files
│   │   │   └── route.ts          # Thread cleanup and content processing
│   │   └── files/                # File management endpoints
│   │       └── [id]/             # File download and proxy routes
│   │           └── route.ts      # File serving and blob URL handling
│   ├── components/               # React UI Components
│   │   ├── ui/                   # Base UI components
│   │   │   ├── Button.tsx        # Reusable button component
│   │   │   ├── Input.tsx         # Form input components
│   │   │   ├── Modal.tsx         # Modal dialog component
│   │   │   ├── Spinner.tsx       # Loading spinner component
│   │   │   └── Toast.tsx         # Toast notification system
│   │   ├── chat/                 # Chat-specific components
│   │   │   ├── ChatInterface.tsx # Main chat UI container
│   │   │   ├── MessageBubble.tsx # Individual message display
│   │   │   ├── MessageInput.tsx  # Message composition interface
│   │   │   ├── TypingIndicator.tsx # Real-time typing feedback
│   │   │   └── FileUpload.tsx    # File upload and preview component
│   │   ├── project/              # Project management components
│   │   │   ├── ProjectSidebar.tsx    # Projects list and navigation
│   │   │   ├── ProjectCard.tsx       # Individual project display
│   │   │   ├── CreateProject.tsx     # New project creation form
│   │   │   ├── ProjectSettings.tsx   # Project configuration
│   │   │   └── ColorPicker.tsx       # Project color selection
│   │   ├── thread/               # Thread management components
│   │   │   ├── ThreadList.tsx    # Thread listing with pagination
│   │   │   ├── ThreadItem.tsx    # Individual thread display
│   │   │   ├── ThreadActions.tsx # Thread action menu (delete, share, etc.)
│   │   │   └── ThreadTitle.tsx   # Thread title editing
│   │   ├── sharing/              # Sharing and collaboration components
│   │   │   ├── ShareModal.tsx    # Share link generation interface
│   │   │   ├── ShareSettings.tsx # Permission and expiry settings
│   │   │   └── SharedView.tsx    # Read-only shared conversation view
│   │   ├── storage/              # Storage management components
│   │   │   ├── StorageDashboard.tsx # Storage usage overview
│   │   │   ├── FileManager.tsx      # File listing and management
│   │   │   └── CleanupControls.tsx  # Manual cleanup controls
│   │   └── common/               # Common utility components
│   │       ├── Layout.tsx        # Main application layout
│   │       ├── Header.tsx        # Application header with navigation
│   │       ├── Sidebar.tsx       # Collapsible sidebar container
│   │       ├── LoadingStates.tsx # Various loading state components
│   │       └── ErrorBoundary.tsx # Error handling and display
│   ├── dashboard/                # Storage dashboard page
│   │   └── page.tsx             # Storage metrics and management interface
│   ├── shared/                   # Shared conversation pages
│   │   ├── project/             # Shared project views
│   │   │   └── [token]/         # Project share token handler
│   │   │       └── page.tsx     # Shared project interface
│   │   └── thread/              # Shared thread views
│   │       └── [token]/         # Thread share token handler
│   │           └── page.tsx     # Shared thread interface
│   ├── globals.css              # Global CSS styles and Tailwind imports
│   ├── layout.tsx               # Root layout component
│   ├── page.tsx                 # Main application page
│   └── favicon.ico              # Application favicon
│
├── lib/                         # Core utility libraries
│   ├── supabase/               # Supabase configuration and utilities
│   │   ├── client.ts           # Client-side Supabase client
│   │   ├── server.ts           # Server-side Supabase client
│   │   └── types.ts            # Supabase-generated types
│   ├── openai/                 # OpenAI integration utilities
│   │   ├── client.ts           # OpenAI client configuration
│   │   ├── assistants.ts       # Assistant management functions
│   │   └── fileHandling.ts     # File upload and processing utilities
│   ├── storage/                # File storage utilities
│   │   ├── blobStorage.ts      # Vercel Blob storage operations
│   │   ├── fileUtils.ts        # File type detection and validation
│   │   └── cleanup.ts          # Storage cleanup and maintenance
│   └── utils/                  # General utility functions
│       ├── api.ts              # API client and error handling
│       ├── constants.ts        # Application constants
│       ├── formatting.ts       # Text and date formatting utilities
│       ├── validation.ts       # Input validation functions
│       └── encryption.ts       # Share token generation and validation
│
├── types/                      # TypeScript type definitions
│   ├── database.ts            # Supabase database types
│   ├── openai.ts              # OpenAI API types
│   ├── api.ts                 # API request/response types
│   ├── ui.ts                  # UI component types
│   ├── sharing.ts             # Sharing and collaboration types
│   └── storage.ts             # File storage types
│
├── hooks/                     # Custom React hooks
│   ├── useChat.ts            # Chat state management
│   ├── useProjects.ts        # Project data fetching and management
│   ├── useThreads.ts         # Thread operations and state
│   ├── useFileUpload.ts      # File upload handling
│   ├── useStorage.ts         # Storage monitoring and cleanup
│   ├── useSharing.ts         # Share link management
│   └── useLocalStorage.ts    # Browser storage utilities
│
├── context/                   # React context providers
│   ├── ChatContext.tsx       # Global chat state context
│   ├── ProjectContext.tsx    # Project management context
│   ├── ThemeContext.tsx      # UI theme and preferences
│   └── AuthContext.tsx       # Authentication context (future use)
│
├── services/                  # API service layer
│   ├── apiClient.ts          # Base fetch wrapper with error handling
│   ├── chatService.ts        # Chat API interactions
│   ├── projectService.ts     # Project API interactions
│   ├── threadService.ts      # Thread API interactions
│   ├── fileService.ts        # File upload and management
│   ├── shareService.ts       # Sharing functionality
│   └── storageService.ts     # Storage monitoring and cleanup
│
├── utils/                     # Utility functions
│   ├── contentUtils.ts       # Content processing and cleaning
│   ├── errorHandler.ts       # Error formatting and logging
│   ├── fileUtils.ts          # File upload and icon helpers
│   ├── threadUtils.ts        # Thread title generation
│   ├── shareUtils.ts         # Share link utilities
│   ├── storageUtils.ts       # Storage calculation and formatting
│   └── dateUtils.ts          # Date formatting and manipulation
│
├── styles/                    # Additional styling
│   ├── components.css        # Component-specific styles
│   ├── utilities.css         # Custom utility classes
│   └── print.css            # Print-specific styles for exports
│
├── public/                    # Static assets
│   ├── icon.png             # Application icon
│   ├── favicon.ico          # Browser favicon
│   ├── manifest.json        # PWA manifest
│   ├── robots.txt           # Search engine directives
│   └── images/              # Static images
│       ├── logo.svg         # Application logo
│       └── icons/           # UI icons and graphics
│
├── docs/                      # Documentation
│   ├── api.md               # API documentation
│   ├── deployment.md        # Deployment guide
│   ├── database-schema.md   # Database schema documentation
│   └── troubleshooting.md   # Common issues and solutions
│
├── scripts/                   # Utility scripts
│   ├── setup-db.sql         # Database initialization script
│   ├── cleanup-storage.js   # Manual storage cleanup script
│   └── migrate-data.js      # Data migration utilities
│
├── .env.local                 # Environment variables (not tracked)
├── .env.example              # Example environment configuration
├── .gitignore                # Git ignore patterns
├── .eslintrc.json           # ESLint configuration
├── .prettierrc              # Prettier code formatting
├── next.config.js           # Next.js configuration
├── tailwind.config.js       # Tailwind CSS configuration
├── tsconfig.json            # TypeScript configuration
├── package.json             # Dependencies and scripts
├── package-lock.json        # Exact dependency versions
├── vercel.json              # Vercel deployment configuration
├── README.md                # Project documentation
└── LICENSE                  # MIT License file
```

## 📄 License

This project is licensed under the MIT License. See LICENSE file for details.

## 🆘 Support

For questions, issues, or feature requests:
- **Issues**: GitHub Issues tracker
- **Documentation**: This README and inline code comments
- **Community**: Project discussions

---