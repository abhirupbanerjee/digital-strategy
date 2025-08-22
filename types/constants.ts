// utils/constants.ts
export const CONSTANTS = {
  MAX_FILE_SIZE: 20 * 1024 * 1024, // 20MB
  SEARCH_FLAG: '___WEB_SEARCH_IN_PROGRESS___',
  TITLE_TRUNCATE_LENGTH: {
    mobile: 30,
    desktop: 50
  },
  API_ENDPOINTS: {
    CHAT: '/api/chat',
    PROJECTS: '/api/projects',
    THREADS: '/api/threads',
    UPLOAD: '/api/upload',
    FILES: '/api/files'
  },
  TOAST_DURATION: 3000
} as const;