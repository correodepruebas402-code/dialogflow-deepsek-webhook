'use strict';

const express = require('express');
const axios = require('axios');
const { WebhookClient } = require('dialogflow-fulfillment');

require('dotenv').config();

const app = express();
app.use(express.json());

const deepseekApiKey = process.env.DEEPSEEK_API_KEY;

// Función para mejorar respuestas con Deepseek (movida al principio)
async function improveResponseWithDeepseek(originalResponse, userQuery, context = '') {
  if (!deepseekApiKey) {
    console.log('⚠️ Deepseek API key no configurada');
    return originalResponse;
  }

  try {
    console.log('🤖 Mejorando respuesta con Deepseek...');
    
    const prompt = `
Eres un asistente de ventas especializado para AmericanStor, una tienda de productos americanos premium.

INFORMACIÓN DEL USUARIO:
- Consulta: "${userQuery}"
- Respuesta base: "${originalResponse}"
- Contexto adicional: ${context}

INSTRUCCIONES:
1. Mejora la respuesta base manteniendo la información original
2. Hazla más conversacional y vendedora
3. Incluye un emoji relevante al inicio
4. Termina con una pregunta o call-to-action
5. Mantén un tono amigable y profesional
6. Máximo 150 palabras

RESPUESTA MEJORADA:`;

    const response = await axios.post(
      'https://api.deepseek.com/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${deepseekApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    const improvedResponse = response.data.choices[0].message.content.trim();
    console.log('✅ Respuesta mejorada con Deepseek aplicada');
    return improvedResponse;

  } catch (error) {
    console.error('❌ Error con Deepseek:', error.message);
    return originalResponse;
  }
}

// Función para extraer respuestas del Knowledge Base
function extractKnowledgeBaseAnswers(agent) {
  try {
    console.log('🔍 Extrayendo respuestas del Knowledge Base...');
    
    // CORRECCIÓN CRÍTICA: agent.request SIN guión bajo
    const request = agent.request;
    console.log('📊 Request disponible:', !!request);
    
    if (!request || !request.body || !request.body.queryResult) {
      console.log('❌ Estructura de request inválida');
      return null;
    }

    const queryResult = request.body.queryResult;
    console.log('📋 QueryResult disponible:', !!queryResult);
    
    // Extraer respuestas del Knowledge Base
    const knowledgeAnswers = queryResult.knowledgeAnswers?.answers;
    console.log('🧠 Knowledge Answers encontradas:', knowledgeAnswers?.length || 0);
    
    if (knowledgeAnswers && knowledgeAnswers.length > 0) {
      const firstAnswer = knowledgeAnswers[0];
      console.log('📋 Primera respuesta:', firstAnswer.answer?.substring(0, 100) + '...');
      return firstAnswer.answer;
    }
    
    console.log('⚠️ No se encontraron respuestas en Knowledge Base');
    return null;
    
  } catch (error) {
    console.error('❌ Error extrayendo Knowledge Base:', error);
    return null;
  }
}

// Webhook principal
app.post('/webhook', async (req, res) => {
  console.log('\n🎯 === WEBHOOK TRIGGERED ===');
  console.log('🎯 Intent:', req.body?.queryResult?.intent?.displayName);
  console.log('🎯 Query:', req.body?.queryResult?.queryText);
  
  const agent = new WebhookClient({ request: req, response: res });
  
  async function defaultFallback(agent) {
    try {
      console.log('🔄 Procesando intent:', agent.intent);
      
      const userQuery = agent.query;
      console.log('💬 Consulta del usuario:', userQuery);
      
      // Extraer respuesta del Knowledge Base
      const knowledgeResponse = extractKnowledgeBaseAnswers(agent);
      
      if (knowledgeResponse) {
        console.log('✅ Knowledge Base encontró respuesta');
        
        // Mejorar respuesta con Deepseek
        const improvedResponse = await improveResponseWithDeepseek(
          knowledgeResponse,
          userQuery,
          'AmericanStor - Productos americanos premium'
        );
        
        console.log('📤 Enviando respuesta mejorada');
        agent.add(improvedResponse);
        
      } else {
        console.log('⚠️ No hay respuesta de Knowledge Base, usando fallback');
        
        const fallbackMessage = `🛍️ ¡Hola! Soy el asistente de AmericanStor. 
        
Aunque no tengo información específica sobre "${userQuery}", estoy aquí para ayudarte con:
        
• 🧴 Perfumes y fragancias premium
• 🍫 Dulces y snacks americanos  
• 👕 Ropa y accesorios
• 🎮 Productos tech y gaming
        
¿Te gustaría saber sobre alguno de estos productos? 😊`;
        
        agent.add(fallbackMessage);
      }
      
    } catch (error) {
      console.error('❌ Error en defaultFallback:', error);
      agent.add('🤔 Disculpa, tuve un pequeño inconveniente. ¿Podrías repetir tu pregunta?');
    }
  }

  // Mapear todos los intents al mismo handler
  const intentMap = new Map();
  intentMap.set('Default Fallback Intent', defaultFallback);
  intentMap.set('Perfumes_Consulta_General', defaultFallback);
  intentMap.set('Dulces_Consulta', defaultFallback);
  intentMap.set('Ropa_Consulta', defaultFallback);
  intentMap.set('Productos_Generales', defaultFallback);
  
  agent.handleRequest(intentMap);
});

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'AmericanStor Chatbot Webhook ACTIVE 🚀',
    timestamp: new Date().toISOString(),
    deepseekConfigured: !!deepseekApiKey
  });
});

// Debug endpoint
app.get('/debug', (req, res) => {
  res.json({
    status: 'Debug Info',
    deepseekConfigured: !!deepseekApiKey,
    timestamp: new Date().toISOString(),
    version: '2.0'
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 AmericanStor Webhook iniciado en puerto ${PORT}`);
  console.log(`🔗 URL: https://dialogflow-deepseek-webhook.onrender.com`);
  console.log(`🤖 Deepseek configurado: ${deepseekApiKey ? '✅' : '❌'}`);
});
