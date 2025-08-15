const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

app.post('/webhook', async (req, res) => {
 // Validar que la solicitud tenga los datos necesarios
  if (!req.body || !req.body.queryResult) {
    return res.status(400).json({
      fulfillmentText: 'Error: Solicitud inválida'
    });
  }
  try {
    const { queryResult } = req.body;
    const userMessage = queryResult.queryText;
    
    console.log('Usuario dice:', userMessage);

    const deepseekResponse = await axios.post(
      'https://api.deepseek.com/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'Eres un asistente útil y amigable. Responde de manera concisa y clara.'
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        max_tokens: 150,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const aiResponse = deepseekResponse.data.choices[0].message.content;
    console.log('DeepSeek responde:', aiResponse);

    const response = {
      fulfillmentText: aiResponse,
      fulfillmentMessages: [
        {
          text: {
            text: [aiResponse]
          }
        }
      ]
    };

    res.json(response);

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    
    res.json({
      fulfillmentText: 'Lo siento, ocurrió un error al procesar tu solicitud.'
    });
  }
});

app.get('/', (req, res) => {
  res.send('Webhook de Dialogflow con DeepSeek funcionando correctamente!');
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});


module.exports = app;
