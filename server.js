require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

// Health check para Render
app.get('/', (req, res) => {
  res.status(200).send('Server is running');
});

// Webhook para Dialogflow (ambos métodos)
app.all('/webhook', async (req, res) => {
  try {
    console.log('Received request:', req.method, req.body);
    
    // Verificación GET para Dialogflow
    if (req.method === 'GET') {
      if (req.query.token === process.env.DIALOGFLOW_VERIFICATION_TOKEN) {
        return res.status(200).send(req.query.challenge);
      }
      return res.status(403).send('Forbidden');
    }

    // Procesamiento POST
    const { queryResult } = req.body;
    if (!queryResult || !queryResult.queryText) {
      throw new Error('Invalid Dialogflow request format');
    }

    // Llamada a DeepSeek (versión actualizada)
    const deepseekResponse = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: "deepseek-chat",
        messages: [{ role: "user", content: queryResult.queryText }],
        max_tokens: 150
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      }
    );

    // Formato de respuesta para Dialogflow V2
    const response = {
      fulfillmentText: deepseekResponse.data.choices[0].message.content,
      payload: {
        google: {
          expectUserResponse: true,
          richResponse: {
            items: [{
              simpleResponse: {
                textToSpeech: deepseekResponse.data.choices[0].message.content
              }
            }]
          }
        }
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Error:', error.message);
    const errorResponse = {
      fulfillmentText: "Disculpa, estoy teniendo dificultades técnicas. Por favor intenta nuevamente más tarde.",
      payload: {
        google: {
          expectUserResponse: true
        }
      }
    };
    res.status(200).json(errorResponse); // Dialogflow siempre espera 200
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
