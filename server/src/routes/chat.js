const express = require('express');
const { chat } = require('../ai/chat');

const router = express.Router();

function validMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return false;
  return messages.every(
    (m) =>
      m &&
      (m.role === 'user' || m.role === 'assistant') &&
      typeof m.content === 'string' &&
      m.content.length > 0
  );
}

router.post('/', async (req, res) => {
  const { messages } = req.body || {};

  if (!validMessages(messages)) {
    return res
      .status(400)
      .json({ error: 'messages must be a non-empty array of { role, content } entries with role user/assistant' });
  }

  const capped = messages.slice(-40);

  try {
    const result = await chat({ messages: capped, userId: req.userId });
    return res.json(result);
  } catch (err) {
    console.error('Chat adapter failure:', err.message);
    return res.status(502).json({ error: 'Chat service is currently unavailable' });
  }
});

module.exports = router;
