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

// 🚀 FUNCIÓN DEEPSEEK MEJORADA CON MÁS CONTEXTO
async function getSmartResponse(query, parameters = {}, dialogflowContext = '') {
  if (deepseekApiKey && deepseekApiKey.startsWith('sk-')) {
    try {
      console.log('🤖 Calling Deepseek with vendor personality...');
      console.log('📊 Parameters received:', JSON.stringify(parameters));
      console.log('🔄 Dialogflow context:', dialogflowContext);
      
      // Construir contexto enriquecido
      const parametersInfo = Object.keys(parameters).length > 0 
        ? `Información detectada por Dialogflow: ${JSON.stringify(parameters)}. ` 
        : '';
      
      const contextInfo = dialogflowContext 
        ? `Contexto de conversación: ${dialogflowContext}. ` 
        : '';
      
      const fullSystemPrompt = `${VENDEDOR_PERSONALIDAD}

${parametersInfo}${contextInfo}

Usa toda esta información para responder como el vendedor experto de AmericanStore que eres. Aplica tu personalidad de vendedor a la información que te proporciona Dialogflow. Máximo 50 palabras.`;

      const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: fullSystemPrompt
          },
          {
            role: "user", 
            content: query
          }
        ],
        max_tokens: 100,
        temperature: 0.4,
        top_p: 0.9
      }, {
        headers: {
          'Authorization': `Bearer ${deepseekApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });
      
      const deepseekResult = response.data.choices[0].message.content.trim();
      console.log('✅ Deepseek response with personality success:', deepseekResult);
      return deepseekResult;
      
    } catch (error) {
      console.log('⚡ Deepseek failed:', error.response?.status || error.message);
      console.log('📚 Using fallback response');
    }
  } else {
    console.log('⚠️ DeepSeek not configured, using fallback');
  }
  
  // Fallback genérico con personalidad (Dialogflow maneja el conocimiento)
  return "¡Perfecto! Te tengo la opción ideal en AmericanStore. ¿Qué tipo de fragancia buscas? 💬 Escríbenos al WhatsApp para ayudarte mejor";
}

// 🎯 WEBHOOK PRINCIPAL MEJORADO
app.post('/webhook', async (req, res) => {
  console.log('\n🚀 === WEBHOOK RECEIVED ===');
  console.log('📝 Query:', req.body.queryResult?.queryText);
  console.log('🎯 Intent:', req.body.queryResult?.intent?.displayName);
  console.log('📊 Parameters:', JSON.stringify(req.body.queryResult?.parameters));
  console.log('🕐 Timestamp:', new Date().toISOString());
  
  try {
    const agent = new WebhookClient({ request: req, response: res });
    
    async function handleIntent(agent) {
      console.log('🎭 Processing with vendor personality');
      const query = agent.query;
      const parameters = agent.parameters || {};
      const contexts = agent.contexts || [];
      
      // Extraer información de contexto de Dialogflow
      const contextInfo = contexts.map(c => `${c.name}: ${JSON.stringify(c.parameters)}`).join(', ');
      
      console.log('🧠 Applying personality layer...');
      const responseText = await getSmartResponse(query, parameters, contextInfo);
      agent.add(responseText);
      
      console.log('✅ Response sent with personality:', responseText);
    }
    
    // MAPEO MEJORADO: Maneja TODOS los intents automáticamente
    let intentMap = new Map();
    const intentName = req.body.queryResult?.intent?.displayName || 'Default Fallback Intent';
    
    // Lista de intents comunes - puedes agregar más según necesites
    const commonIntents = [
      'Default Welcome Intent',
      'Default Fallback Intent',
      'Perfumes_Consulta_General',
      'Productos_Consulta',
      'Precios_Consulta',
      'Disponibilidad_Consulta'
    ];
    
    // Mapear intents conocidos
    commonIntents.forEach(intent => {
      intentMap.set(intent, handleIntent);
    });
    
    // Auto-mapear ANY intent que no esté en la lista (esto es clave)
    if (!intentMap.has(intentName)) {
      console.log(`🔄 Auto-mapping new intent: ${intentName}`);
      intentMap.set(intentName, handleIntent);
    }

    await agent.handleRequest(intentMap);

  } catch (error) {
    console.error('❌ Webhook error:', error.message);
    console.error('📊 Full error:', error);
    
    const fallbackResponse = "¡Hola! Soy tu experto en AmericanStore. Tenemos las mejores fragancias originales. ¿Qué perfume buscas? 💬 Escríbenos al WhatsApp";
    
    res.json({ 
      fulfillmentText: fallbackResponse,
      fulfillmentMessages: [{ text: { text: [fallbackResponse] } }]
    });
  }
});

// 🏥 HEALTH CHECK MEJORADO
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'AmericanStore Smart Webhook v3.1',
    architecture: 'Hybrid - Dialogflow KB + Server Personality',
    personality: {
      active: true,
      type: 'Expert Vendor',
      techniques: ['Opening', 'Value Creation', 'Urgency', 'Closing']
    },
    deepseek: {
      configured: !!deepseekApiKey,
      valid: deepseekApiKey ? deepseekApiKey.startsWith('sk-') : false,
      model: 'deepseek-chat'
    },
    features: [
      'Vendor Personality Integrated', 
      'Sales Techniques Active',
      'DeepSeek AI Enhancement',
      'Smart Fallback System',
      'Auto Intent Mapping',
      'Context Awareness'
    ],
    knowledge_base: 'Dialogflow Knowledge Base',
    timestamp: new Date().toISOString()
  });
});

// 🧪 ENDPOINT DE PRUEBA MEJORADO
app.get('/test', async (req, res) => {
  const testQuery = req.query.q || "Hola, busco un perfume para hombre";
  const testParams = req.query.params ? JSON.parse(req.query.params) : {};
  
  try {
    const response = await getSmartResponse(testQuery, testParams, 'Test Context');
    res.json({
      query: testQuery,
      parameters: testParams,
      response: response,
      personality: 'Expert Vendor Active',
      architecture: 'Dialogflow KB + Server Personality',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.json({
      error: error.message,
      query: testQuery,
      personality: 'Fallback Active'
    });
  }
});

// 📊 NUEVO: Endpoint para ver la personalidad
app.get('/personality', (req, res) => {
  res.json({
    personality: VENDEDOR_PERSONALIDAD,
    active: true,
    version: '3.1'
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'AmericanStore Smart Webhook v3.1 - Expert Vendor Personality',
    architecture: 'Hybrid: Dialogflow Knowledge Base + Server Personality',
    personality: 'Active - Expert Vendor',
    endpoints: {
      webhook: '/webhook',
      health: '/health', 
      test: '/test?q=tu_pregunta',
      personality: '/personality'
    }
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`\n🚀 AmericanStore Smart Webhook v3.1 running on port ${PORT}`);
  console.log(`🏗️  Architecture: Hybrid (Dialogflow KB + Server Personality)`);
  console.log(`🎭 Vendor Personality: ACTIVE`);
  console.log(`🤖 Deepseek Integration: ${deepseekApiKey ? 'CONFIGURED' : 'NOT CONFIGURED'}`);
  console.log(`🧠 Knowledge Base: Dialogflow (recommended)`);
  console.log(`💼 Ready to sell with expert techniques!`);
  console.log(`\n🔗 Test it: http://localhost:${PORT}/test?q=busco%20un%20perfume`);
});
