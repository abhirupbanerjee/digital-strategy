// components/markdown/MarkdownMessage.tsx
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { extractTextContent } from '../../utils/contentUtils';

interface MarkdownMessageProps {
  content: any;
  className?: string;
}

export const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ 
  content, 
  className = "" 
}) => {
  return (
    <div className={`message-content chat-message ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children, ...props }) => (
            <h1 className="text-xl md:text-2xl font-bold mt-4 md:mt-6 mb-3 md:mb-4 text-gray-900" {...props}>
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2 className="text-lg md:text-xl font-semibold mt-3 md:mt-5 mb-2 md:mb-3 text-gray-800" {...props}>
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3 className="text-base md:text-lg font-semibold mt-3 md:mt-4 mb-2 text-gray-800" {...props}>
              {children}
            </h3>
          ),
          p: ({ children, ...props }) => {
            // Check if children contain block elements that shouldn't be in <p>
            const hasBlockElements = React.Children.toArray(children).some(child => {
              if (React.isValidElement(child)) {
                const type = child.type;
                // Check for block elements that can't be in <p>
                return typeof type === 'string' && ['div', 'pre', 'table', 'ul', 'ol', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(type);
              }
              return false;
            });
            

  // If contains block elements, use div instead of p
  if (hasBlockElements) {
    return (
      <div className="mb-3 md:mb-4 leading-relaxed text-sm md:text-base text-gray-700" {...props}>
        {children}
      </div>
    );
  }

  return (
    <p className="mb-3 md:mb-4 leading-relaxed text-sm md:text-base text-gray-700" {...props}>
      {children}
    </p>
  );
},

          a: ({ href, children, ...props }) => {
            const isCitation = href?.startsWith('http');
            const isFileDownload = href?.startsWith('/api/files/');
            
            if (isFileDownload) {
              return (
                <a 
                  href={href}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline"
                  {...props}
                >
                  {children}
                </a>
              );
            }
            
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
            return inline ? (
              <code className="bg-gray-100 text-red-600 px-1 py-0.5 rounded text-xs md:text-sm font-mono" {...props}>
                {children}
              </code>
            ) : (
              <div className="my-3 md:my-4">
                <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 md:p-4 overflow-x-auto text-xs md:text-sm">
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              </div>
            );
          },

          ul: ({ children, ...props }) => (
            <ul className="list-disc pl-5 md:pl-6 mb-3 md:mb-4 space-y-1 md:space-y-2 text-sm md:text-base" {...props}>
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol className="list-decimal pl-5 md:pl-6 mb-3 md:mb-4 space-y-1 md:space-y-2 text-sm md:text-base" {...props}>
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => (
            <li className="text-gray-700 leading-relaxed text-sm md:text-base" {...props}>
              {children}
            </li>
          ),
          table: ({ children, ...props }) => (
            <div className="table-scroll-container">
              <table className="w-full border-collapse text-xs md:text-sm" {...props}>
                {children}
              </table>
            </div>
          ),
          th: ({ children, ...props }) => (
            <th 
              className="border-r border-gray-300 px-2 md:px-4 py-1 md:py-3 text-left font-semibold text-gray-900 bg-gray-100 align-top" 
              title={typeof children === 'string' ? children : undefined}
              {...props}
            >
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td className="border-r border-gray-300 px-2 md:px-4 py-1 md:py-3 text-gray-700 align-top" {...props}>
              <div className="break-words min-w-0">
                {children}
              </div>
            </td>
          ),
          blockquote: ({ children, ...props }) => (
            <blockquote className="border-l-4 border-gray-300 pl-3 md:pl-4 py-2 mb-3 md:mb-4 italic text-gray-600 text-sm md:text-base" {...props}>
              {children}
            </blockquote>
          ),
          img: ({ src, alt, ...props }) => {
            if (!src || (typeof src === 'string' && src.trim() === '')) {
              return <span className="text-gray-500 italic">[Image not available]</span>;
            }
            
            if (typeof src === 'string' && src.startsWith('/api/files/')) {
              return (
                <div className="my-2 p-2 border rounded bg-gray-50">
                  <span className="text-sm text-gray-600">📎 {alt || 'Download File'}</span>
                  <a 
                    href={src}
                    download
                    className="ml-2 text-blue-600 hover:text-blue-800 underline text-sm"
                  >
                    Download
                  </a>
                </div>
              );
            }
            
            return (
              <img 
                src={src} 
                alt={alt || ''} 
                className="max-w-full h-auto rounded border"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
                {...props}
              />
            );
          },
          strong: ({ children, ...props }) => (
            <strong className="font-semibold text-gray-900" {...props}>
              {children}
            </strong>
          ),
        }}
      >
        {extractTextContent(content)}
      </ReactMarkdown>
    </div>
  );
};