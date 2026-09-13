const { createAdapter } = require('./adapter');
const { TOOLS } = require('./tools');

const SYSTEM_PROMPT =
  "You are a personal financial advisor with read-only access to the user's own " +
  'transaction data via tools. Base every figure you state on tool results - never ' +
  'invent numbers. If the available data is insufficient to answer, say so clearly. ' +
  'Answer in the same language the user writes in. ' +
  'Be efficient: call the minimum number of tools needed to answer the question. ' +
  'For aggregate or "how much did I spend" questions, prefer get_spending_summary ' +
  'over pulling raw rows with query_transactions. As soon as you have enough data ' +
  'to answer, give your final text answer instead of continuing to explore.';

const MAX_ITERATIONS = 10;

let cachedAdapter = null;

function getAdapter() {
  if (!cachedAdapter) {
    cachedAdapter = createAdapter();
  }
  return cachedAdapter;
}

function findTool(name) {
  return TOOLS.find((t) => t.name === name);
}

function toolSchemas() {
  return TOOLS.map(({ name, description, parameters }) => ({ name, description, parameters }));
}

async function chat({ messages, adapter }) {
  const toolCallsMade = [];
  let currentMessages = [...messages];
  let lastText = '';

  let activeAdapter;
  try {
    activeAdapter = adapter || getAdapter();
  } catch (err) {
    return {
      reply: lastText || 'The assistant could not complete the request within the tool budget.',
      toolCallsMade,
    };
  }

  for (let i = 0; i < MAX_ITERATIONS; i += 1) {
    const result = await activeAdapter.complete({
      system: SYSTEM_PROMPT,
      messages: currentMessages,
      tools: toolSchemas(),
    });

    if (result.type === 'text') {
      return { reply: result.text, toolCallsMade };
    }

    lastText = result.text || lastText;

    const toolResults = [];
    for (const call of result.calls) {
      toolCallsMade.push(call.name);
      const tool = findTool(call.name);
      let output;
      if (!tool) {
        output = { error: `Unknown tool: ${call.name}` };
      } else {
        try {
          output = tool.execute(call.arguments || {});
        } catch (err) {
          output = { error: err.message };
        }
      }
      toolResults.push({ id: call.id, name: call.name, result: output });
    }

    currentMessages = [
      ...currentMessages,
      { role: 'assistant', toolCalls: result.calls, text: result.text },
      { role: 'tool', toolResults },
    ];
  }

  return {
    reply: lastText || 'The assistant could not complete the request within the tool budget.',
    toolCallsMade,
  };
}

module.exports = { chat };
