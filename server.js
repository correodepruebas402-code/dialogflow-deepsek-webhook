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

const knowledgeBaseContext = `
Eres un asistente virtual experto y amigable de la tienda AmericanStor Online. Responde de manera clara, concisa y natural usando únicamente la siguiente información. Si no sabes la respuesta exacta, dirige al cliente a los canales de contacto.

**AmericanStor Online:**
- Tienda 100% online de ropa americana original para hombre
- Productos: Ropa (camisetas, buzos, gorras) y perfumes
- Ropa 100% original importada de EE.UU.
- Contacto: WhatsApp e Instagram @americanstor.online
- Web: https://americanstor.online/

**Productos:**
- Ropa americana original para hombres, tallas S-XL
- Perfumes para hombre y mujer
- Perfumes 1.1: réplicas alta calidad, 6-10 horas duración, precio más accesible

**Envíos:**
- A toda Colombia vía Inter Rapidísimo/Servientrega
- Costo: $10.000-$15.000 COP
- Tiempo: 1-3 días ciudades principales, hasta 5 días otras zonas

**Pagos:**
- Transferencias (Nequi, Daviplata, Bancolombia)
- Contra entrega en algunas ciudades
- Tarjetas débito/crédito

**Cambios:**
- 5 días después de recibir, prenda sin uso con etiquetas

IMPORTANTE: Responde siempre de forma natural y conversacional, como si fueras un vendedor amigable. Si no puedes responder algo específico, di: "Para información más detallada, contacta nuestro WhatsApp o Instagram @americanstor.online"
`;

// Respuestas inteligentes expandidas
function getSmartResponse(query) {
    const queryLower = query.toLowerCase();
    
    // Saludos
    if (/^(hola|hello|hi|buenas|buenos|saludos|que tal)/i.test(query)) {
        return '¡Hola! Bienvenido a AmericanStor Online, tu tienda de ropa americana original para hombre y perfumes. ¿En qué puedo ayudarte hoy?';
    }
    
    // Perfumes
    if (queryLower.includes('perfume')) {
        if (queryLower.includes('dior') || queryLower.includes('sauvage')) {
            return '¡Sí! En AmericanStor Online tenemos perfumes Dior Sauvage tanto originales como réplicas 1.1 de alta calidad. Las réplicas 1.1 tienen una duración de 6-10 horas y precio más accesible que los originales. Para ver disponibilidad y precios, escríbenos al WhatsApp o visita https://americanstor.online/';
        }
        return '¡Perfecto! En AmericanStor Online ofrecemos perfumes para hombre y mujer. Tenemos originales importados y también perfumes 1.1 (réplicas de alta calidad) con duración de 6-10 horas y precio más accesible. Para ver nuestro catálogo completo, visita https://americanstor.online/ o escríbenos al WhatsApp.';
    }
    
    // Información de envíos
    if (queryLower.includes('envio') || queryLower.includes('enviar') || queryLower.includes('entrega')) {
        return 'Hacemos envíos a toda Colombia a través de Inter Rapidísimo y Servientrega. El costo es de $10.000 a $15.000 COP. A ciudades principales llega en 1-3 días hábiles, a otras zonas hasta 5 días hábiles. ¿A qué ciudad necesitas el envío?';
    }
    
    // Tallas
    if (queryLower.includes('talla')) {
        return 'Manejamos tallas americanas desde S hasta XL. Te recomendamos revisar nuestra guía de tallas en https://americanstor.online/ para encontrar tu medida perfecta. Si tienes dudas sobre tu talla, escríbenos al WhatsApp con tus medidas y te ayudamos.';
    }
    
    // Originalidad
    if (queryLower.includes('original') || queryLower.includes('autentic')) {
        return 'Sí, toda nuestra ropa es 100% original, importada directamente de Estados Unidos de marcas reconocidas. Garantizamos la autenticidad y excelente calidad de todos nuestros productos.';
    }
    
    // Pagos
    if (queryLower.includes('pago') || queryLower.includes('pagar') || queryLower.includes('precio')) {
        return 'Puedes pagar por transferencias (Nequi, Daviplata, Bancolombia), contra entrega en algunas ciudades, o con tarjetas de débito/crédito a través de plataformas seguras. Para conocer precios específicos, visita https://americanstor.online/ o escríbenos al WhatsApp.';
    }
    
    // Cambios
    if (queryLower.includes('cambio') || queryLower.includes('devol') || queryLower.includes('cambiar')) {
        return 'Sí, aceptamos cambios por talla o referencia en los primeros 5 días después de recibir el producto. La prenda debe estar en perfecto estado, sin uso y con etiquetas. El costo del envío para el cambio corre por cuenta del cliente.';
    }
    
    // Contacto
    if (queryLower.includes('contacto') || queryLower.includes('whatsapp') || queryLower.includes('instagram')) {
        return 'Puedes contactarnos por WhatsApp (nuestro canal principal de atención) o Instagram @americanstor.online. También visita nuestra web https://americanstor.online/ para ver el catálogo completo.';
    }
    
    // Ropa/productos
    if (queryLower.includes('ropa') || queryLower.includes('camisa') || queryLower.includes('buzo') || queryLower.includes('gorra')) {
        return 'En AmericanStor Online especializamos en ropa americana original para hombre: camisetas, buzos, gorras y más. Todas las prendas son importadas directamente de EE.UU. en tallas S-XL. Visita https://americanstor.online/ para ver nuestro catálogo completo.';
    }
    
    return null;
}

