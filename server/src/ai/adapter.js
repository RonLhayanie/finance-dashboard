const DEFAULT_MODELS = {
  anthropic: 'claude-sonnet-5',
  gemini: 'gemini-flash-latest',
};

function toAnthropicTools(tools) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));
}

// Tool round-trips use the provider's real multi-turn protocol (Anthropic:
// tool_use/tool_result content blocks), not a JSON blob stuffed into a plain
// text turn - the model is trained on the structured form and gets confused
// (wrong language, hallucinated "corrupted input") if fed anything else.
function toAnthropicMessages(messages) {
  return messages.map((m) => {
    if (m.role === 'assistant' && m.toolCalls) {
      const blocks = [];
      if (m.text) blocks.push({ type: 'text', text: m.text });
      for (const call of m.toolCalls) {
        blocks.push({ type: 'tool_use', id: call.id, name: call.name, input: call.arguments });
      }
      return { role: 'assistant', content: blocks };
    }
    if (m.role === 'tool') {
      return {
        role: 'user',
        content: m.toolResults.map((tr) => ({
          type: 'tool_result',
          tool_use_id: tr.id,
          content: JSON.stringify(tr.result),
        })),
      };
    }
    return { role: m.role, content: m.content };
  });
}

async function anthropicComplete({ system, messages, tools }, config) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      system,
      messages: toAnthropicMessages(messages),
      tools: toAnthropicTools(tools),
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`);
  }
  const data = await response.json();

  const toolUseBlocks = (data.content || []).filter((b) => b.type === 'tool_use');
  const text = (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  if (toolUseBlocks.length > 0) {
    return {
      type: 'tool_calls',
      calls: toolUseBlocks.map((b) => ({ id: b.id, name: b.name, arguments: b.input })),
      text: text || undefined,
    };
  }
  return { type: 'text', text };
}

function toGeminiTools(tools) {
  return [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
    },
  ];
}

// Same rationale as toAnthropicMessages: Gemini's real function-calling
// protocol carries the call as a `functionCall` part on a 'model' turn and the
// result as a `functionResponse` part on the following 'user' turn (Gemini has
// no separate 'tool' role) - not JSON-stringified text.
function toGeminiContents(messages) {
  return messages.map((m) => {
    if (m.role === 'assistant' && m.toolCalls) {
      const parts = m.toolCalls.map((call) => ({
        functionCall: { name: call.name, args: call.arguments },
        // Gemini's "thinking" models require the exact thoughtSignature they
        // issued with a function call to be echoed back on replay, or the
        // next call 400s with INVALID_ARGUMENT.
        ...(call.thoughtSignature ? { thoughtSignature: call.thoughtSignature } : {}),
      }));
      if (m.text) parts.unshift({ text: m.text });
      return { role: 'model', parts };
    }
    if (m.role === 'tool') {
      return {
        role: 'user',
        parts: m.toolResults.map((tr) => ({
          functionResponse: { name: tr.name, response: { result: tr.result } },
        })),
      };
    }
    return {
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    };
  });
}

async function geminiComplete({ system, messages, tools }, config) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: toGeminiContents(messages),
      tools: toGeminiTools(tools),
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }
  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const functionCalls = parts.filter((p) => p.functionCall);
  const text = parts
    .filter((p) => p.text)
    .map((p) => p.text)
    .join('\n');

  if (functionCalls.length > 0) {
    return {
      type: 'tool_calls',
      calls: functionCalls.map((p, i) => ({
        id: `${p.functionCall.name}-${i}`,
        name: p.functionCall.name,
        arguments: p.functionCall.args || {},
        thoughtSignature: p.thoughtSignature,
      })),
      text: text || undefined,
    };
  }
  return { type: 'text', text };
}

function createAdapter() {
  const provider = process.env.LLM_PROVIDER;
  if (provider !== 'anthropic' && provider !== 'gemini') {
    throw new Error("LLM_PROVIDER must be 'anthropic' or 'gemini'");
  }
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error('LLM_API_KEY is required to initialize the LLM adapter');
  }
  const model = process.env.LLM_MODEL || DEFAULT_MODELS[provider];
  const config = { apiKey, model };

  if (provider === 'anthropic') {
    return { complete: (args) => anthropicComplete(args, config) };
  }
  return { complete: (args) => geminiComplete(args, config) };
}

const defaultAdapter = createAdapter();

module.exports = { createAdapter, defaultAdapter };
