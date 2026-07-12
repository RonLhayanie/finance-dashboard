const { defaultAdapter } = require('./adapter');
const { TOOLS } = require('./tools');

const SYSTEM_PROMPT =
  "You are a personal financial advisor with read-only access to the user's own " +
  'transaction data via tools. Base every figure you state on tool results - never ' +
  'invent numbers. If the available data is insufficient to answer, say so clearly. ' +
  'Answer in the same language the user writes in.';

const MAX_ITERATIONS = 6;

function findTool(name) {
  return TOOLS.find((t) => t.name === name);
}

function toolSchemas() {
  return TOOLS.map(({ name, description, parameters }) => ({ name, description, parameters }));
}

async function chat({ messages, adapter = defaultAdapter }) {
  const toolCallsMade = [];
  let currentMessages = [...messages];
  let lastText = '';

  for (let i = 0; i < MAX_ITERATIONS; i += 1) {
    console.error(`[chat debug] iteration ${i}: calling adapter.complete`);
    const result = await adapter.complete({
      system: SYSTEM_PROMPT,
      messages: currentMessages,
      tools: toolSchemas(),
    });
    console.error(`[chat debug] iteration ${i}: adapter returned type=${result.type}`);

    if (result.type === 'text') {
      return { reply: result.text, toolCallsMade };
    }

    lastText = result.text || lastText;

    const toolResults = [];
    for (const call of result.calls) {
      console.error(`[chat debug] executing tool ${call.name}`);
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
      console.error(`[chat debug] tool ${call.name} done`);
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
