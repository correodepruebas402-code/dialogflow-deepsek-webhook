require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

// Middleware para validar todas las solicitudes de Dialogflow
const validateDialogflow = (req, res, next) => {
  if (req.method === 'GET' && req.query.token !== process.env.DIALOGFLOW_VERIFICATION_TOKEN) {
    return res.status(403).send('Forbidden');
  }
  next();
};

app.use(validateDialogflow);

// Ruta GET para verificación inicial
app.get('/webhook', (req, res) => {
  res.status(200).send(req.query.challenge);
});

// Ruta POST principal
// Reemplaza la ruta POST existente por esto:
app.post(['/webhook', '/'], async (req, res) => {
  console.log('Request received:', req.path);
  // ... resto del código del webhook
});
  
  try {
    const userQuery = req.body.queryResult.queryText;
    
    if (!userQuery) {
      throw new Error('No query text provided');
    }

    // Llamada a DeepSeek
    const deepseekResponse = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: "deepseek-chat",
        messages: [{ role: "user", content: userQuery }],
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const aiResponse = deepseekResponse.data.choices[0].message.content;
    
    const response = {
      fulfillmentText: aiResponse,
      fulfillmentMessages: [{ text: { text: [aiResponse] }},
      source: "dialogflow-deepseek-webhook"
    };

    console.log('Response:', response); // Log para diagnóstico
    res.json(response);

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    res.status(500).json({
      fulfillmentText: "Lo siento, estoy teniendo problemas para procesar tu solicitud. Por favor intenta nuevamente.",
      source: "fallback"
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

