'use strict';

const express = require('express');
const axios = require('axios');
const { WebhookClient } = require('dialogflow-fulfillment');

require('dotenv').config();

const app = express();
app.use(express.json());

const deepseekApiKey = process.env.DEEPSEEK_API_KEY;

// 🚀 ENDPOINTS DE VERIFICACIÓN
app.get('/', (req, res) => {
    res.json({ 
        status: 'AmericanStor Webhook Active - OPTIMIZADO', 
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        service: 'AmericanStor Webhook FAST',
        deepseek: deepseekApiKey ? 'configured' : 'missing'
    });
});

// ⚡ FUNCIÓN RÁPIDA PARA DEEPSEEK (MÁXIMO 3 SEGUNDOS)
async function mejorarRespuestaRapido(respuestaOriginal, query) {
    if (!deepseekApiKey) {
        return respuestaOriginal || 'Gracias por tu consulta sobre AmericanStor. ¿En qué más puedo ayudarte? 😊';
    }

    try {
        const prompt = `Responde como asistente de AmericanStor (tienda de ropa y perfumes).
Consulta: "${query}"
Info disponible: "${respuestaOriginal || 'productos disponibles'}"

Respuesta corta (máximo 80 palabras), amigable con emojis:`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 segundos máximo

        const response = await axios.post('https://api.deepseek.com/chat/completions', {
            model: "deepseek-chat",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 100,
            temperature: 0.3
        }, {
            headers: {
                'Authorization': `Bearer ${deepseekApiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 3000,
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        return response.data.choices[0].message.content.trim();

    } catch (error) {
        console.log('⚡ Deepseek timeout/error, usando respuesta rápida');
        // RESPUESTA DE EMERGENCIA RÁPIDA
        return generarRespuestaRapida(query, respuestaOriginal);
    }
}

// 🎯 RESPUESTAS RÁPIDAS SIN API (BACKUP)
function generarRespuestaRapida(query, info) {
    const keywords = query.toLowerCase();
    
    if (keywords.includes('perfume') || keywords.includes('fragancia')) {
        return info || '¡Hola! 😊 Tenemos una gran variedad de perfumes y fragancias. ¿Buscas algo específico para hombre o mujer? 🎯';
    }
    
    if (keywords.includes('ropa') || keywords.includes('camiseta') || keywords.includes('pantalón')) {
        return info || '¡Perfecto! 👕 Manejamos ropa de calidad en diferentes tallas. ¿Qué tipo de prenda te interesa? 😊';
    }
    
    if (keywords.includes('talla') || keywords.includes('medida')) {
        return info || 'Manejamos tallas desde S hasta XXL. 📏 ¿Necesitas ayuda con alguna talla específica? ¡Te ayudamos! 😊';
    }
    
    if (keywords.includes('envío') || keywords.includes('entrega')) {
        return info || 'Realizamos envíos a todo el país. 🚚 Los tiempos y costos varían según la ubicación. ¿A qué ciudad enviarías? 📦';
    }
    
    // Respuesta general
    return info || '¡Hola! 👋 Soy tu asistente de AmericanStor. Tenemos ropa y perfumes de calidad. ¿En qué puedo ayudarte hoy? 😊';
}

// 🎯 WEBHOOK PRINCIPAL - OPTIMIZADO PARA VELOCIDAD
app.post('/webhook', async (req, res) => {
    console.log('⚡ REQUEST RECIBIDO - PROCESAMIENTO RÁPIDO');
    
    try {
        const agent = new WebhookClient({ request: req, response: res });
        console.log('🎯 Intent:', agent.intent, '| Query:', agent.query);

        // ⚡ PROCESO ULTRA RÁPIDO
        const startTime = Date.now();
        
        // Intentar usar Knowledge Base del request si está disponible
        let respuestaBase = '';
        if (req.body.queryResult && req.body.queryResult.knowledgeAnswers) {
            const answers = req.body.queryResult.knowledgeAnswers.answers;
            if (answers && answers.length > 0) {
                respuestaBase = answers[0].answer;
                console.log('📋 KB encontrada en request');
            }
        }

        // Mejorar respuesta RÁPIDAMENTE
        const respuestaFinal = await mejorarRespuestaRapido(respuestaBase, agent.query);
        
        const processingTime = Date.now() - startTime;
        console.log('⏱️ Tiempo procesamiento:', processingTime + 'ms');
        
        agent.add(respuestaFinal);
        
    } catch (error) {
        console.error('❌ Error en webhook:', error.message);
        
        // RESPUESTA DE EMERGENCIA SÚPER RÁPIDA
        const agent = new WebhookClient({ request: req, response: res });
        agent.add('¡Hola! 😊 Soy tu asistente de AmericanStor. ¿En qué puedo ayudarte con nuestros productos? 🛍️');
    }
    
    console.log('✅ Respuesta enviada');
});

// 🚀 INICIAR SERVIDOR
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log('⚡ AmericanStor Webhook RÁPIDO iniciado en puerto:', PORT);
    console.log('🔗 URL:', `https://dialogflow-deepseek-webhook.onrender.com/webhook`);
    console.log('✅ Deepseek:', deepseekApiKey ? '✓ Configurado' : '✗ No configurado');
    console.log('⏱️ Optimizado para respuestas < 4 segundos');
    console.log('////////////////////////////////////////////////');
});

// Error handling
process.on('unhandledRejection', (reason) => {
    console.log('⚠️ Promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.log('⚠️ Uncaught exception:', error.message);
});