async function handleDeepseekQuery(agent) {
    const userQuery = agent.query;
    const intentName = agent.intent || 'Unknown';
    
    console.log(`📝 Intent: ${intentName} | Consulta: "${userQuery}"`);

    // 1. Primero intenta respuesta inteligente rápida
    const quickResponse = getSmartResponse(userQuery);
    if (quickResponse) {
        console.log(`⚡ Respuesta rápida aplicada`);
        agent.add(quickResponse);
        return;
    }

    // 2. Si no hay API key, respuesta de fallback
    if (!deepseekApiKey) {
        console.log('❌ API Key no configurada');
        agent.add('Gracias por contactar AmericanStor Online. Para información detallada sobre nuestros productos, contacta nuestro WhatsApp o Instagram @americanstor.online');
        return;
    }

    // 3. Llamada a Deepseek con configuración optimizada
    try {
        console.log('🚀 Llamando Deepseek API...');
        
        const apiResponse = await axios.post(deepseekApiUrl, {
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: knowledgeBaseContext },
                { role: 'user', content: userQuery }
            ],
            max_tokens: 150,
            temperature: 0.2,
            top_p: 0.9
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${deepseekApiKey}`
            },
            timeout: 3500, // Reducido a 3.5 segundos
            validateStatus: function (status) {
                return status >= 200 && status < 300;
            }
        });

        if (apiResponse.data?.choices?.[0]?.message?.content) {
            const botResponse = apiResponse.data.choices[0].message.content.trim();
            console.log(`✅ Deepseek respondió exitosamente`);
            agent.add(botResponse);
        } else {
            console.log('⚠️ Respuesta vacía de Deepseek');
            throw new Error('Empty response from Deepseek');
        }

    } catch (error) {
        console.error(`❌ Error Deepseek: ${error.code || error.message}`);
        
        // Respuesta de fallback inteligente basada en la consulta
        const fallbackResponse = getFallbackResponse(userQuery);
        agent.add(fallbackResponse);
    }
}

function getFallbackResponse(query) {
    const queryLower = query.toLowerCase();
    let response = 'Gracias por contactar AmericanStor Online. ';
    
    if (queryLower.includes('perfume')) {
        response += 'Ofrecemos perfumes originales y réplicas 1.1 de alta calidad con duración de 6-10 horas. ';
    } else if (queryLower.includes('envio')) {
        response += 'Enviamos a toda Colombia por $10.000-$15.000 COP en 1-5 días hábiles. ';
    } else if (queryLower.includes('talla')) {
        response += 'Manejamos tallas americanas S-XL con guía en nuestra web. ';
    } else if (queryLower.includes('pago')) {
        response += 'Aceptamos transferencias, contra entrega y tarjetas. ';
    } else if (queryLower.includes('original')) {
        response += 'Toda nuestra ropa es 100% original importada de EE.UU. ';
    } else {
        response += 'Somos especialistas en ropa americana original y perfumes. ';
    }
    
    response += 'Para información completa y personalizada, escríbenos al WhatsApp o Instagram @americanstor.online';
    return response;
}

// Webhook principal
app.post('/webhook', (request, response) => {
    console.log('🔔 Webhook recibido');
    
    const agent = new WebhookClient({ request, response });

    // Mapeo de todos los intents a la misma función
    let intentMap = new Map();
    intentMap.set('Default Fallback Intent', handleDeepseekQuery);
    intentMap.set('Consulta_Categorias', handleDeepseekQuery);
    intentMap.set('Envio_sin_cobertura', handleDeepseekQuery);
    intentMap.set('Envios_info', handleDeepseekQuery);
    intentMap.set('Perfumes_Consulta', handleDeepseekQuery);
    
    // Agregar más intents si existen
    intentMap.set('Consulta_Tallas', handleDeepseekQuery);
    intentMap.set('Consulta_Pagos', handleDeepseekQuery);
    intentMap.set('Consulta_Cambios', handleDeepseekQuery);
    intentMap.set('Saludos', handleDeepseekQuery);

    agent.handleRequest(intentMap);
});

// Health check mejorado
app.get('/health', async (req, res) => {
    let deepseekStatus = 'No configurada';
    let deepseekLatency = null;
    
    if (deepseekApiKey) {
        try {
            const startTime = Date.now();
            const testResponse = await axios.post(deepseekApiUrl, {
                model: 'deepseek-chat',
                messages: [{ role: 'user', content: 'Test' }],
                max_tokens: 5,
                temperature: 0
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${deepseekApiKey}`
                },
                timeout: 3000
            });
            
            deepseekLatency = Date.now() - startTime;
            deepseekStatus = deepseekLatency < 3000 ? 'OK' : 'Lenta';
        } catch (error) {
            deepseekStatus = `Error: ${error.message}`;
        }
    }
    
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        deepseekApiKey: deepseekApiKey ? 'Configurada' : 'Faltante',
        deepseekStatus: deepseekStatus,
        deepseekLatency: deepseekLatency,
        optimizedForDialogflow: true,
        quickResponsesEnabled: true
    });
});

