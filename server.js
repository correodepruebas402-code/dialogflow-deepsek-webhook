'use strict';

const express = require('express');
const axios = require('axios');
const { WebhookClient } = require('dialogflow-fulfillment');
require('dotenv').config();

const app = express();
app.use(express.json());

const deepseekApiKey = process.env.DEEPSEEK_API_KEY;

// 🔧 FUNCIONES AUXILIARES (MOVIDAS AL PRINCIPIO)
function extractKnowledgeBaseAnswers(agent) {
    try {
        // 🚨 CORREGIDO: agent.request (sin guión bajo)
        const knowledgeAnswers = agent.request.body?.queryResult?.knowledgeAnswers?.answers;
        if (knowledgeAnswers && knowledgeAnswers.length > 0) {
            console.log(`✅ Knowledge Base answers found: ${knowledgeAnswers.length}`);
            return knowledgeAnswers.map(answer => answer.answer);
        }
        console.log('❌ No Knowledge Base answers found');
        return null;
    } catch (error) {
        console.log('❌ Error extrayendo Knowledge Base:', error.message);
        return null;
    }
}

// 🤖 FUNCIÓN PARA MEJORAR CON DEEPSEEK
async function enhanceWithDeepseek(query, knowledgeAnswer) {
    const prompt = `Eres un experto vendedor de AmericanStor, especialista en perfumes réplica 1.1 y ropa americana original.

Cliente pregunta: "${query}"

Información de la base de conocimientos: "${knowledgeAnswer}"

INSTRUCCIONES:
- Responde como vendedor entusiasta y profesional
- Mantén la información técnica pero hazla conversacional
- Usa emojis apropiados
- Si hablas de productos, menciona beneficios
- Incluye llamada a la acción hacia WhatsApp si es apropiado
- Máximo 200 palabras

Respuesta natural:`;

    try {
        const response = await axios.post(
            'https://api.deepseek.com/v1/chat/completions',
            {
                model: 'deepseek-chat',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 400
            },
            {
                headers: {
                    'Authorization': `Bearer ${deepseekApiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 4000
            }
        );

        return response.data.choices[0].message.content;
    } catch (error) {
        console.log('❌ Deepseek enhancement failed:', error.message);
        throw error;
    }
}

// 🤖 FUNCIÓN DEEPSEEK PURA (cuando no hay Knowledge Base)
async function queryDeepseek(query) {
    const baseKnowledge = `Eres el vendedor experto de AmericanStor, tienda especializada en:

PERFUMES RÉPLICA 1.1:
- Marcas: Dior Sauvage, Lattafa Yara, Good Girl, Jean Paul Gaultier, CK One, Paco Rabanne
- Calidad: 95% similitud al original, 8-12 horas de duración
- Precios: Desde $35,000 hasta $80,000

ROPA AMERICANA ORIGINAL:
- Marcas: Oakley, Adidas, Nautica, Champion, Levi's, Fila, Nike
- Productos: Camisetas, pantalones, hoodies, gorras
- Tallas: S, M, L, XL, XXL disponibles

SERVICIOS:
- Envío GRATIS desde $80,000 a toda Colombia
- Garantía 30 días
- Entrega 1-3 días hábiles
- Pago: Efectivo, transferencia, Nequi, Daviplata

Responde como vendedor entusiasta, usa emojis, y dirige hacia WhatsApp para detalles.`;

    try {
        const response = await axios.post(
            'https://api.deepseek.com/v1/chat/completions',
            {
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: baseKnowledge },
                    { role: 'user', content: query }
                ],
                temperature: 0.7,
                max_tokens: 400
            },
            {
                headers: {
                    'Authorization': `Bearer ${deepseekApiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 4000
            }
        );

        return response.data.choices[0].message.content;
    } catch (error) {
        console.log('❌ Deepseek query failed:', error.message);
        throw error;
    }
}

// 🛡️ RESPUESTAS DE FALLBACK INTELIGENTES
function getFallbackResponse(query) {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('perfume') || lowerQuery.includes('fragancia')) {
        return '¡Hola! 🌟 Tenemos increíbles perfumes réplica 1.1 como Dior Sauvage, Lattafa Yara y Good Girl con 95% similitud al original. ¿Te interesa alguno específico? Te envío detalles y precios por WhatsApp 📱✨';
    }
    
    if (lowerQuery.includes('ropa') || lowerQuery.includes('camisa') || lowerQuery.includes('pantalón')) {
        return '¡Perfecto! 👕 Manejamos ropa americana original: Oakley, Adidas, Nautica y Champion. Todas las tallas disponibles. ¿Qué tipo de prenda buscas? Te envío el catálogo completo por WhatsApp 📱🛍️';
    }
    
    if (lowerQuery.includes('envío') || lowerQuery.includes('entrega')) {
        return '¡Claro! 🚚 Envío GRATIS desde $80,000 a toda Colombia. Entrega en 1-3 días hábiles. ¿A qué ciudad sería? Te confirmo tiempo exacto por WhatsApp 📱📦';
    }
    
    if (lowerQuery.includes('precio') || lowerQuery.includes('costo')) {
        return '¡Excelente! 💰 Nuestros perfumes van desde $35,000 y ropa desde $45,000. ¡Envío gratis desde $80,000! ¿Qué productos te interesan? Te envío lista completa de precios por WhatsApp 📱💫';
    }
    
    return '¡Hola! 😊 Soy tu asistente de AmericanStor. Especialistas en perfumes réplica 1.1 y ropa americana original. ¿En qué te puedo ayudar? Para atención personalizada y catálogo completo, escríbeme por WhatsApp 📱🌟';
}

// Función principal del webhook
app.post('/webhook', async (request, response) => {
    const agent = new WebhookClient({ request, response });
    
    console.log(`🎯 Intent: ${agent.intent}, Query: "${agent.query}"`);

    async function handleQuery(agent) {
        const userQuery = agent.query;
        const intentName = agent.intent;
        
        console.log(`📝 Processing query: "${userQuery}" for intent: ${intentName}`);
        
        // 🔥 CAPTURAR KNOWLEDGE BASE RESPONSE
        const knowledgeAnswers = extractKnowledgeBaseAnswers(agent);
        
        if (knowledgeAnswers && knowledgeAnswers.length > 0) {
            console.log(`✅ Knowledge Base encontró: ${knowledgeAnswers.length} respuestas`);
            console.log(`📋 Primera respuesta: ${knowledgeAnswers[0].substring(0, 100)}...`);
            
            // 🎯 USAR KNOWLEDGE BASE + DEEPSEEK PARA RESPUESTA NATURAL
            try {
                const naturalResponse = await enhanceWithDeepseek(userQuery, knowledgeAnswers[0]);
                console.log('✅ Respuesta mejorada con Deepseek aplicada');
                agent.add(naturalResponse);
                return;
            } catch (error) {
                console.log('⚠️ Deepseek falló, usando Knowledge Base directa');
                agent.add(knowledgeAnswers[0]);
                return;
            }
        }

        // 🚨 SI NO HAY KNOWLEDGE BASE, USAR DEEPSEEK PURO
        try {
            console.log('🤖 No hay Knowledge Base, consultando Deepseek...');
            const deepseekResponse = await queryDeepseek(userQuery);
            console.log('✅ Deepseek response generated');
            agent.add(deepseekResponse);
        } catch (error) {
            console.log('⚠️ Error total, usando respuesta de fallback');
            agent.add(getFallbackResponse(userQuery));
        }
    }

    // 🎯 CONFIGURAR TODOS LOS INTENTS
    const intentHandlers = new Map();
    
    // Lista de todos tus intents
    const allIntents = [
        'Default Welcome Intent',
        'Default Fallback Intent', 
        'Perfumes_Consulta_General',
        'Perfumes_Por_Tipo',
        'Perfumes_Por_Marca',
        'Ropa_Consulta_General',
        'Ropa_Por_Categoria',
        'Ropa_Por_Marca',
        'Envios_Consulta',
        'Formas_Pago',
        'Tallas_Consulta',
        'Precios_Consulta',
        'Cambios_Devoluciones'
    ];

    // Configurar el mismo handler para todos los intents
    allIntents.forEach(intent => {
        intentHandlers.set(intent, handleQuery);
    });

    agent.handleRequest(intentHandlers);
});

// 🔍 Health check mejorado
app.get('/health', async (req, res) => {
    try {
        if (!deepseekApiKey) {
            return res.status(500).json({ 
                status: 'error', 
                message: 'Deepseek API key no configurada' 
            });
        }

        // Test rápido de Deepseek
        const startTime = Date.now();
        await axios.post('https://api.deepseek.com/v1/chat/completions', {
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 10
        }, {
            headers: {
                'Authorization': `Bearer ${deepseekApiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 3000
        });
        const latency = Date.now() - startTime;

        res.json({
            status: 'healthy',
            deepseek: 'connected',
            latency: `${latency}ms`,
            knowledge_base: 'integrated',
            webhook_url: '/webhook',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'degraded',
            deepseek: 'error',
            fallback: 'active',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 📊 Endpoint de debug para verificar estructura de requests
app.post('/debug', express.json(), (req, res) => {
    console.log('🔍 DEBUG REQUEST BODY:', JSON.stringify(req.body, null, 2));
    res.json({ 
        message: 'Debug logged', 
        hasKnowledgeAnswers: !!req.body?.queryResult?.knowledgeAnswers 
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
    console.log(`✅ Webhook URL: /webhook`);
    console.log(`🔍 Health check: /health`);
    console.log(`🐛 Debug endpoint: /debug`);
    console.log(`🤖 Knowledge Base + Deepseek integrados`);
    console.log(`📊 Priorizando conversaciones naturales y fluidas`);
});
