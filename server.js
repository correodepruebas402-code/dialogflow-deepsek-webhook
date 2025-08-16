require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

// Endpoint de prueba
app.get('/', (req, res) => {
  res.send('¡Webhook activo! Usa POST /webhook para Dialogflow');
});

// Webhook mejorado
app.post('/webhook', async (req, res) => {
  console.log('Request recibido:', JSON.stringify(req.body, null, 2));
  
  try {
    const userQuery = req.body.queryResult?.queryText || "No text provided";
    
    // Respuesta rápida de prueba (comenta las próximas 3 líneas para usar DeepSeek)
    const testResponse = {
      fulfillmentText: `Recibí: "${userQuery}". Webhook funcionando ✅`,
      source: "test"
    };
    return res.json(testResponse);

    /* // Código para DeepSeek (descomentar cuando lo anterior funcione)
    const deepseekResponse = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: "deepseek-chat",
      messages: [{ role: "user", content: userQuery }]
    }, {
      headers: { 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` }
    });

    res.json({
      fulfillmentText: deepseekResponse.data.choices[0].message.content
    });
    */
  } catch (error) {
    console.error('Error:', error);
    res.status(200).json({ // Dialogflow siempre espera 200
      fulfillmentText: "Disculpa, estoy teniendo problemas técnicos. Intenta nuevamente."
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Servidor activo en puerto ${PORT}`);
});
