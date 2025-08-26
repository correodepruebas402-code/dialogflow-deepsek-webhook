'use strict';

const express = require('express');
const axios = require('axios');
const { WebhookClient } = require('dialogflow-fulfillment');

require('dotenv').config();

const app = express();
app.use(express.json());

const deepseekApiKey = process.env.DEEPSEEK_API_KEY;

// 🎯 PERSONALIDAD DEL VENDEDOR AMERICANSTORE
const VENDEDOR_PERSONALIDAD = `
Eres un vendedor experto, entusiasta y profesional de American Store Online con estas características:

- **Entusiasta pero no agresivo** - Genuinamente emocionado por ayudar
- **Conocedor de productos** - Experto en cada artículo que vendes  
- **Orientado a soluciones** - Encuentras el producto perfecto para cada cliente
- **Creador de urgencia** - Sin presionar, generas interés genuino
- **Seguidor de procesos** - Guías al cliente paso a paso hacia la compra

## TÉCNICAS QUE USAS:

**APERTURA:**
- "¡Perfecto! Te tengo la opción ideal..."
- "Excelente elección, ese es uno de nuestros favoritos..."
- "¡Qué bueno que preguntes! Justamente tenemos..."

**CREACIÓN DE VALOR:**
- "Este producto es especial porque..."
- "La diferencia que vas a notar es..."
- "Nuestros clientes nos dicen que..."

**CREACIÓN DE URGENCIA:**
- "Justo ahora tenemos disponibilidad..."
- "Es uno de los que más se está vendiendo..."
- "Aprovecha que tenemos stock..."

**CIERRE:**
- "¿Te gustaría que te reserve uno?"
- "¿En qué talla lo necesitas?"
- "¿Cuándo te gustaría recibirlo?"
- "¿A qué ciudad te lo enviamos?"

IMPORTANTE: Siempre termina con una llamada a la acción clara para WhatsApp.
`;

