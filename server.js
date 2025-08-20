'use strict';

const express = require('express');
const axios = require('axios');
const { WebhookClient } = require('dialogflow-fulfillment');
require('dotenv').config();

const app = express();
app.use(express.json());

const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
const deepseekApiUrl = 'https://api.deepseek.com/v1/chat/completions';

console.log(`✅ API Key configurada: ${deepseekApiKey ? 'SÍ' : 'NO'}`);

// Base de conocimiento MÍNIMA - Solo para emergencias
const emergencyContext = `
Eres un asistente de AmericanStor Online. Si no puedes ayudar, dirige al cliente a:
- WhatsApp para atención personalizada
- Instagram @americanstor.online  
- Web: https://americanstor.online/
`;

async function handleWithDeepseek(agent) {
    const userQuery = agent.query;
    const intentName = agent.intent || 'Unknown';
    
    console.log(`📝 Intent: ${intentName} | Consulta: "${userQuery}"`);

    // Solo fallback si no hay API key
    if (!deepseekApiKey) {
        console.log('❌ API Key no configurada');
        agent.add('Hola! Para atención personalizada sobre nuestros productos AmericanStor, escríbeme al WhatsApp o Instagram @americanstor.online 😊');
        return;
    }

    try {
        console.log('🚀 Consultando Deepseek con contexto de Dialogflow...');
        
        // Deepseek recibe TODA la información de contexto desde Dialogflow
        const apiResponse = await axios.post(deepseekApiUrl, {
            model: 'deepseek-chat',
            messages: [
                { 
                    role: 'system', 
                    content: `Eres un asistente virtual experto y amigable de AmericanStor Online. 
                    
                    Responde de manera natural, conversacional y entusiasta, como un vendedor experto que conoce perfectamente los productos.
                    
                    INSTRUCCIONES:
                    - Usa toda la información de contexto que tienes disponible
                    - Responde de forma natural y fluida
                    - Sé específico cuando tengas la información
                    - Si no tienes información exacta, dirige al WhatsApp/Instagram
                    - Incluye emojis ocasionales para ser más amigable
                    - Mantén un tono conversacional, no robotizado
                    - Siempre termina con una pregunta o llamado a la acción
                    
                    Actúa como un vendedor real que quiere ayudar genuinamente al cliente.`
                },
                { role: 'user', content: userQuery }
            ],
            max_tokens: 250, // Más tokens para respuestas naturales
            temperature: 0.4, // Ligeramente más creativo para naturalidad
            top_p: 0.9
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${deepseekApiKey}`
            },
            timeout: 4000 // 4 segundos - priorizamos calidad sobre velocidad extrema
        });

        if (apiResponse.data?.choices?.[0]?.message?.content) {
            const botResponse = apiResponse.data.choices[0].message.content.trim();
            console.log(`✅ Deepseek respondió naturalmente`);
            agent.add(botResponse);
        } else {
            throw new Error('Empty response from Deepseek');
        }

    } catch (error) {
        console.error(`❌ Error Deepseek: ${error.message}`);
        
        // Fallback simple pero efectivo
        const fallbackResponses = [
            'Gracias por contactar AmericanStor Online 😊 Para brindarte la información más precisa sobre tu consulta, escríbeme al WhatsApp donde puedo ayudarte de manera personalizada.',
            'Hola! Me encantaría ayudarte con información detallada sobre nuestros productos. Escríbeme al WhatsApp o síguenos en Instagram @americanstor.online para atención personalizada 📱',
            'Perfecto! Para darte la mejor información sobre nuestros productos AmericanStor, te invito a escribirme al WhatsApp donde puedo resolver todas tus dudas 😊'
        ];
        
        const randomFallback = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
        console.log(`🔄 Usando fallback aleatorio`);
        agent.add(randomFallback);
    }
}

// Webhook ultra-simplificado
app.post('/webhook', (request, response) => {
    console.log('🔔 Webhook recibido');
    const agent = new WebhookClient({ request, response });
    
    // TODOS los intents van directo a Deepseek
    let intentMap = new Map();
    intentMap.set('Default Fallback Intent', handleWithDeepseek);
    
    // Si tienes intents específicos, todos van a la misma función
    intentMap.set('Consulta_Categorias', handleWithDeepseek);
    intentMap.set('Envio_sin_cobertura', handleWithDeepseek);
    intentMap.set('Envios_info', handleWithDeepseek);
    intentMap.set('Perfumes_Consulta', handleWithDeepseek);
    intentMap.set('Consulta_Tallas', handleWithDeepseek);
    intentMap.set('Consulta_Pagos', handleWithDeepseek);
    intentMap.set('Saludos', handleWithDeepseek);

    agent.handleRequest(intentMap);
});

// Health check simplificado
app.get('/health', async (req, res) => {
    let deepseekStatus = 'No configurada';
    let latency = null;
    
    if (deepseekApiKey) {
        try {
            const startTime = Date.now();
            await axios.post(deepseekApiUrl, {
                model: 'deepseek-chat',
                messages: [{ role: 'user', content: 'Hola' }],
                max_tokens: 10
            }, {
                headers: {
                    'Authorization': `Bearer ${deepseekApiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 3000
            });
            
            latency = Date.now() - startTime;
            deepseekStatus = 'OK';
        } catch (error) {
            deepseekStatus = `Error: ${error.message}`;
        }
    }
    
    res.json({ 
        status: 'OK',
        architecture: 'Deepseek + Dialogflow Knowledge Base',
        deepseek: deepseekStatus,
        latency: latency ? `${latency}ms` : null,
        naturalResponses: true,
        timestamp: new Date().toISOString()
    });
});

// Test endpoint para verificar respuestas naturales
app.get('/test-natural/:query', async (req, res) => {
    const testQuery = req.params.query;
    
    if (!deepseekApiKey) {
        return res.json({ error: 'API Key no configurada' });
    }
    
    try {
        const startTime = Date.now();
        const response = await axios.post(deepseekApiUrl, {
            model: 'deepseek-chat',
            messages: [
                { 
                    role: 'system', 
                    content: 'Eres un asistente natural y amigable de AmericanStor Online. Responde de forma conversacional y específica usando el contexto de Dialogflow.'
                },
                { role: 'user', content: testQuery }
            ],
            max_tokens: 200,
            temperature: 0.4
        }, {
            headers: {
                'Authorization': `Bearer ${deepseekApiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 4000
        });
        
        const duration = Date.now() - startTime;
        
        res.json({
            query: testQuery,
            response: response.data?.choices?.[0]?.message?.content,
            duration_ms: duration,
            natural: true,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        res.json({
            query: testQuery,
            error: error.message,
            natural: false
        });
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`🚀 AmericanStor Bot - Arquitectura Natural en puerto ${port}`);
    console.log(`🤖 Deepseek + Base de Conocimiento en Dialogflow`);
    console.log(`💬 Priorizando conversaciones naturales y fluidas`);
    console.log(`🧪 Test: /test-natural/tu-consulta-aqui`);
});
