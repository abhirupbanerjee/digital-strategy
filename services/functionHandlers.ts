import axios from 'axios';

interface FunctionCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface WebSearchArgs {
  query: string;
  search_depth?: 'basic' | 'advanced';
  max_results?: number;
}

export class FunctionHandlers {
  private static searchCache = new Map<string, { result: string; timestamp: number }>();
  private static CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static async handleWebSearch(args: WebSearchArgs): Promise<string> {
    const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
    
    if (!TAVILY_API_KEY) {
      return JSON.stringify({
        error: "Web search is not configured. Tavily API key missing."
      });
    }

    // Check cache first
    const cacheKey = `${args.query}-${args.search_depth || 'basic'}-${args.max_results || 5}`;
    const cached = this.searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      console.log('Returning cached search result for:', args.query);
      return cached.result;
    }

    try {
      console.log('Executing web search:', args);
      
      const searchResponse = await axios.post(
        'https://api.tavily.com/search',
        {
          api_key: TAVILY_API_KEY,
          query: args.query,
          search_depth: args.search_depth || 'basic',
          include_answer: true,
          include_images: false,
          include_raw_content: false,
          max_results: args.max_results || 5,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      if (searchResponse.data) {
        const data = searchResponse.data;
        let result = '';
        
        // Include AI-generated answer if available
        if (data.answer) {
          result += `Summary: ${data.answer}\n\n`;
        }
        
        // Add search results
        if (data.results && data.results.length > 0) {
          result += 'Search Results:\n';
          data.results.forEach((item: any, index: number) => {
            result += `\n${index + 1}. ${item.title}\n`;
            result += `   ${item.content}\n`;
            result += `   Source: ${item.url}\n`;
            if (item.score) {
              result += `   Relevance: ${(item.score * 100).toFixed(1)}%\n`;
            }
          });
        }
        
        // Cache the result
        this.searchCache.set(cacheKey, { result, timestamp: Date.now() });
        
        return result;
      }
      
      return "No search results found.";
      
    } catch (error: any) {
      console.error('Tavily search error:', error.response?.data || error.message);
      return JSON.stringify({
        error: "Search failed",
        details: error.message
      });
    }
  }

  static async handleFunctionCall(functionCall: FunctionCall): Promise<string> {
    const { name, arguments: argsString } = functionCall.function;
    
    try {
      const args = JSON.parse(argsString);
      
      switch (name) {
        case 'web_search':
          return await this.handleWebSearch(args);
        
        // Add other function handlers here as needed
        default:
          return JSON.stringify({
            error: `Unknown function: ${name}`
          });
      }
    } catch (error: any) {
      console.error(`Error handling function ${name}:`, error);
      return JSON.stringify({
        error: "Function execution failed",
        details: error.message
      });
    }
  }

  // Cleanup old cache entries
  static cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.searchCache.entries()) {
      if (now - value.timestamp > this.CACHE_DURATION) {
        this.searchCache.delete(key);
      }
    }
  }
}

// Run cleanup every 10 minutes
if (typeof window === 'undefined') {
  setInterval(() => FunctionHandlers.cleanupCache(), 10 * 60 * 1000);
}