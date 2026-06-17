'use client';

import { useState } from 'react';
import { useStreamingAI } from '@/hooks/use-streaming-ai';
import { parseAIResponse } from '@/lib/ai/parse-response';

export default function TestAIPage() {
  const [input, setInput] = useState('');
  const { content, isStreaming, error, stream, reset } = useStreamingAI({
    endpoint: '/api/ai/reflect',
  });

  const parsed = content && !isStreaming ? parseAIResponse(content) : null;

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 20px', fontFamily: 'monospace' }}>
      <h1>🧪 AI 人设测试台</h1>
      <p style={{ color: '#666' }}>最丑但能用。验证"高能领班型闺蜜"是否对味。</p>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="把你今天想说的话倒在这里..."
        style={{
          width: '100%',
          height: 150,
          padding: 12,
          fontSize: 14,
          borderRadius: 8,
          border: '1px solid #ccc',
          resize: 'vertical',
        }}
      />

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button
          onClick={() => stream(input)}
          disabled={isStreaming || !input.trim()}
          style={{
            padding: '8px 20px',
            fontSize: 14,
            borderRadius: 6,
            border: 'none',
            background: isStreaming ? '#ccc' : '#333',
            color: '#fff',
            cursor: isStreaming ? 'not-allowed' : 'pointer',
          }}
        >
          {isStreaming ? 'AI 正在想...' : '让 AI 梳理'}
        </button>
        <button
          onClick={reset}
          style={{
            padding: '8px 20px',
            fontSize: 14,
            borderRadius: 6,
            border: '1px solid #ccc',
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          清空
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 16, padding: 12, background: '#fee', borderRadius: 8, color: 'red' }}>
          Error: {error}
        </div>
      )}

      {content && (
        <div style={{ marginTop: 20 }}>
          <h2>原始输出（流式）</h2>
          <pre style={{
            whiteSpace: 'pre-wrap',
            background: '#f5f5f5',
            padding: 16,
            borderRadius: 8,
            fontSize: 13,
          }}>
            {content}
          </pre>
        </div>
      )}

      {parsed && (
        <div style={{ marginTop: 20 }}>
          <h2>✨ 接住</h2>
          <p style={{ fontSize: 16, lineHeight: 1.6 }}>{parsed.empathy}</p>

          <h2>🌟 今日高光</h2>
          {parsed.structured.highlights.length === 0 && <p style={{ color: '#999' }}>无</p>}
          {parsed.structured.highlights.map((h, i) => (
            <div key={i} style={{ background: '#f0fff0', padding: 12, borderRadius: 8, marginBottom: 8 }}>
              <strong>{h.fact}</strong>
              <p style={{ margin: '4px 0 0', color: '#555' }}>{h.why_it_counts}</p>
            </div>
          ))}

          <h2>🔍 认知 Bug</h2>
          {parsed.structured.cognitive_bugs.length === 0 && <p style={{ color: '#999' }}>无</p>}
          {parsed.structured.cognitive_bugs.map((b, i) => (
            <div key={i} style={{ background: '#fff8f0', padding: 12, borderRadius: 8, marginBottom: 8 }}>
              <p style={{ margin: 0, color: '#888' }}>「{b.user_quote}」</p>
              <p style={{ margin: '4px 0 0' }}>{b.reframe}</p>
            </div>
          ))}

          <h2>📋 明日脚本</h2>
          {parsed.structured.tomorrow_script.map((s) => (
            <div key={s.step} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid #eee' }}>
              <span style={{ fontWeight: 'bold', minWidth: 24 }}>#{s.step}</span>
              <span style={{ flex: 1 }}>{s.action}</span>
              <span style={{ color: '#999' }}>{s.duration_minutes}min</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
