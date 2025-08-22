export const extractTextContent = (content: any): string => {
  if (typeof content === 'string') {
    let cleaned = content
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/&lt;br\s*\/?&gt;/gi, '\n')
      .replace(/\s*<br>\s*/gi, '\n')
      .replace(/\s*&lt;br&gt;\s*/gi, '\n');
    
    return cleanSearchArtifactsFromContent(cleaned);
  }
  
  if (typeof content === 'object' && content !== null) {
    if (Array.isArray(content)) {
      return content
        .map(item => {
          if (typeof item === 'string') {
            let cleaned = item.replace(/<br\s*\/?>/gi, '\n').replace(/&lt;br\s*\/?&gt;/gi, '\n');
            return cleanSearchArtifactsFromContent(cleaned);
          }
          if (item.type === 'text' && item.text) {
            let cleaned = item.text.replace(/<br\s*\/?>/gi, '\n').replace(/&lt;br\s*\/?&gt;/gi, '\n');
            return cleanSearchArtifactsFromContent(cleaned);
          }
          if (item.text && typeof item.text === 'string') {
            let cleaned = item.text.replace(/<br\s*\/?>/gi, '\n').replace(/&lt;br\s*\/?&gt;/gi, '\n');
            return cleanSearchArtifactsFromContent(cleaned);
          }
          return '';
        })
        .filter(Boolean)
        .join('\n');
    }
    
    if (content.text && typeof content.text === 'string') {
      let cleaned = content.text.replace(/<br\s*\/?>/gi, '\n').replace(/&lt;br\s*\/?&gt;/gi, '\n');
      return cleanSearchArtifactsFromContent(cleaned);
    }
    
    if (typeof content.content === 'string') {
      let cleaned = content.content.replace(/<br\s*\/?>/gi, '\n').replace(/&lt;br\s*\/?&gt;/gi, '\n');
      return cleanSearchArtifactsFromContent(cleaned);
    }
    
    try {
      return JSON.stringify(content, null, 2);
    } catch {
      return '[Complex content - cannot display]';
    }
  }
  
  return String(content || '');
};

export const cleanSearchArtifactsFromContent = (text: string): string => {
  if (text.includes('/api/files/')) {
    return text;
  }
  
  let cleaned = text;
  
  cleaned = cleaned.replace(/\[Current Web Information[^\]]*\]:\s*/gi, '');
  cleaned = cleaned.replace(/Web Summary:\s*[^\n]*\n/gi, '');
  cleaned = cleaned.replace(/Top Search Results:\s*\n[\s\S]*?Instructions:[^\n]*\n/gi, '');
  cleaned = cleaned.replace(/Instructions: Please incorporate this current web information[^\n]*\n?/gi, '');
  cleaned = cleaned.replace(/\[Note: Web search was requested[^\]]*\]/gi, '');
  cleaned = cleaned.replace(/\d+\.\s+\[PDF\]\s+[^\n]*\n\s*[^\n]*\.\.\.\s*Source:\s*https?:\/\/[^\s]+\s*/gi, '');
  cleaned = cleaned.replace(/\d+\.\s+[^.]+\.\.\.\s*Source:\s*https?:\/\/[^\s]+\s*/gi, '');
  cleaned = cleaned.replace(/^\s*---\s*\n/gm, '');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.replace(/^\s+|\s+$/g, '');
  
  return cleaned;
};

export const extractTables = (content: string): string[] => {
  const tables: string[] = [];
  const tableRegex = /\|[^|\n]*\|[^|\n]*\|[\s\S]*?(?=\n\n|\n$|$)/g;
  const markdownTables = content.match(tableRegex);
  
  if (markdownTables) {
    tables.push(...markdownTables.map(table => table.trim()));
  }
  
  return tables;
};

export const extractCodeBlocks = (content: string): string[] => {
  const codeBlocks: string[] = [];
  const codeRegex = /```[\s\S]*?```/g;
  const matches = content.match(codeRegex);
  
  if (matches) {
    codeBlocks.push(...matches.map(block => block.trim()));
  }
  
  return codeBlocks;
};

export const extractLists = (content: string): string[] => {
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