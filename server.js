// 🚀 FUNCIÓN DEEPSEEK OPTIMIZADA PARA V3.1
async function getSmartResponse(query) {
  // Primero intentamos Deepseek con configuración optimizada
  if (deepseekApiKey && deepseekApiKey.startsWith('sk-')) {
    try {
      console.log('🤖 Attempting DeepSeek V3.1 call...');
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // ⚡ Timeout aumentado a 5s
      
      const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
        model: "deepseek-chat", // ✅ Modelo correcto para V3.1
        messages: [
          {
            role: "system",
            content: `Eres el asistente virtual de AmericanStor, tienda especializada en perfumes originales. 

INFORMACIÓN DE LA TIENDA:
- Marcas disponibles: Jean Paul Gaultier, Versace, Dolce & Gabbana, Hugo Boss
- Precios: desde $140.000 hasta $250.000
- Todos los productos son 100% originales con garantía
- Ubicación: Centro comercial principal
- Horarios: Lun-Sáb 9AM-8PM, Dom 10AM-6PM

INSTRUCCIONES:
- Responde de forma natural y conversacional
- Siempre incluye precios cuando sea relevante
- Menciona disponibilidad y invita a visitar la tienda
- Máximo 40 palabras por respuesta
- Usa un tono amigable y profesional`
          },
          {
            role: "user",
            content: query
          }
        ],
        max_tokens: 80, // ⚡ Aumentado para respuestas más completas
        temperature: 0.3, // ⚡ Ligeramente más creativo
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1
      }, {
        headers: {
          'Authorization': `Bearer ${deepseekApiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'AmericanStor-Webhook/1.0'
        },
        timeout: 5000, // ⚡ Timeout más generoso
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      if (response.data && response.data.choices && response.data.choices[0]) {
        const deepseekResult = response.data.choices[0].message.content.trim();
        console.log('✅ DeepSeek V3.1 response SUCCESS:', deepseekResult.substring(0, 50) + '...');
        return deepseekResult;
      } else {
        throw new Error('Invalid response structure from DeepSeek');
      }
      
    } catch (error) {
      // 🔍 LOGGING DETALLADO PARA DEBUGGING
      if (error.code === 'ECONNABORTED') {
        console.log('⏰ DeepSeek timeout - usando knowledge base');
      } else if (error.response) {
        console.log('🚫 DeepSeek API error:', error.response.status, error.response.data);
      } else if (error.request) {
        console.log('📡 DeepSeek network error:', error.message);
      } else {
        console.log('⚡ DeepSeek general error:', error.message);
      }
    }
  } else {
    console.log('🔑 DeepSeek API key not properly configured');
  }
  
  // Fallback a knowledge base inteligente
  console.log('🧠 Using smart knowledge base fallback');
  return processQuery(query);
}

// 🎯 WEBHOOK PRINCIPAL CON MEJOR MANEJO DE INTENTS
app.post('/webhook', async (req, res) => {
  console.log('🚀 Webhook REQUEST received');
  console.log('🎯 Intent:', req.body.queryResult?.intent?.displayName);
  console.log('📝 Query:', req.body.queryResult?.queryText);
  console.log('🏷️ Parameters:', JSON.stringify(req.body.queryResult?.parameters || {}));
  
  const startTime = Date.now();

  try {
    const agent = new WebhookClient({ request: req, response: res });
    
    async function handlePerfumesIntent(agent) {
      console.log('🎯 Processing Perfumes Intent');
      const query = agent.query;
      const parameters = agent.parameters;
      
      // Construir contexto enriquecido para DeepSeek
      let contextualQuery = query;
      if (parameters && Object.keys(parameters).length > 0) {
        contextualQuery += ` [Parámetros detectados: ${JSON.stringify(parameters)}]`;
      }
      
      // Obtener respuesta inteligente (Deepseek o Knowledge Base)
      const responseText = await getSmartResponse(contextualQuery);
      
      agent.add(responseText);
      
      const duration = Date.now() - startTime;
      console.log(`🎉 Response sent in ${duration}ms`);
    }
    
    async function handleGeneralIntent(agent) {
      console.log('🔄 Processing General Intent');
      const query = agent.query;
      const responseText = await getSmartResponse(query);
      agent.add(responseText);
    }
    
    async function handleDefaultIntent(agent) {
      const responses = [
        "¡Hola! Soy tu asistente de AmericanStor. ¿Te interesa algún perfume en particular?",
        "¡Bienvenido a AmericanStor! Tenemos las mejores fragancias desde $140.000. ¿En qué puedo ayudarte?",
        "¡Hola! En AmericanStor manejamos perfumes originales de Jean Paul Gaultier, Versace, Dolce & Gabbana y Hugo Boss. ¿Qué buscas?"
      ];
      agent.add(responses[Math.floor(Math.random() * responses.length)]);
    }

    // 🗺️ MAPEO INTELIGENTE DE INTENTS
    let intentMap = new Map();
    
    // Intents específicos de perfumes
    intentMap.set('Perfumes_Consulta_General', handlePerfumesIntent);
    intentMap.set('Perfumes_Marca_Especifica', handlePerfumesIntent);
    intentMap.set('Perfumes_Por_Genero', handlePerfumesIntent);
    intentMap.set('Perfumes_Recomendacion_Personal', handlePerfumesIntent);
    intentMap.set('Precios_Consulta', handlePerfumesIntent);
    intentMap.set('Consulta_Disponibilidad_Especifica', handlePerfumesIntent);
    
    // Intents generales
    intentMap.set('Default Welcome Intent', handleDefaultIntent);
    intentMap.set('Default Fallback Intent', handleGeneralIntent);
    
    // Para cualquier otro intent, usar manejo inteligente
    const currentIntent = req.body.queryResult?.intent?.displayName;
    if (currentIntent && !intentMap.has(currentIntent)) {
      const query = req.body.queryResult?.queryText?.toLowerCase() || '';
      if (query.includes('perfume') || query.includes('fragancia') || 
          query.includes('jean paul') || query.includes('versace') || 
          query.includes('dolce') || query.includes('hugo') ||
          query.includes('precio') || query.includes('costo')) {
        intentMap.set(currentIntent, handlePerfumesIntent);
      } else {
        intentMap.set(currentIntent, handleGeneralIntent);
      }
    }

    await agent.handleRequest(intentMap);

  } catch (error) {
    console.error('❌ Webhook critical error:', error.message);
    const fallbackResponse = "En AmericanStor tenemos perfumes originales de las mejores marcas desde $140.000. ¡Visítanos para conocer toda nuestra colección!";
    res.json({ 
      fulfillmentText: fallbackResponse,
      source: 'webhook-fallback'
    });
  }
});

// 🏥 HEALTH CHECK CON DIAGNÓSTICO DEEPSEEK
app.get('/health', async (req, res) => {
  let deepseekStatus = 'not_configured';
  
  if (deepseekApiKey && deepseekApiKey.startsWith('sk-')) {
    try {
      // Test rápido de DeepSeek
      const testResponse = await axios.post('https://api.deepseek.com/v1/chat/completions', {
        model: "deepseek-chat",
        messages: [{ role: "user", content: "test" }],
        max_tokens: 5
      }, {
        headers: {
          'Authorization': `Bearer ${deepseekApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 3000
      });
      deepseekStatus = 'healthy';
    } catch (error) {
      deepseekStatus = `error: ${error.response?.status || error.message}`;
    }
  }

  res.json({
    status: 'healthy',
    service: 'AmericanStor Smart Webhook v2.0',
    deepseek_status: deepseekStatus,
    deepseek_model: 'deepseek-chat (V3.1)',
    knowledge_base: 'active',
    features: ['Smart Fallback', 'Enhanced Logging', 'Context Enrichment'],
    timestamp: new Date().toISOString()
  });
});
