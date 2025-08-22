import { Message } from '../types/entities.types';

export const generateSmartThreadTitle = (messages: Message[]): string => {
  if (!messages || messages.length === 0) {
    return "New Chat";
  }

  // Get first three substantial user messages (skip greetings)
  const userMessages = messages
    .filter(msg => 
      msg.role === "user" && 
      typeof msg.content === 'string' && 
      msg.content.trim().length > 5 &&
      !msg.content.trim().toLowerCase().match(/^(hi|hello|hey|good morning|good afternoon|good evening|thanks|thank you)$/i)
    )
    .slice(0, 3);

  if (userMessages.length === 0) {
    return "New Chat";
  }

  let content = userMessages
    .map(msg => typeof msg.content === 'string' ? msg.content.trim() : '')
    .join(' ');
  
  // Clean up the content
  content = content.replace(/\n+/g, ' ').replace(/\s+/g, ' ');
  content = content.replace(/^(what|how|why|when|where|who|which|can you|could you|please|help me|i need|i want|tell me|explain|show me)\s+/i, '');
  content = content.replace(/[?!]+$/, '');
  content = content.charAt(0).toUpperCase() + content.slice(1);
  
  if (content.length > 50) {
    const truncated = content.substring(0, 47);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 20) {
      content = truncated.substring(0, lastSpace) + '...';
    } else {
      content = truncated + '...';
    }
  }
  
  if (content.length < 3) {
    return `Chat - ${new Date().toLocaleDateString()}`;
  }
  
  return content;
};

export const generateContextualTitle = (messages: Message[]): string => {
  if (!messages || messages.length === 0) {
    return "New Chat";
  }

  const userMessages = messages
    .filter(msg => 
      msg.role === "user" && 
      typeof msg.content === 'string' &&
      msg.content.trim().length > 5 &&
      !msg.content.trim().toLowerCase().match(/^(hi|hello|hey|good morning|good afternoon|good evening|thanks|thank you)$/i)
    )
    .slice(0, 3)
    .map(msg => msg.content.toLowerCase());

  if (userMessages.length === 0) {
    return "New Chat";
  }

  // Define topic patterns and their corresponding titles
  const topicPatterns = [

    { keywords: ['Antigua and Barbuda', 'Antigua', 'Barbuda'], title: 'Antigua and Barbuda' },
    { keywords: ['Bahamas', 'The Bahamas', 'Commonwealth of The Bahamas'], title: 'Bahamas' },
    { keywords: ['Barbados'], title: 'Barbados' },
    { keywords: ['Belize'], title: 'Belize' },
    { keywords: ['Cuba', 'Republic of Cuba'], title: 'Cuba' },
    { keywords: ['Dominica', 'Commonwealth of Dominica'], title: 'Dominica' },
    { keywords: ['Dominican Republic', 'República Dominicana', 'Dominican Rep'], title: 'Dominican Republic' },
    { keywords: ['Grenada'], title: 'Grenada' },
    { keywords: ['Guyana', 'Co-operative Republic of Guyana'], title: 'Guyana' },
    { keywords: ['Haiti', "République d’Haïti", "Republique d'Haiti", 'Ayiti'], title: 'Haiti' },
    { keywords: ['Jamaica'], title: 'Jamaica' },
    { keywords: ['Saint Kitts and Nevis', 'St Kitts and Nevis', 'St Kitts', 'Nevis', 'SKN'], title: 'Saint Kitts and Nevis' },
    { keywords: ['Saint Lucia', 'St Lucia'], title: 'Saint Lucia' },
    { keywords: ['Saint Vincent and the Grenadines', 'St Vincent and the Grenadines', 'St Vincent', 'SVG'], title: 'Saint Vincent and the Grenadines' },
    { keywords: ['Suriname', 'Republic of Suriname'], title: 'Suriname' },
    { keywords: ['Trinidad and Tobago', 'Trinidad', 'Tobago', 'T&T', 'TT'], title: 'Trinidad and Tobago' },

    // Territories & dependencies commonly treated as part of the Caribbean region
    { keywords: ['Anguilla'], title: 'Anguilla' },
    { keywords: ['Aruba'], title: 'Aruba' },
    { keywords: ['Bermuda'], title: 'Bermuda' },
    { keywords: ['Bonaire'], title: 'Bonaire' },
    { keywords: ['British Virgin Islands', 'BVI'], title: 'British Virgin Islands' },
    { keywords: ['Cayman Islands', 'Cayman'], title: 'Cayman Islands' },
    { keywords: ['Curaçao', 'Curacao'], title: 'Curaçao' },
    { keywords: ['Guadeloupe'], title: 'Guadeloupe' },
    { keywords: ['Martinique'], title: 'Martinique' },
    { keywords: ['Montserrat'], title: 'Montserrat' },
    { keywords: ['Puerto Rico', 'PR'], title: 'Puerto Rico' },
    { keywords: ['Saba'], title: 'Saba' },
    { keywords: ['Saint Barthélemy', 'Saint Barthelemy', 'St Barts', 'St Barths'], title: 'Saint Barthélemy' },
    { keywords: ['Saint Martin', 'St Martin', 'Saint-Martin (French part)'], title: 'Saint Martin' },
    { keywords: ['Sint Eustatius', 'Statia'], title: 'Sint Eustatius' },
    { keywords: ['Sint Maarten', 'St Maarten'], title: 'Sint Maarten' },
    { keywords: ['Turks and Caicos Islands', 'Turks & Caicos', 'TCI'], title: 'Turks and Caicos Islands' },
    { keywords: ['United States Virgin Islands', 'U.S. Virgin Islands', 'USVI'], title: 'United States Virgin Islands' },


    // Other samples for test cases
    {keywords: ['United Kingdom', 'UK', 'Britain', 'Great Britain', 'England'],      title: 'United Kingdom'},
    {keywords: ['United States', 'United States of America', 'USA', 'US', 'America'],       title: 'United States'},
    { keywords: ['India', 'Republic of India', 'Bharat'],       title: 'India' },
  ];

  const allText = userMessages.join(' ');
  for (const pattern of topicPatterns) {
    const matchCount = pattern.keywords.reduce((count, keyword) => {
      return count + (allText.includes(keyword.toLowerCase()) ? 1 : 0);
    }, 0);
    
    if (matchCount >= 1) {
      return pattern.title;
    }
  }

  return generateSmartThreadTitle(messages);
};
