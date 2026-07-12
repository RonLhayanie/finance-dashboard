const express = require('express');
const { get_subscriptions } = require('../ai/tools');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(get_subscriptions());
});

module.exports = router;
