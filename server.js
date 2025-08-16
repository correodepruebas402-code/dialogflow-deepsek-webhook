require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para parsear JSON
app.use(express.json());

// Verificación para Dialogflow
app.get('/webhook', (req, res) => {
  if (req.query.token === process.env.DIALOGFLOW_VERIFICATION_TOKEN) {
    res.status(200).send(req.query.challenge);
  } else {
    res.status(403).send('Forbidden');
  }
});

// Webhook principal
app.post('/webhook', async (req, res) => {
  try {
    const userQuery = req.body.queryResult.queryText;
    const sessionId = req.body.session.split('/').pop();

    // Llamada a DeepSeek API
    const deepseekResponse = await axios.post(
      'https://api.deepseek.com/chat',
      {
        model: "deepseek-chat",
        messages: [{ role: "user", content: userQuery }]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const aiResponse = deepseekResponse.data.choices[0].message.content;

    // Formato respuesta para Dialogflow
    const response = {
      fulfillmentMessages: [{
        text: {
          text: [aiResponse]
        }
      }]
    };

    res.json(response);
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
