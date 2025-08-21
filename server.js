'use strict';

const express = require('express');
const axios = require('axios');
const { WebhookClient } = require('dialogflow-fulfillment');

require('dotenv').config();

const app = express();
app.use(express.json());

const deepseekApiKey = process.env.DEEPSEEK_API_KEY;

// 🚀 ENDPOINT DE SALUD - PARA VERIFICAR QUE EL SERVIDOR FUNCIONA
app.get('/', (req, res) => {
    res.json({ 
        status: 'AmericanStor Webhook Active', 
        timestamp: new Date().toISOString(),
        endpoints: ['/webhook', '/health']
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        service: 'AmericanStor Webhook',
        deepseek: deepseekApiKey ? 'configured' : 'missing'
    });
});

// 🔧 FUNCIONES PRINCIPALES ANTES DEL WEBHOOK
async function consultarKnowledgeBase(query, sessionPath, projectId) {
    try {
        console.log('🔍 Consultando Knowledge Base...');
        const sessionClient = new (require('@google-cloud/dialogflow').SessionsClient)();
        
        const request = {
            session: sessionPath,
            queryInput: {
                text: {
                    text: query,
                    languageCode: 'es',
                },
            },
        };

        const responses = await sessionClient.detectIntent(request);
        const result = responses[0].queryResult;

        if (result.knowledgeAnswers && result.knowledgeAnswers.answers && result.knowledgeAnswers.answers.length > 0) {
            const respuesta = result.knowledgeAnswers.answers[0].answer;
            console.log('✅ Knowledge Base encontró respuesta');
            return respuesta;
        }

        console.log('⚠️ Knowledge Base no encontró respuestas específicas');
        return null;
    } catch (error) {
        console.error('❌ Error consultando Knowledge Base:', error);
        return null;
    }
}

async function mejorarRespuestaConDeepseek(respuestaKnowledge, query) {
    if (!deepseekApiKey) {
        console.log('⚠️ Deepseek API key no configurada, devolviendo respuesta original');
        return respuestaKnowledge || 'Lo siento, no tengo información específica sobre esa consulta.';
    }

    try {
        console.log('🤖 Mejorando respuesta con Deepseek...');
        
        const prompt = `Eres un asistente de AmericanStor, una tienda online de ropa y perfumes.
        
Usuario preguntó: "${query}"
Información encontrada: "${respuestaKnowledge || 'No se encontró información específica'}"

Responde de manera natural, amigable y comercial:
- Usa emojis apropiados
- Sé específico sobre los productos
- Incluye un call-to-action
- Mantén un tono profesional pero cercano
- Si no hay información específica, menciona que pueden contactar para más detalles

Responde en español, máximo 150 palabras:`;

        const response = await axios.post('https://api.deepseek.com/chat/completions', {
            model: "deepseek-chat",
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_tokens: 200,
            temperature: 0.7
        }, {
            headers: {
                'Authorization': `Bearer ${deepseekApiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        const respuestaMejorada = response.data.choices[0].message.content.trim();
        console.log('✅ Respuesta mejorada con Deepseek aplicada');
        return respuestaMejorada;

    } catch (error) {
        console.error('❌ Error con Deepseek:', error.message);
        return respuestaKnowledge || 'Gracias por tu consulta. Te invitamos a explorar nuestro catálogo de productos AmericanStor. ¿Hay algo específico que te interese? 😊';
    }
}

// 🎯 WEBHOOK PRINCIPAL - AQUÍ ES DONDE DIALOGFLOW ENVÍA LAS CONSULTAS
app.post('/webhook', async (req, res) => {
    console.log('🚀 REQUEST RECIBIDO EN WEBHOOK');
    console.log('📋 Body completo:', JSON.stringify(req.body, null, 2));

    try {
        const agent = new WebhookClient({ request: req, response: res });
        console.log('🎯 Intent detectado:', agent.intent);
        console.log('💭 Query del usuario:', agent.query);

        // ✅ FUNCIÓN PARA MANEJAR CONSULTAS GENERALES
        async function manejarConsultaGeneral() {
            console.log('🔄 Procesando consulta general...');
            
            try {
                // Consultar Knowledge Base
                const respuestaKB = await consultarKnowledgeBase(
                    agent.query, 
                    agent.session, 
                    agent.request.body.session?.split('/')[1] || 'default-project'
                );

                if (respuestaKB) {
                    console.log('📋 Respuesta de Knowledge Base:', respuestaKB.substring(0, 100) + '...');
                }

                // Mejorar con Deepseek
                const respuestaFinal = await mejorarRespuestaConDeepseek(respuestaKB, agent.query);
                
                console.log('📤 Enviando respuesta final:', respuestaFinal.substring(0, 100) + '...');
                agent.add(respuestaFinal);

            } catch (error) {
                console.error('❌ Error en consulta general:', error);
                agent.add('Disculpa, hay un problema técnico. Por favor, intenta de nuevo o contáctanos directamente. 😊');
            }
        }

        // 📋 MAP DE INTENTS - TODOS LOS INTENTS QUE PUEDEN USAR WEBHOOK
        const intentHandlers = new Map();
        
        // Intents específicos de AmericanStor
        intentHandlers.set('Perfumes_Consulta_General', manejarConsultaGeneral);
        intentHandlers.set('Ropa_Consulta_General', manejarConsultaGeneral);
        intentHandlers.set('Ropa_Tallas_Consulta', manejarConsultaGeneral);
        intentHandlers.set('Envios_Consulta', manejarConsultaGeneral);
        intentHandlers.set('Pagos_Consulta', manejarConsultaGeneral);
        
        // Intent por defecto
        intentHandlers.set('Default Welcome Intent', () => {
            agent.add('¡Hola! 👋 Bienvenido a AmericanStor. Somos tu tienda online de ropa y perfumes. ¿En qué puedo ayudarte hoy? 😊');
        });

        // Intents autogenerados por Knowledge Base
        const knowledgeIntents = [
            'Knowledge.KnowledgeBase.NDM3MjU0NTI2MzA0MzA4NDI4OQ',
            // Agrega aquí otros intents de Knowledge Base que veas en los logs
        ];
        
        knowledgeIntents.forEach(intent => {
            intentHandlers.set(intent, manejarConsultaGeneral);
        });

        // 🎯 EJECUTAR EL INTENT CORRESPONDIENTE
        if (intentHandlers.has(agent.intent)) {
            console.log('✅ Ejecutando handler para intent:', agent.intent);
            await intentHandlers.get(agent.intent)();
        } else {
            console.log('⚠️ Intent no reconocido:', agent.intent);
            await manejarConsultaGeneral(); // Usar handler general por defecto
        }

    } catch (error) {
        console.error('❌ Error crítico en webhook:', error);
        res.status(500).json({
            fulfillmentText: 'Disculpa, hay un problema técnico. Por favor, intenta más tarde o contáctanos directamente. 📞',
            source: 'AmericanStor Webhook'
        });
        return;
    }

    console.log('✅ Respuesta enviada exitosamente');
});

// 🚀 INICIAR SERVIDOR
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log('🎯 AmericanStor Webhook iniciado en puerto:', PORT);
    console.log('🔗 URL disponible:', `https://dialogflow-deepseek-webhook.onrender.com/webhook`);
    console.log('✅ Deepseek configurado:', deepseekApiKey ? '✓' : '✗');
    console.log('////////////////////////////////////////////////');
});

// 🔧 MANEJO DE ERRORES GLOBALES
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});
