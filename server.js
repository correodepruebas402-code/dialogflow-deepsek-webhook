'use strict';

const express = require('express');
const axios = require('axios');
const { WebhookClient } = require('dialogflow-fulfillment');

require('dotenv').config();

const app = express();
app.use(express.json());

const deepseekApiKey = process.env.DEEPSEEK_API_KEY;

// 🎯 BASE DE CONOCIMIENTOS INTELIGENTE
const knowledgeBase = {
  perfumes: {
    "jean paul gaultier": {
      productos: ["Le Male", "Classique", "Scandal", "La Belle"],
      descripcion: "Fragancias icónicas francesas con diseños únicos y aromas distintivos",
      precio_desde: "desde $180.000",
      disponible: true
    },
    "versace": {
      productos: ["Eros", "Dylan Blue", "Bright Crystal", "Pour Homme"],
      descripcion: "Perfumes de lujo italiano con elegancia y sofisticación",
      precio_desde: "desde $165.000",
      disponible: true
    },
    "dolce gabbana": {
      productos: ["Light Blue", "The One", "Dolce", "K"],
      descripcion: "Fragancias mediterráneas con estilo italiano auténtico",
      precio_desde: "desde $155.000",
      disponible: true
    },
    "hugo boss": {
      productos: ["Bottled", "The Scent", "Boss Selection"],
      descripcion: "Perfumes masculinos modernos y elegantes",
      precio_desde: "desde $140.000",
      disponible: true
    }
  },
  servicios: {
    ubicacion: "Nos encontramos en el centro comercial principal. Visítanos para conocer toda nuestra colección.",
    horarios: "Lunes a sábado 9:00 AM - 8:00 PM, domingos 10:00 AM - 6:00 PM",
    garantia: "Todos nuestros productos son 100% originales con garantía de autenticidad",
    whatsapp: "¿Te interesa? Escríbenos al WhatsApp para separar tu perfume favorito.",
    cta: "💬 ¡Contáctanos por WhatsApp para comprar!"
  }
};

// 🧠 PROCESADOR INTELIGENTE DE CONSULTAS MEJORADO
function processQuery(query, parameters = {}) {
  const queryLower = query.toLowerCase();
  
  // Extraer marca de los parámetros de DialogFlow
  let marca = null;
  if (parameters && parameters['marcas_perfumes']) {
    marca = parameters['marcas_perfumes'].toLowerCase();
  }
  
  // Si no hay marca en parámetros, buscar en la consulta
  if (!marca) {
    for (const [marcaKey] of Object.entries(knowledgeBase.perfumes)) {
      if (queryLower.includes(marcaKey.replace(' ', '')) || queryLower.includes(marcaKey)) {
        marca = marcaKey;
        break;
      }
    }
  }
  
  // Respuesta específica por marca
  if (marca && knowledgeBase.perfumes[marca]) {
    const info = knowledgeBase.perfumes[marca];
    const marcaFormatted = marca.charAt(0).toUpperCase() + marca.slice(1);
    
    if (queryLower.includes('precio')) {
      return `💰 En AmericanStor manejamos ${marcaFormatted} ${info.precio_desde}. Productos estrella: ${info.productos.slice(0, 3).join(', ')}. ${info.descripcion}. ${knowledgeBase.servicios.cta}`;
    } else if (queryLower.includes('producto') || queryLower.includes('modelo')) {
      return `✨ Nuestros perfumes ${marcaFormatted} incluyen: ${info.productos.join(', ')}. ${info.descripcion} ${knowledgeBase.servicios.cta}`;
    } else {
      return `🎯 ¡Excelente elección! Sí tenemos ${marcaFormatted} ${info.precio_desde}. Destacamos: ${info.productos.slice(0, 2).join(' y ')}. ${info.descripcion} ${knowledgeBase.servicios.cta}`;
    }
  }
  
  // Consultas generales sobre perfumes
  if (queryLower.includes('perfume') || queryLower.includes('fragancia')) {
    if (queryLower.includes('hombre') || queryLower.includes('masculino')) {
      return "🔥 Perfumes masculinos AmericanStor: Jean Paul Gaultier Le Male, Versace Eros, Dolce & Gabbana K, Hugo Boss Bottled. Desde $140.000. ¿Te interesa alguna marca? " + knowledgeBase.servicios.cta;
    } else if (queryLower.includes('mujer') || queryLower.includes('femenino')) {
      return "💖 Fragancias femeninas: Jean Paul Gaultier Classique, Versace Bright Crystal, Dolce & Gabbana Light Blue. Desde $155.000. " + knowledgeBase.servicios.cta;
    } else if (queryLower.includes('precio') || queryLower.includes('costo')) {
      return "💰 Precios AmericanStor: $140.000 - $250.000. Hugo Boss, Versace, Jean Paul Gaultier, Dolce & Gabbana. ¡Todos originales! " + knowledgeBase.servicios.cta;
    } else {
      return "🎯 AmericanStor - Perfumes originales: Jean Paul Gaultier, Versace, Dolce & Gabbana, Hugo Boss desde $140.000. ¿Masculina o femenina? " + knowledgeBase.servicios.cta;
    }
  }
  
  // Consultas sobre servicios
  if (queryLower.includes('ubicacion') || queryLower.includes('direccion') || queryLower.includes('donde')) {
    return "📍 " + knowledgeBase.servicios.ubicacion + " " + knowledgeBase.servicios.horarios;
  }
  
  if (queryLower.includes('horario') || queryLower.includes('abierto')) {
    return `🕐 ${knowledgeBase.servicios.horarios}. Te esperamos en AmericanStor.`;
  }
  
  if (queryLower.includes('original') || queryLower.includes('garantia')) {
    return "✅ " + knowledgeBase.servicios.garantia + " En AmericanStor solo vendemos productos auténticos.";
  }
  
  // Respuesta por defecto con CTA
  return "🏪 AmericanStor - Mejores marcas de perfumes: Jean Paul Gaultier, Versace, Dolce & Gabbana, Hugo Boss desde $140.000. " + knowledgeBase.servicios.cta;
}

