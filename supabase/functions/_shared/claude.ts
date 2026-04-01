const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-opus-4-20250514';

export class ClaudeError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function convertContent(content: any): any {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return content;

  return content.map((part: any) => {
    if (part.type === 'image_url' && part.image_url?.url) {
      const url = part.image_url.url;
      if (url.startsWith('data:')) {
        const match = url.match(/^data:(image\/[^;]+);base64,(.+)$/);
        if (match) {
          return { type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } };
        }
      }
      return { type: 'image', source: { type: 'url', url } };
    }
    if (part.type === 'text') return part;
    return part;
  });
}

function convertMessages(messages: any[]): { system: string; claudeMessages: any[] } {
  let system = '';
  const claudeMessages: any[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      system += (system ? '\n\n' : '') + (typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content));
      continue;
    }
    claudeMessages.push({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: convertContent(msg.content),
    });
  }

  // Claude requires alternating user/assistant. Merge consecutive same-role.
  const merged: any[] = [];
  for (const msg of claudeMessages) {
    if (merged.length > 0 && merged[merged.length - 1].role === msg.role) {
      const prev = merged[merged.length - 1];
      const prevContent = typeof prev.content === 'string'
        ? [{ type: 'text', text: prev.content }]
        : Array.isArray(prev.content) ? prev.content : [prev.content];
      const newContent = typeof msg.content === 'string'
        ? [{ type: 'text', text: msg.content }]
        : Array.isArray(msg.content) ? msg.content : [msg.content];
      prev.content = [...prevContent, ...newContent];
    } else {
      merged.push({ ...msg });
    }
  }

  return { system, claudeMessages: merged };
}

export async function callClaude(options: {
  messages: any[];
  system?: string;
  thinkingBudget?: number;
  maxTokens?: number;
}): Promise<{ text: string; thinking?: string }> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new ClaudeError('ANTHROPIC_API_KEY is not configured', 500);

  const { system: extractedSystem, claudeMessages } = convertMessages(options.messages);
  const systemPrompt = options.system || extractedSystem;
  const thinkingBudget = options.thinkingBudget || 4000;
  const maxTokens = options.maxTokens || (thinkingBudget + 16000);

  const body: any = {
    model: MODEL,
    max_tokens: maxTokens,
    messages: claudeMessages,
    thinking: { type: 'enabled', budget_tokens: thinkingBudget },
  };
  if (systemPrompt) body.system = systemPrompt;

  console.log(`Calling Claude ${MODEL} with ${claudeMessages.length} messages, thinking budget: ${thinkingBudget}`);

  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Claude API error:', response.status, errorText);
    if (response.status === 429) throw new ClaudeError('Rate limit exceeded. Please try again later.', 429);
    if (response.status === 529) throw new ClaudeError('Claude is temporarily overloaded. Please try again.', 529);
    throw new ClaudeError(`Claude API error: ${response.status}`, response.status);
  }

  const data = await response.json();
  let text = '';
  let thinking = '';

  if (Array.isArray(data.content)) {
    for (const block of data.content) {
      if (block.type === 'text') text += block.text;
      else if (block.type === 'thinking') thinking += block.thinking;
    }
  }

  console.log(`Claude response: ${text.length} chars text, ${thinking.length} chars thinking`);
  return { text, thinking };
}

/** Streaming version — converts Claude SSE to OpenAI-compatible SSE format */
export async function callClaudeStreaming(options: {
  messages: any[];
  system?: string;
  thinkingBudget?: number;
  maxTokens?: number;
}): Promise<ReadableStream> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new ClaudeError('ANTHROPIC_API_KEY is not configured', 500);

  const { system: extractedSystem, claudeMessages } = convertMessages(options.messages);
  const systemPrompt = options.system || extractedSystem;
  const thinkingBudget = options.thinkingBudget || 4000;
  const maxTokens = options.maxTokens || (thinkingBudget + 16000);

  const body: any = {
    model: MODEL,
    max_tokens: maxTokens,
    messages: claudeMessages,
    thinking: { type: 'enabled', budget_tokens: thinkingBudget },
    stream: true,
  };
  if (systemPrompt) body.system = systemPrompt;

  console.log(`Calling Claude streaming with ${claudeMessages.length} messages`);

  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Claude streaming error:', response.status, errorText);
    if (response.status === 429) throw new ClaudeError('Rate limit exceeded.', 429);
    if (response.status === 529) throw new ClaudeError('Claude is temporarily overloaded.', 529);
    throw new ClaudeError(`Claude API error: ${response.status}`, response.status);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  return new ReadableStream({
    async pull(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // Flush remaining buffer
            if (buffer.trim()) {
              for (const line of buffer.split('\n')) {
                processLine(line, controller, encoder);
              }
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            processLine(line, controller, encoder);
          }
        }
      } catch (err) {
        console.error('Stream transform error:', err);
        controller.error(err);
      }
    },
  });
}

function processLine(line: string, controller: ReadableStreamDefaultController, encoder: TextEncoder) {
  if (!line.startsWith('data: ')) return;
  const jsonStr = line.slice(6).trim();
  if (!jsonStr) return;

  try {
    const event = JSON.parse(jsonStr);
    // Only forward text deltas, skip thinking deltas
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      const openAIEvent = { choices: [{ delta: { content: event.delta.text } }] };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(openAIEvent)}\n\n`));
    }
  } catch {
    // Skip unparseable lines
  }
}