// Test de velocidad completo
app.get('/speed-test', async (req, res) => {
    const tests = [];
    
    // Test de respuesta rápida
    const quickStart = Date.now();
    const quickResponse = getSmartResponse('hola');
    tests.push({
        type: 'quick_response',
        duration_ms: Date.now() - quickStart,
        success: !!quickResponse,
        response: quickResponse
    });
    
    // Test de Deepseek si está configurado
    if (deepseekApiKey) {
        const deepseekStart = Date.now();
        try {
            const testResponse = await axios.post(deepseekApiUrl, {
                model: 'deepseek-chat',
                messages: [{ role: 'user', content: 'Responde solo "OK"' }],
                max_tokens: 5,
                temperature: 0
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${deepseekApiKey}`
                },
                timeout: 3500
            });

            tests.push({
                type: 'deepseek_api',
                duration_ms: Date.now() - deepseekStart,
                success: true,
                response: testResponse.data?.choices?.[0]?.message?.content
            });
        } catch (error) {
            tests.push({
                type: 'deepseek_api',
                duration_ms: Date.now() - deepseekStart,
                success: false,
                error: error.message
            });
        }
    }
    
    res.json({
        tests: tests,
        dialogflow_compatible: tests.every(t => t.duration_ms < 4000),
        timestamp: new Date().toISOString()
    });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`🚀 Servidor AmericanStor optimizado en puerto ${port}`);
    console.log(`⚡ Timeout Deepseek: 3.5 segundos`);
    console.log(`🎯 Respuestas rápidas activadas`);
    console.log(`📱 Health check: http://localhost:${port}/health`);
});
