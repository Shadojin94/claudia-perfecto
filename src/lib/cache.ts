export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isAgent?: boolean;
}

export async function saveMessage(message: ChatMessage): Promise<void> {
  try {
    const cache = await caches.open('chat-history');
    const history = await loadHistory();
    history.push(message);
    await cache.put(
      '/history',
      new Response(JSON.stringify(history))
    );
  } catch (error) {
    console.error('Error saving message:', error);
  }
}

export async function loadHistory(): Promise<ChatMessage[]> {
  try {
    const cache = await caches.open('chat-history');
    const response = await cache.match('/history');
    if (!response) return [];
    const history = await response.json();
    return history;
  } catch (error) {
    console.error('Error loading history:', error);
    return [];
  }
}

export async function clearHistory(): Promise<void> {
  try {
    const cache = await caches.open('chat-history');
    await cache.delete('/history');
  } catch (error) {
    console.error('Error clearing history:', error);
  }
}