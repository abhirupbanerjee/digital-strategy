# Digital Strategy Bot

A modern AI-powered chat application built with Next.js that enables organized conversations through projects, real-time web search, file uploads, and collaborative sharing capabilities.

## ✨ Features

### 🗂️ Project Management
- **Organized Conversations**: Group related chats into projects with custom colors and descriptions
- **Thread Management**: Multiple conversation threads within each project
- **Auto-sync**: Sync existing OpenAI assistant threads into your project database

### 🤖 AI Assistant Capabilities
- **OpenAI GPT Integration**: Powered by OpenAI's Assistant API
- **Real-time Web Search**: Optional Tavily API integration for current information
- **File Upload Support**: PDF, DOC, Excel, CSV, TXT, and more (up to 20MB)
- **Multiple Response Formats**: Default, bullet points, tables, or preserve existing table structures

### 🔗 Sharing & Collaboration
- **Secure Link Sharing**: Generate time-limited share links for projects
- **Granular Permissions**: Read-only or full collaboration access
- **Expiry Control**: Links expire after 1 day to 1 month

### 💾 Data Management
- **Persistent Storage**: Supabase backend for reliable data persistence
- **Message History**: Full conversation history with timestamps
- **Content Extraction**: Copy specific content (tables, code blocks, lists) from responses

### 📱 Responsive Design
- **Mobile Optimized**: Full mobile support with touch-friendly interface
- **Desktop Features**: Sidebar panels, keyboard shortcuts, and advanced controls
- **Real-time Updates**: Live typing indicators and message status

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **Database**: Supabase (PostgreSQL)
- **AI Services**: OpenAI Assistant API
- **Search**: Tavily API (optional)
- **UI/UX**: Framer Motion, React Markdown

## 📋 Prerequisites

- Node.js 18+ and npm/yarn
- OpenAI API account and Assistant ID
- Supabase project
- Tavily API key (optional, for web search)

## 🚀 Quick Start

### 1. Clone & Install
```bash
git clone <repository-url>
cd digital-strategy-bot
npm install
```

### 2. Environment Setup
Create a `.env.local` file:

```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_ASSISTANT_ID=your_assistant_id
OPENAI_ORGANIZATION=your_org_id  # Optional

# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key

# Web Search (Optional)
TAVILY_API_KEY=your_tavily_api_key

# App Configuration
NEXT_PUBLIC_BASE_URL=http://localhost:3000  # For production: your domain
```

### 3. Database Setup

Set up the following tables in Supabase:

```sql
-- Projects table
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Threads table
CREATE TABLE threads (
  id TEXT PRIMARY KEY,  -- OpenAI thread ID
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project shares table
CREATE TABLE project_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  share_token TEXT UNIQUE NOT NULL,
  permissions TEXT CHECK (permissions IN ('read', 'collaborate')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 4. Run Development Server
```bash
npm run dev
```

Visit `http://localhost:3000` to start using the application.

## 📖 Usage Guide

### Creating Your First Project
1. Click "New Project" in the sidebar
2. Enter a name and optional description
3. Start chatting to create your first thread

### Using Web Search
1. Toggle "Web Search" in the controls
2. Ask questions requiring current information
3. Responses will include cited sources

### File Uploads
1. Click "Attach Files" 
2. Select supported formats (PDF, DOC, CSV, etc.)
3. Files are processed and available to the AI assistant

### Sharing Projects
1. Select a project and click "Share"
2. Choose permissions (Read-only or Collaborate)
3. Set expiry time (1 day to 1 month)
4. Share the generated link

### Response Formatting
- **Default**: Natural AI responses
- **Bullets**: Structured bullet point format
- **Tables**: Data organized in tables
- **Preserve Tables**: Maintains existing table structure

## 🔧 API Endpoints

### Core Chat API
- `POST /api/chat` - Send messages and receive AI responses
- `GET /api/threads` - Retrieve conversation history
- `POST /api/threads` - Save thread data

### Project Management
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project
- `DELETE /api/projects/[id]` - Delete project

### File Handling
- `POST /api/upload` - Upload files for AI processing

### Sharing System
- `POST /api/projects/[id]/shares` - Create share links
- `GET /api/shared/[token]` - Access shared projects

### Utilities
- `POST /api/sync-threads` - Sync OpenAI threads to database
- `POST /api/cleanup-threads` - Clean legacy message artifacts

## 📱 Mobile Features

- **Touch-optimized interface** with swipe gestures
- **Responsive design** that adapts to all screen sizes
- **Mobile-specific controls** for better usability
- **Offline-ready** conversation viewing

## 🔒 Security Features

- **Time-limited share links** with automatic expiration
- **Permission-based access** (read-only vs. collaborate)
- **Secure token validation** for all shared content
- **Environment variable protection** for API keys

## 🚧 Development

### Project Structure
```
app/
├── api/                 # Next.js API routes
│   ├── chat/           # Main chat endpoint
│   ├── projects/       # Project management
│   ├── threads/        # Thread operations
│   ├── upload/         # File upload handling
│   └── shared/         # Share link validation
├── components/         # React components
├── shared/            # Shared project viewer
└── page.tsx           # Main application
```

### Key Components
- **ChatApp**: Main application with project management
- **ShareModal**: Share link creation and management
- **Responsive Design**: Mobile-first approach with desktop enhancements

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For questions and support:
1. Check the [Issues](link-to-issues) section
2. Review the [Documentation](link-to-docs)
3. Contact the development team

## 🚀 Deployment

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Manual Deployment
```bash
npm run build
npm start
```

---

**Built for the Caribbean Government sector** - Empowering digital strategy through AI-assisted conversations and collaborative project management.