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
      precio_desde: "desde $180.000"
    },
    "versace": {
      productos: ["Eros", "Dylan Blue", "Bright Crystal", "Pour Homme"],
      descripcion: "Perfumes de lujo italiano con elegancia y sofisticación",
      precio_desde: "desde $165.000"
    },
    "dolce gabbana": {
      productos: ["Light Blue", "The One", "Dolce", "K"],
      descripcion: "Fragancias mediterráneas con estilo italiano auténtico",
      precio_desde: "desde $155.000"
    },
    "hugo boss": {
      productos: ["Bottled", "The Scent", "Boss Selection"],
      descripcion: "Perfumes masculinos modernos y elegantes",
      precio_desde: "desde $140.000"
    }
  },
  servicios: {
    ubicacion: "Nos encontramos en el centro comercial principal. Visítanos para conocer toda nuestra colección.",
    horarios: "Lunes a sábado 9:00 AM - 8:00 PM, domingos 10:00 AM - 6:00 PM",
    garantia: "Todos nuestros productos son 100% originales con garantía de autenticidad"
  }
};

// 🧠 PROCESADOR INTELIGENTE DE CONSULTAS
function processQuery(query) {
  const queryLower = query.toLowerCase();
  
  // Detección de marca específica
  for (const [marca, info] of Object.entries(knowledgeBase.perfumes)) {
    if (queryLower.includes(marca.replace(' ', '')) || queryLower.includes(marca)) {
      if (queryLower.includes('precio')) {
        return `En AmericanStor manejamos ${marca.charAt(0).toUpperCase() + marca.slice(1)} ${info.precio_desde}. Productos destacados: ${info.productos.slice(0, 3).join(', ')}. ${info.descripcion}`;
      } else if (queryLower.includes('producto') || queryLower.includes('modelo')) {
        return `Nuestros perfumes ${marca.charAt(0).toUpperCase() + marca.slice(1)} incluyen: ${info.productos.join(', ')}. ${info.descripcion} Visítanos para conocer disponibilidad actual.`;
      } else {
        return `¡Excelente elección! En AmericanStor tenemos ${marca.charAt(0).toUpperCase() + marca.slice(1)} ${info.precio_desde}. Destacamos: ${info.productos.slice(0, 2).join(' y ')}. ${info.descripcion}`;
      }
    }
  }
  
  // Consultas generales sobre perfumes
  if (queryLower.includes('perfume') || queryLower.includes('fragancia')) {
    if (queryLower.includes('hombre') || queryLower.includes('masculino')) {
      return "En AmericanStor tenemos perfumes masculinos de marcas premium: Jean Paul Gaultier Le Male, Versace Eros, Dolce & Gabbana K, Hugo Boss Bottled. Desde $140.000. ¿Te interesa alguna marca específica?";
    } else if (queryLower.includes('mujer') || queryLower.includes('femenino')) {
      return "Nuestras fragancias femeninas incluyen: Jean Paul Gaultier Classique, Versace Bright Crystal, Dolce & Gabbana Light Blue, y más. Desde $155.000. ¿Qué estilo de fragancia buscas?";
    } else if (queryLower.includes('precio') || queryLower.includes('costo')) {
      return "Nuestros perfumes van desde $140.000 hasta $250.000. Manejamos Hugo Boss, Versace, Jean Paul Gaultier, Dolce & Gabbana. Todos originales con garantía. ¿Te interesa alguna marca?";
    } else {
      return "En AmericanStor somos especialistas en perfumes originales. Manejamos Jean Paul Gaultier, Versace, Dolce & Gabbana, Hugo Boss desde $140.000. ¿Buscas fragancia masculina o femenina?";
    }
  }
  
  // Consultas sobre ubicación/servicios
  if (queryLower.includes('ubicacion') || queryLower.includes('direccion') || queryLower.includes('donde')) {
    return knowledgeBase.servicios.ubicacion + " " + knowledgeBase.servicios.horarios;
  }
  
  if (queryLower.includes('horario') || queryLower.includes('abierto')) {
    return `Nuestros horarios en AmericanStor: ${knowledgeBase.servicios.horarios}. Te esperamos para mostrarte nuestra colección completa.`;
  }
  
  if (queryLower.includes('original') || queryLower.includes('garantia')) {
    return knowledgeBase.servicios.garantia + " En AmericanStor solo vendemos productos auténticos de las mejores marcas.";
  }
  
  // Respuesta por defecto inteligente
  return "En AmericanStor tenemos las mejores marcas de perfumes: Jean Paul Gaultier, Versace, Dolce & Gabbana, Hugo Boss desde $140.000. ¿En qué puedo ayudarte específicamente?";
}

