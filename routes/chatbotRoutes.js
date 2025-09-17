const express = require('express');
const axios = require('axios');
require('dotenv').config();

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { message } = req.body;

    // Call HuggingFace API
    const response = await axios.post(
      'https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium',
      { inputs: message },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        },
      }
    );

    const aiReply =
      (response.data[0] && response.data[0].generated_text) ||
      "Hmm, I don’t have an answer for that right now.";

    res.json({ reply: aiReply });
  } catch (error) {
    console.error('Chatbot error:', error.message);
    res.status(500).json({ reply: '⚠️ AI service not available right now.' });
  }
});

module.exports = router;
