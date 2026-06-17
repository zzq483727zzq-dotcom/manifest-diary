'use client';

import { useState, useCallback } from 'react';

interface UseStreamingAIOptions {
  endpoint: string;
}

interface UseStreamingAIResult {
  content: string;
  isStreaming: boolean;
  error: string | null;
  stream: (userInput: string, recentContext?: string) => Promise<void>;
  reset: () => void;
}

export function useStreamingAI({ endpoint }: UseStreamingAIOptions): UseStreamingAIResult {
  const [content, setContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stream = useCallback(async (userInput: string, recentContext?: string) => {
    setContent('');
    setError(null);
    setIsStreaming(true);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userInput, recentContext }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                accumulated += parsed.content;
                setContent(accumulated);
              }
              if (parsed.error) {
                setError(parsed.error);
              }
            } catch {
              // Ignore malformed SSE lines
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsStreaming(false);
    }
  }, [endpoint]);

  const reset = useCallback(() => {
    setContent('');
    setError(null);
    setIsStreaming(false);
  }, []);

  return { content, isStreaming, error, stream, reset };
}