// 🚀 FUNCIÓN DEEPSEEK CORREGIDA (MODELO V3.1)
async function getSmartResponse(query, parameters = {}) {
  // Intentar Deepseek con modelo actualizado
  if (deepseekApiKey && deepseekApiKey.startsWith('sk-')) {
    try {
      console.log('🤖 Attempting Deepseek V3.1...');
      
      // Crear contexto enriquecido
      let contextInfo = "";
      if (parameters && parameters['marcas_perfumes']) {
        const marca = parameters['marcas_perfumes'].toLowerCase();
        if (knowledgeBase.perfumes[marca]) {
          const info = knowledgeBase.perfumes[marca];
          contextInfo = `Información específica de ${marca}: ${info.descripcion}, productos: ${info.productos.join(', ')}, ${info.precio_desde}. `;
        }
      }
      
      const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
        model: "deepseek-chat", // Modelo V3.1 por defecto
        messages: [
          {
            role: "system",
            content: `Eres el asistente de AmericanStor, tienda especializada en perfumes originales. ${contextInfo}
            
            Información clave:
            - Marcas: Jean Paul Gaultier, Versace, Dolce & Gabbana, Hugo Boss
            - Precios: desde $140.000 hasta $250.000
            - Todos los productos son 100% originales
            - Siempre incluye llamada a la acción para WhatsApp
            
            Responde de forma natural, amigable y comercial en máximo 40 palabras. Siempre confirma disponibilidad y guía hacia la venta.`
          },
          {
            role: "user",
            content: query
          }
        ],
        max_tokens: 80,
        temperature: 0.3,
        top_p: 0.9
      }, {
        headers: {
          'Authorization': `Bearer ${deepseekApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });
      
      const deepseekResult = response.data.choices[0].message.content.trim();
      console.log('✅ Deepseek V3.1 response success');
      return deepseekResult;
      
    } catch (error) {
      console.log('⚡ Deepseek failed:', error.response?.status || error.message);
      console.log('📚 Using enhanced knowledge base');
    }
  }
  
  // Fallback mejorado con parámetros
  return processQuery(query, parameters);
}

// 🎯 WEBHOOK PRINCIPAL MEJORADO CON PARÁMETROS
app.post('/webhook', async (req, res) => {
  console.log('🚀 Webhook REQUEST received');
  console.log('📝 Query:', req.body.queryResult?.queryText);
  console.log('🎯 Intent:', req.body.queryResult?.intent?.displayName);
  console.log('📊 Parameters:', req.body.queryResult?.parameters);
  
  const startTime = Date.now();

  try {
    const agent = new WebhookClient({ request: req, response: res });
    
    async function handlePerfumesIntent(agent) {
      console.log('🎯 Processing Perfumes Intent');
      const query = agent.query;
      const parameters = agent.parameters;
      
      // Obtener respuesta inteligente con parámetros
      const responseText = await getSmartResponse(query, parameters);
      
      agent.add(responseText);
      
      const duration = Date.now() - startTime;
      console.log(`🎉 Smart response sent in ${duration}ms`);
    }
    
    async function handleGeneralIntent(agent) {
      console.log('🔄 Processing General Intent');
      const query = agent.query;
      const parameters = agent.parameters;
      
      const responseText = await getSmartResponse(query, parameters);
      agent.add(responseText);
    }
    
    async function handleDefaultIntent(agent) {
      const responses = [
        "🏪 ¡Hola! Soy tu asistente de AmericanStor. ¿Te interesa algún perfume en particular?",
        "✨ ¡Bienvenido a AmericanStor! Tenemos las mejores fragancias originales. ¿En qué puedo ayudarte?",
        "🎯 ¡Hola! En AmericanStor manejamos perfumes originales de grandes marcas. ¿Qué buscas?"
      ];
      agent.add(responses[Math.floor(Math.random() * responses.length)]);
    }

    // Mapeo completo de intents
    let intentMap = new Map();
    
    // Intents específicos de perfumes
    intentMap.set('Perfumes_Consulta_General', handlePerfumesIntent);
    intentMap.set('Perfumes_Marca_Especifica', handlePerfumesIntent);
    intentMap.set('Perfumes_Por_Genero', handlePerfumesIntent);
    intentMap.set('Precios_Consulta', handlePerfumesIntent);
    intentMap.set('Consulta_Disponibilidad_Especifica', handlePerfumesIntent);
    
    // Intents generales
    intentMap.set('Default Welcome Intent', handleDefaultIntent);
    intentMap.set('Default Fallback Intent', handleGeneralIntent);
    
    // Detectar automáticamente consultas sobre perfumes
    if (req.body.queryResult && req.body.queryResult.queryText) {
      const query = req.body.queryResult.queryText.toLowerCase();
      const intentName = req.body.queryResult.intent.displayName;
      
      if (query.includes('perfume') || query.includes('fragancia') || 
          query.includes('jean paul') || query.includes('versace') || 
          query.includes('dolce') || query.includes('hugo') ||
          query.includes('precio') || query.includes('disponibilidad')) {
        
        if (!intentMap.has(intentName)) {
          intentMap.set(intentName, handlePerfumesIntent);
        }
      }
    }

    await agent.handleRequest(intentMap);

  } catch (error) {
    console.error('❌ Webhook error:', error.message);
    const fallbackResponse = "🏪 En AmericanStor tenemos perfumes originales de las mejores marcas. ¡Contáctanos por WhatsApp para más información!";
    res.json({ fulfillmentText: fallbackResponse });
  }
});

// 🏥 HEALTH CHECK DETALLADO
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'AmericanStor Smart Webhook V2.0',
    deepseek: {
      configured: !!deepseekApiKey,
      format_valid: deepseekApiKey ? deepseekApiKey.startsWith('sk-') : false,
      model: 'deepseek-chat (V3.1 compatible)'
    },
    knowledge_base: {
      status: 'active',
      brands: Object.keys(knowledgeBase.perfumes).length,
      enhanced_responses: true
    },
    features: [
      'Enhanced Knowledge Base',
      'DeepSeek V3.1 Integration',
      'Parameter Processing',
      'Smart Fallback',
      'CTA Integration'
    ],
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'AmericanStor Smart Webhook V2.0 is running!',
    version: '2.0.0',
    features: [
      'Smart Knowledge Base with CTA',
      'Deepseek V3.1 Integration', 
      'Fast Response <2s',
      'Parameter-aware Processing',
      'Enhanced Fallback System'
    ],
    endpoints: ['/webhook', '/health']
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 AmericanStor Smart Webhook V2.0 running on port ${PORT}`);
  console.log(`🧠 Enhanced Knowledge Base: ACTIVE`);
  console.log(`🤖 Deepseek V3.1: ${deepseekApiKey ? 'CONFIGURED' : 'NOT CONFIGURED'}`);
  console.log(`📊 Brands Available: ${Object.keys(knowledgeBase.perfumes).length}`);
});


