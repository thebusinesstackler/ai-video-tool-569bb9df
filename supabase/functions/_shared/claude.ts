// Lovable AI Gateway — replaces direct Claude/OpenAI API calls
const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const DEFAULT_MODEL = 'google/gemini-2.5-flash';

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
  // Gateway accepts OpenAI-compatible format natively
  return content;
}

function buildMessages(messages: any[], extraSystem?: string): any[] {
  const result: any[] = [];
  let systemText = extraSystem || '';

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemText += (systemText ? '\n\n' : '') + (typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content));
      continue;
    }
    result.push({ role: msg.role, content: convertContent(msg.content) });
  }

  if (systemText) {
    result.unshift({ role: 'system', content: systemText });
  }
  return result;
}

export async function callClaude(options: {
  messages: any[];
  system?: string;
  thinkingBudget?: number;
  maxTokens?: number;
  model?: string;
} | string, userMessage?: string, maxTokensLegacy?: number): Promise<{ text: string; thinking?: string }> {
  let opts: { messages: any[]; system?: string; thinkingBudget?: number; maxTokens?: number; model?: string };
  if (typeof options === 'string') {
    opts = {
      messages: [
        { role: 'system', content: options },
        { role: 'user', content: userMessage || '' }
      ],
      maxTokens: maxTokensLegacy,
    };
  } else {
    opts = options;
  }

  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) {
    throw new ClaudeError('LOVABLE_API_KEY is not configured', 500);
  }

  const gatewayMessages = buildMessages(opts.messages, opts.system);
  const modelToUse = opts.model || DEFAULT_MODEL;

  console.log(`Calling Lovable AI Gateway (${modelToUse}) with ${gatewayMessages.length} messages`);

  const response = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelToUse,
      messages: gatewayMessages,
      max_tokens: opts.maxTokens || 16000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Lovable AI Gateway error:', response.status, errorText);
    if (response.status === 429) throw new ClaudeError('Too many requests. Please wait a moment and try again.', 429);
    if (response.status === 402) throw new ClaudeError('AI credits exhausted. Please check your plan.', 402);
    throw new ClaudeError(`AI Gateway error: ${response.status}`, response.status);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  console.log(`AI Gateway response: ${text.length} chars`);
  return { text, thinking: '' };
}

/** Streaming version — proxies gateway SSE */
export async function callClaudeStreaming(options: {
  messages: any[];
  system?: string;
  thinkingBudget?: number;
  maxTokens?: number;
}): Promise<ReadableStream> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new ClaudeError('LOVABLE_API_KEY is not configured', 500);

  const gatewayMessages = buildMessages(options.messages, options.system);

  console.log(`Calling Lovable AI Gateway streaming with ${gatewayMessages.length} messages`);

  const response = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: gatewayMessages,
      max_tokens: options.maxTokens || 16000,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI Gateway streaming error:', response.status, errorText);
    if (response.status === 429) throw new ClaudeError('Rate limit exceeded.', 429);
    throw new ClaudeError(`AI Gateway error: ${response.status}`, response.status);
  }

  // Gateway returns OpenAI-compatible SSE, pass through directly
  return response.body!;
}