// 🚀 FUNCIÓN DEEPSEEK MEJORADA (CON FALLBACK INTELIGENTE)
async function getSmartResponse(query) {
  // Primero intentamos Deepseek solo si la API key está configurada correctamente
  if (deepseekApiKey && deepseekApiKey.startsWith('sk-')) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      
      const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "Eres AmericanStor, tienda de perfumes. Responde naturalmente en máximo 35 palabras. Marcas: Jean Paul Gaultier, Versace, Dolce&Gabbana, Hugo Boss. Precios desde $140.000."
          },
          {
            role: "user",
            content: query
          }
        ],
        max_tokens: 50,
        temperature: 0.2
      }, {
        headers: {
          'Authorization': `Bearer ${deepseekApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 1500,
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      const deepseekResult = response.data.choices[0].message.content.trim();
      console.log('✅ Deepseek response success');
      return deepseekResult;
      
    } catch (error) {
      console.log('⚡ Deepseek failed, using smart knowledge base');
    }
  }
  
  // Fallback a knowledge base inteligente
  return processQuery(query);
}

// 🎯 WEBHOOK PRINCIPAL OPTIMIZADO
app.post('/webhook', async (req, res) => {
  console.log('🚀 Webhook REQUEST received');
  const startTime = Date.now();

  try {
    const agent = new WebhookClient({ request: req, response: res });
    
    async function handlePerfumesIntent(agent) {
      console.log('🎯 Processing Perfumes Intent');
      const query = agent.query;
      
      // Obtener respuesta inteligente (Deepseek o Knowledge Base)
      const responseText = await getSmartResponse(query);
      
      agent.add(responseText);
      
      const duration = Date.now() - startTime;
      console.log(`🎉 Smart response sent in ${duration}ms`);
    }
    
    async function handleDefaultIntent(agent) {
      const responses = [
        "¡Hola! Soy tu asistente de AmericanStor. ¿Te interesa algún perfume en particular?",
        "¡Bienvenido a AmericanStor! Tenemos las mejores fragancias. ¿En qué puedo ayudarte?",
        "¡Hola! En AmericanStor manejamos perfumes originales de grandes marcas. ¿Qué buscas?"
      ];
      agent.add(responses[Math.floor(Math.random() * responses.length)]);
    }

    // Mapeo de intents
    let intentMap = new Map();
    intentMap.set('Perfumes_Consulta_General', handlePerfumesIntent);
    intentMap.set('Default Welcome Intent', handleDefaultIntent);
    
    // Para cualquier otro intent relacionado con perfumes
    if (req.body.queryResult && req.body.queryResult.queryText) {
      const query = req.body.queryResult.queryText.toLowerCase();
      if (query.includes('perfume') || query.includes('fragancia') || query.includes('jean paul') || 
          query.includes('versace') || query.includes('dolce') || query.includes('hugo')) {
        intentMap.set(req.body.queryResult.intent.displayName, handlePerfumesIntent);
      }
    }

    await agent.handleRequest(intentMap);

  } catch (error) {
    console.error('❌ Webhook error:', error.message);
    const fallbackResponse = "En AmericanStor tenemos perfumes originales de las mejores marcas. ¡Visítanos para conocer toda nuestra colección!";
    res.json({ fulfillmentText: fallbackResponse });
  }
});

// 🏥 HEALTH CHECK MEJORADO
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'AmericanStor Smart Webhook',
    deepseek: deepseekApiKey ? (deepseekApiKey.startsWith('sk-') ? 'configured' : 'invalid_format') : 'missing',
    knowledge_base: 'active',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'AmericanStor Smart Webhook is running!',
    features: ['Smart Knowledge Base', 'Deepseek Integration', 'Fast Response <2s'],
    endpoints: ['/webhook', '/health']
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 AmericanStor Smart Webhook running on port ${PORT}`);
  console.log(`🧠 Knowledge Base: ACTIVE`);
  console.log(`🤖 Deepseek: ${deepseekApiKey ? 'CONFIGURED' : 'NOT CONFIGURED'}`);
});
