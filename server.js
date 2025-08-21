'use strict';

const express = require('express');
const axios = require('axios');
const { WebhookClient } = require('dialogflow-fulfillment');
require('dotenv').config();

const app = express();
app.use(express.json());

const deepseekApiKey = process.env.DEEPSEEK_API_KEY;

// Función principal del webhook
app.post('/webhook', async (request, response) => {
    const agent = new WebhookClient({ request, response });
    
    console.log(`Intent: ${agent.intent}, Query: "${agent.query}"`);

    async function handleQuery(agent) {
        const userQuery = agent.query;
        const intentName = agent.intent;
        
        // 🔥 CAPTURAR KNOWLEDGE BASE RESPONSE
        const knowledgeAnswers = extractKnowledgeBaseAnswers(agent);
        
        if (knowledgeAnswers && knowledgeAnswers.length > 0) {
            console.log(`Knowledge Base encontró: ${knowledgeAnswers.length} respuestas`);
            
            // 🎯 USAR KNOWLEDGE BASE + DEEPSEEK PARA RESPUESTA NATURAL
            try {
                const naturalResponse = await enhanceWithDeepseek(userQuery, knowledgeAnswers[0]);
                console.log('Respuesta mejorada con Deepseek aplicada');
                agent.add(naturalResponse);
                return;
            } catch (error) {
                console.log('Deepseek falló, usando Knowledge Base directa');
                agent.add(knowledgeAnswers[0]);
                return;
            }
        }

        // 🚨 SI NO HAY KNOWLEDGE BASE, USAR DEEPSEEK PURO
        try {
            console.log('No hay Knowledge Base, consultando Deepseek...');
            const deepseekResponse = await queryDeepseek(userQuery);
            agent.add(deepseekResponse);
        } catch (error) {
            console.log('Error total, respuesta de fallback');
            agent.add(getFallbackResponse(userQuery));
        }
    }

    // 🔧 FUNCIÓN PARA EXTRAER RESPUESTAS DE KNOWLEDGE BASE
    function extractKnowledgeBaseAnswers(agent) {
        try {
            const knowledgeAnswers = agent.request_.body?.queryResult?.knowledgeAnswers?.answers;
            if (knowledgeAnswers && knowledgeAnswers.length > 0) {
                return knowledgeAnswers.map(answer => answer.answer);
            }
            return null;
        } catch (error) {
            console.log('Error extrayendo Knowledge Base:', error);
            return null;
        }
    }

    // 🤖 FUNCIÓN PARA MEJORAR CON DEEPSEEK
    async function enhanceWithDeepseek(query, knowledgeAnswer) {
        const prompt = `Eres un experto vendedor de AmericanStor. Un cliente pregunta: "${query}"

La base de conocimientos dice: "${knowledgeAnswer}"

Responde de manera natural, entusiasta y profesional como vendedor experto. Mantén la información técnica pero hazla conversacional. Incluye llamada a la acción hacia WhatsApp si es apropiado.

Respuesta:`;

        const response = await axios.post(
            'https://api.deepseek.com/v1/chat/completions',
            {
                model: 'deepseek-chat',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 500
            },
            {
                headers: {
                    'Authorization': `Bearer ${deepseekApiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 3500
            }
        );

        return response.data.choices[0].message.content;
    }

    // 🤖 FUNCIÓN DEEPSEEK PURA (cuando no hay Knowledge Base)
    async function queryDeepseek(query) {
        const baseKnowledge = `Eres vendedor experto de AmericanStor, tienda de perfumes réplica 1.1 y ropa americana original.

PRODUCTOS PRINCIPALES:
- Perfumes: Dior Sauvage, Lattafa Yara, Good Girl, Jean Paul Gaultier, CK One
- Ropa: Marcas Oakley, Adidas, Nautica, Champion, Levi's, Fila
- Servicios: Envío gratis desde $80,000, garantía 30 días

Responde como vendedor entusiasta y profesional.`;

        const response = await axios.post(
            'https://api.deepseek.com/v1/chat/completions',
            {
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: baseKnowledge },
                    { role: 'user', content: query }
                ],
                temperature: 0.7,
                max_tokens: 500
            },
            {
                headers: {
                    'Authorization': `Bearer ${deepseekApiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 3500
            }
        );

        return response.data.choices[0].message.content;
    }

    // 🛡️ RESPUESTAS DE FALLBACK INTELIGENTES
    function getFallbackResponse(query) {
        const lowerQuery = query.toLowerCase();
        
        if (lowerQuery.includes('perfume') || lowerQuery.includes('fragancia')) {
            return '¡Hola! 🌟 Tenemos una increíble selección de perfumes réplica 1.1 como Dior Sauvage, Lattafa Yara y Good Girl. ¿Te gustaría conocer alguno en particular? Escríbeme al WhatsApp para enviarte fotos y precios actualizados! 📱';
        }
        
        if (lowerQuery.includes('ropa') || lowerQuery.includes('camisa') || lowerQuery.includes('pantalón')) {
            return '¡Perfecto! 👕 Manejamos ropa americana original de marcas como Oakley, Adidas, Nautica y Champion. ¿Buscas algo específico? Por WhatsApp te puedo enviar el catálogo completo con tallas y precios! 📱';
        }
        
        if (lowerQuery.includes('envío') || lowerQuery.includes('entrega')) {
            return '¡Claro! 🚚 Enviamos a toda Colombia con envío GRATIS desde $80,000. Entrega en 1-3 días hábiles. ¿A qué ciudad sería el envío? Te doy el detalle exacto por WhatsApp 📱';
        }
        
        return '¡Hola! 😊 Soy tu asistente de AmericanStor. Tenemos perfumes réplica 1.1 y ropa americana original. ¿En qué te puedo ayudar hoy? Para atención personalizada, escríbeme al WhatsApp 📱';
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
        'Precios_Consulta'
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
            timeout: 2000
        });
        const latency = Date.now() - startTime;

        res.json({
            status: 'healthy',
            deepseek: 'connected',
            latency: `${latency}ms`,
            knowledge_base: 'integrated',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'degraded',
            deepseek: 'error',
            fallback: 'active',
            timestamp: new Date().toISOString()
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
    console.log(`✅ Webhook URL: /webhook`);
    console.log(`🔍 Health check: /health`);
    console.log(`🤖 Knowledge Base + Deepseek integrados`);
});
