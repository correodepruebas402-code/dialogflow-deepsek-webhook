require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

// Configuración esencial
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/', (req, res) => {
  res.status(200).send('✅ Webhook activo - Dialogflow + DeepSeek');
});

// Webhook principal
app.post('/webhook', async (req, res) => {
  console.log('📥 Request recibido:', JSON.stringify(req.body, null, 2));
  
  try {
    const userQuery = req.body.queryResult?.queryText || "No text provided";

    // 1. Primero verifica si es una prueba simple
    if (userQuery.toLowerCase() === "prueba") {
      return res.json({
        fulfillmentText: "✅ Webhook funcionando correctamente",
        source: "test"
      });
    }

    // 2. Integración con DeepSeek
    const deepseekResponse = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: "deepseek-chat",
        messages: [{ role: "user", content: userQuery }],
        max_tokens: 150,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 4000
      }
    );

    const aiResponse = deepseekResponse.data.choices[0].message.content;

    // Formato para Dialogflow V2
    const response = {
      fulfillmentText: aiResponse,
      fulfillmentMessages: [{
        text: {
          text: [aiResponse]
        }
      }],
      source: "deepseek-api"
    };

    console.log('📤 Respuesta:', response);
    return res.json(response);

  } catch (error) {
    console.error('⚠️ Error:', error.message);
    
    return res.status(200).json({
      fulfillmentText: "Disculpa, estoy teniendo dificultades. Por favor intenta nuevamente.",
      fulfillmentMessages: [{
        text: {
          text: ["Disculpa, estoy teniendo dificultades. Por favor intenta nuevamente."]
        }
      }]
    });
  }
});

// Keep-alive para plan gratuito
setInterval(() => {
  axios.get(`https://dialogflow-deepsek-webhook.onrender.com`)
    .then(() => console.log('🔄 Keep-alive: Ping exitoso'))
    .catch(err => console.log('⚠️ Keep-alive error:', err.message));
}, 14 * 60 * 1000); // Cada 14 minutos

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor activo en puerto ${PORT}`);
  console.log(`🔗 Webhook URL: https://dialogflow-deepsek-webhook.onrender.com/webhook`);
});

module.exports = app;