// 🚀 FUNCIÓN DEEPSEEK OPTIMIZADA PARA VELOCIDAD
async function getSmartResponse(query, parameters = {}) {
  // ⚡ TIMEOUT MUY CORTO para evitar que Dialogflow haga timeout
  const DEEPSEEK_TIMEOUT = 2000; // Solo 2 segundos
  
  if (deepseekApiKey && deepseekApiKey.startsWith('sk-')) {
    try {
      console.log('🤖 Quick Deepseek call...');
      
      // Prompt más corto para respuesta más rápida
      const shortPrompt = `Eres el vendedor experto de AmericanStore. Responde en máximo 40 palabras con personalidad de vendedor entusiasta. Incluye emojis y termina con llamada al WhatsApp.

Parámetros: ${JSON.stringify(parameters)}`;

      const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: shortPrompt
          },
          {
            role: "user", 
            content: query
          }
        ],
        max_tokens: 80, // Reducido para respuesta más rápida
        temperature: 0.3, // Más determinístico = más rápido
        top_p: 0.8
      }, {
        headers: {
          'Authorization': `Bearer ${deepseekApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: DEEPSEEK_TIMEOUT // ⚡ TIMEOUT CORTO
      });
      
      if (response.data?.choices?.[0]?.message?.content) {
        const result = response.data.choices[0].message.content.trim();
        console.log('✅ Quick Deepseek success');
        return result;
      }
      
    } catch (error) {
      console.log('⚡ Deepseek timeout/error (expected), using fallback');
      // NO loggeamos el error completo para acelerar
    }
  }
  
  // 🎯 FALLBACK INTELIGENTE CON PERSONALIDAD
  return getFallbackResponse(query, parameters);
}

// 🎯 FALLBACK INTELIGENTE BASADO EN PARÁMETROS
function getFallbackResponse(query, parameters = {}) {
  const queryLower = query.toLowerCase();
  
  // Detectar marca de perfume en parámetros
  if (parameters.marcas_perfumes) {
    const marca = parameters.marcas_perfumes;
    return `¡Excelente elección! ${marca} es una de nuestras marcas favoritas 🌟 Tenemos varios modelos disponibles. ¿Te gustaría que te reserve uno? 💬 Escríbenos al WhatsApp`;
  }
  
  // Saludos
  if (queryLower.includes('hola') || queryLower.includes('buenas')) {
    return `¡Hola! Soy tu experto en AmericanStore 😊 ¿Buscas alguna fragancia en particular? ¡Te tengo opciones increíbles! 💬 Escríbenos al WhatsApp`;
  }
  
  // Consultas de perfumes para hombre
  if (queryLower.includes('hombre') || queryLower.includes('masculino')) {
    return `¡Perfecto! Tenemos fragancias masculinas espectaculares 🔥 Desde clásicas hasta modernas. ¿Cuál es tu estilo? 💬 Escríbenos al WhatsApp`;
  }
  
  // Consultas de perfumes para mujer  
  if (queryLower.includes('mujer') || queryLower.includes('femenino')) {
    return `¡Excelente! Nuestras fragancias femeninas son increíbles ✨ Elegantes y seductoras. ¿Para qué ocasión? 💬 Escríbenos al WhatsApp`;
  }
  
  // Consultas de precios
  if (queryLower.includes('precio') || queryLower.includes('costo') || queryLower.includes('cuanto')) {
    return `¡Tenemos opciones para todos los presupuestos! 💰 Desde $80.000 hasta perfumes premium. ¿Cuál es tu rango? 💬 Escríbenos al WhatsApp`;
  }
  
  // Disponibilidad
  if (queryLower.includes('disponible') || queryLower.includes('stock') || queryLower.includes('tienen')) {
    return `¡Justo ahora tenemos disponibilidad! 📦 Es uno de los que más se está vendiendo. ¿Te gustaría que te reserve uno? 💬 Escríbenos al WhatsApp`;
  }
  
  // Default entusiasta
  return `¡Perfecto! Te tengo la opción ideal en AmericanStore 🎯 Somos expertos en fragancias originales. ¿Qué tipo buscas? 💬 Escríbenos al WhatsApp`;
}

// 🎯 WEBHOOK OPTIMIZADO PARA VELOCIDAD
app.post('/webhook', async (req, res) => {
  const startTime = Date.now();
  
  console.log('\n🚀 === WEBHOOK RECEIVED ===');
  console.log('📝 Query:', req.body.queryResult?.queryText);
  console.log('🎯 Intent:', req.body.queryResult?.intent?.displayName);
  
  try {
    const agent = new WebhookClient({ request: req, response: res });
    
    async function handleIntent(agent) {
      const query = agent.query;
      const parameters = agent.parameters || {};
      
      console.log('🎭 Applying vendor personality...');
      console.log('📊 Parameters:', JSON.stringify(parameters));
      
      // ⚡ Respuesta rápida
      const responseText = await getSmartResponse(query, parameters);
      agent.add(responseText);
      
      const duration = Date.now() - startTime;
      console.log(`✅ Response sent in ${duration}ms:`, responseText);
    }
    
    // 🎯 MAPEO SIMPLE Y RÁPIDO
    let intentMap = new Map();
    const intentName = req.body.queryResult?.intent?.displayName || 'Default Fallback Intent';
    
    // Manejar TODOS los intents con la misma función (más rápido)
    intentMap.set(intentName, handleIntent);

    await agent.handleRequest(intentMap);

  } catch (error) {
    console.error('❌ Webhook error:', error.message);
    
    // ⚡ RESPUESTA DE EMERGENCIA SÚPER RÁPIDA
    const emergencyResponse = "¡Hola! Soy tu experto en AmericanStore. ¿Qué fragancia buscas? 💬 Escríbenos al WhatsApp";
    
    res.json({ 
      fulfillmentText: emergencyResponse,
      fulfillmentMessages: [{ text: { text: [emergencyResponse] } }]
    });
  }
});

// 🏥 HEALTH CHECK RÁPIDO
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'AmericanStore Fast Webhook v3.2',
    personality: 'Expert Vendor - Active',
    deepseek: {
      configured: !!deepseekApiKey,
      timeout: '2000ms (fast)',
      fallback: 'intelligent'
    },
    optimizations: [
      'Fast DeepSeek timeout (2s)',
      'Intelligent fallback system', 
      'Parameter-based responses',
      'Reduced token usage',
      'Single intent handler'
    ],
    timestamp: new Date().toISOString()
  });
});

// 🧪 TEST ENDPOINT RÁPIDO
app.get('/test', async (req, res) => {
  const testQuery = req.query.q || "Hola, busco un perfume";
  const testParams = req.query.params ? JSON.parse(req.query.params) : {};
  
  const startTime = Date.now();
  
  try {
    const response = await getSmartResponse(testQuery, testParams);
    const duration = Date.now() - startTime;
    
    res.json({
      query: testQuery,
      parameters: testParams,
      response: response,
      response_time: `${duration}ms`,
      personality: 'Expert Vendor Active',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.json({
      error: error.message,
      query: testQuery,
      fallback: 'active'
    });
  }
});

app.get('/', (req, res) => {
  res.json({
    message: 'AmericanStore Fast Webhook v3.2 - Optimized for Speed',
    personality: 'Expert Vendor Active',
    optimizations: 'Fast DeepSeek + Intelligent Fallback',
    endpoints: {
      webhook: '/webhook',
      health: '/health', 
      test: '/test?q=tu_pregunta'
    }
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`\n🚀 AmericanStore Fast Webhook v3.2 running on port ${PORT}`);
  console.log(`⚡ Optimized for speed - Max 2s DeepSeek timeout`);
  console.log(`🎭 Vendor Personality: ACTIVE`);
  console.log(`🤖 DeepSeek: ${deepseekApiKey ? 'FAST MODE' : 'FALLBACK ONLY'}`);
  console.log(`🧠 Intelligent Fallback System: READY`);
  console.log(`💼 Ready for lightning-fast responses!`);
  console.log(`\n🔗 Test: http://localhost:${PORT}/test?q=busco%20perfume%20hombre`);
});
