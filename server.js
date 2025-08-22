'use strict';

const express = require('express');
const axios = require('axios');
const { WebhookClient } = require('dialogflow-fulfillment');

require('dotenv').config();

const app = express();
app.use(express.json());

const deepseekApiKey = process.env.DEEPSEEK_API_KEY;

// 🚀 RESPUESTAS DE EMERGENCIA (si Deepseek falla)
const emergencyResponses = {
  perfumes: "En AmericanStor tenemos una amplia selección de perfumes de marcas reconocidas. ¿Te interesa alguna marca específica como Jean Paul Gaultier, Versace, o Dolce & Gabbana?",
  precios: "Nuestros precios son muy competitivos. Te recomiendo visitar nuestra tienda para conocer las ofertas actuales y promociones especiales.",
  marcas: "Manejamos las mejores marcas internacionales: Jean Paul Gaultier, Versace, Dolce & Gabbana, Hugo Boss, Carolina Herrera, entre muchas otras.",
  ubicacion: "Nos encontramos en el centro de la ciudad. Puedes visitarnos o contactarnos para más información sobre ubicación y horarios.",
  default: "En AmericanStor estamos para ayudarte. ¿En qué puedo asistirte específicamente?"
};

// 🎯 FUNCIÓN ULTRA RÁPIDA PARA DEEPSEEK
async function getDeepseekResponse(query, timeout = 2000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: "deepseek-chat",
      messages: [
        {
          role: "system", 
          content: "Eres AmericanStor, tienda de perfumes. Responde en MÁXIMO 25 palabras. Productos: Jean Paul Gaultier, Versace, Dolce & Gabbana, Hugo Boss."
        },
        {
          role: "user", 
          content: query
        }
      ],
      max_tokens: 40,
      temperature: 0.1,
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${deepseekApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: timeout,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return response.data.choices[0].message.content.trim();
    
  } catch (error) {
    clearTimeout(timeoutId);
    console.log('Deepseek timeout/error, using emergency response');
    return null;
  }
}

// 🚨 ENDPOINT PRINCIPAL OPTIMIZADO
app.post('/webhook', async (req, res) => {
  console.log('🚀 Webhook REQUEST received');
  const startTime = Date.now();

  try {
    const agent = new WebhookClient({ request: req, response: res });
    
    async function handlePerfumesIntent(agent) {
      console.log('🎯 Processing Perfumes Intent');
      
      const query = agent.query;
      let responseText;

      // 🚀 INTENTO RÁPIDO CON DEEPSEEK (2 segundos max)
      const deepseekResponse = await getDeepseekResponse(query, 1800);
      
      if (deepseekResponse) {
        responseText = deepseekResponse;
        console.log('✅ Deepseek response success');
      } else {
        // 🚨 FALLBACK INSTANTÁNEO
        if (query.includes('jean paul') || query.includes('gaultier')) {
          responseText = emergencyResponses.perfumes;
        } else if (query.includes('precio')) {
          responseText = emergencyResponses.precios;
        } else if (query.includes('marca')) {
          responseText = emergencyResponses.marcas;
        } else {
          responseText = emergencyResponses.perfumes;
        }
        console.log('⚡ Using emergency response');
      }

      agent.add(responseText);
      
      const duration = Date.now() - startTime;
      console.log(`🎉 Response sent in ${duration}ms`);
    }

    // 🎯 MAPEO DE INTENTS
    let intentMap = new Map();
    intentMap.set('Perfumes_Consulta_General', handlePerfumesIntent);
    intentMap.set('Default Welcome Intent', (agent) => {
      agent.add('¡Hola! Bienvenido a AmericanStor. ¿En qué puedo ayudarte hoy?');
    });

    await agent.handleRequest(intentMap);

  } catch (error) {
    console.error('❌ Webhook error:', error.message);
    res.json({
      fulfillmentText: emergencyResponses.default
    });
  }
});

// 🏥 HEALTH CHECK
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'AmericanStor Webhook OPTIMIZED',
    deepseek: deepseekApiKey ? 'configured' : 'missing',
    timestamp: new Date().toISOString()
  });
});

// 🚀 ROOT ENDPOINT
app.get('/', (req, res) => {
  res.json({
    message: 'AmericanStor Webhook OPTIMIZED is running!',
    endpoints: ['/webhook', '/health']
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 AmericanStor Webhook OPTIMIZED running on port ${PORT}`);
});
