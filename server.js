const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Configuración de DeepSeek API
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Memoria de conversaciones (en producción usar una base de datos)
const conversations = new Map();

// Función para llamar a DeepSeek API con timeout optimizado
async function callDeepSeekAPI(messages, options = {}) {
    try {
        const requestConfig = {
            model: options.model || 'deepseek-chat',
            messages: messages,
            max_tokens: Math.min(options.max_tokens || 1500, 1500), // Limitar tokens para rapidez
            temperature: options.temperature || 0.7,
            stream: false,
            response_format: options.response_format || { type: 'text' }
        };

        console.log(`Calling DeepSeek API with model: ${requestConfig.model}`);
        console.log('Request config:', JSON.stringify(requestConfig, null, 2));
        console.log('API Key present:', !!DEEPSEEK_API_KEY);
        console.log('API Key length:', DEEPSEEK_API_KEY ? DEEPSEEK_API_KEY.length : 'undefined');
        
        const response = await axios.post(DEEPSEEK_API_URL, requestConfig, {
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json',
                'User-Agent': 'dialogflow-deepseek-integration/1.0'
            },
            timeout: 4000, // Timeout de 4 segundos para dejar margen a Dialogflow
            validateStatus: function (status) {
                return status >= 200 && status < 500; // No rechazar para códigos de error HTTP
            }
        });

        console.log(`DeepSeek API response status: ${response.status}`);
        console.log(`DeepSeek API response headers:`, response.headers);
        
        if (response.status !== 200) {
            console.error('DeepSeek API error response:', response.status, response.data);
            throw new Error(`DeepSeek API returned status ${response.status}: ${JSON.stringify(response.data)}`);
        }
        
        console.log(`DeepSeek API response received, tokens: ${response.data.usage?.total_tokens}`);
        return response.data;
        
    } catch (error) {
        console.error('Error calling DeepSeek API:');
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error response status:', error.response?.status);
        console.error('Error response data:', error.response?.data);
        console.error('Full error:', error);
        
        if (error.code === 'ECONNABORTED') {
            console.log('Request timed out, using fallback response');
            // Respuesta de fallback para timeouts
            return {
                choices: [{
                    message: {
                        content: "Disculpa, la consulta está tomando más tiempo del esperado. ¿Podrías reformular tu pregunta de manera más específica?",
                        role: "assistant"
                    }
                }],
                model: requestConfig.model,
                usage: { total_tokens: 0, prompt_tokens: 0, completion_tokens: 0 }
            };
        }
        
        if (error.response?.status === 401) {
            console.error('API Key authentication failed');
            return {
                choices: [{
                    message: {
                        content: "Error de autenticación. Por favor verifica la configuración del servidor.",
                        role: "assistant"
                    }
                }],
                model: requestConfig.model,
                usage: { total_tokens: 0, prompt_tokens: 0, completion_tokens: 0 }
            };
        }
        
        if (error.response?.status === 429) {
            console.error('Rate limit exceeded');
            return {
                choices: [{
                    message: {
                        content: "El servicio está temporalmente ocupado. Por favor intenta en unos momentos.",
                        role: "assistant"
                    }
                }],
                model: requestConfig.model,
                usage: { total_tokens: 0, prompt_tokens: 0, completion_tokens: 0 }
            };
        }
        
        // Respuesta de fallback para cualquier otro error
        return {
            choices: [{
                message: {
                    content: "Disculpa, hubo un problema técnico temporal. ¿Podrías intentar nuevamente?",
                    role: "assistant"
                }
            }],
            model: requestConfig.model,
            usage: { total_tokens: 0, prompt_tokens: 0, completion_tokens: 0 }
        };
    }
}

// Endpoint para webhook de Dialogflow
app.post('/webhook', async (req, res) => {
    try {
        // Log del payload completo para debugging
        console.log('Dialogflow payload:', JSON.stringify(req.body, null, 2));
        
        // Extraer datos del formato de Dialogflow
        const queryResult = req.body.queryResult || req.body;
        const queryText = queryResult.queryText || queryResult.query || req.body.queryText;
        const sessionId = req.body.session || req.body.sessionId || 'anonymous';
        const parameters = queryResult.parameters || req.body.parameters || {};
        const intentDisplayName = queryResult.intent?.displayName || req.body.intentDisplayName || 'default.intent';
        
        // Extraer sessionId del formato completo de Dialogflow
        const sessionPath = req.body.session || '';
        const userId = sessionPath.split('/').pop() || sessionId;
        // Validar que tenemos el texto de la consulta
        if (!queryText) {
            console.log('No query text found in request');
            return res.json({
                fulfillmentText: 'No pude entender tu mensaje. ¿Podrías repetirlo?',
                fulfillmentMessages: [{
                    text: { text: ['No pude entender tu mensaje. ¿Podrías repetirlo?'] }
                }]
            });
        }
        if (!conversations.has(userId)) {
            conversations.set(userId, [
                {
                    role: 'system',
                    content: 'Eres un asistente útil y amigable. Responde de manera clara y concisa.'
                }
            ]);
        }
        
        const conversationHistory = conversations.get(userId);
        
        // Agregar mensaje del usuario
        conversationHistory.push({
            role: 'user',
            content: queryText
        });
        
        // Configurar opciones basadas en el intent
        const options = getOptionsForIntent(intentDisplayName, parameters);
        
        // Llamar a DeepSeek
        const deepseekResponse = await callDeepSeekAPI(conversationHistory, options);
        const assistantMessage = deepseekResponse.choices[0].message.content;
        
        // Agregar respuesta al historial
        conversationHistory.push({
            role: 'assistant',
            content: assistantMessage
        });
        
        // Mantener solo las últimas 10 interacciones para evitar exceder límites
        if (conversationHistory.length > 21) { // 1 system + 20 mensajes
            conversationHistory.splice(1, 2); // Remover el par más antiguo user/assistant
        }
        
        // Respuesta para Dialogflow (formato compatible con ES y CX)
        const fulfillmentResponse = {
            fulfillmentText: assistantMessage,
            fulfillmentMessages: [
                {
                    text: {
                        text: [assistantMessage]
                    }
                }
            ],
            source: 'deepseek-webhook',
            payload: {
                google: {
                    expectUserResponse: true,
                    richResponse: {
                        items: [
                            {
                                simpleResponse: {
                                    textToSpeech: assistantMessage.length > 640 ? 
                                        assistantMessage.substring(0, 637) + "..." : assistantMessage,
                                    displayText: assistantMessage
                                }
                            }
                        ]
                    }
                },
                deepseek: {
                    model: deepseekResponse.model,
                    usage: deepseekResponse.usage,
                    reasoning: deepseekResponse.choices[0].message.reasoning_content || null,
                    sessionId: userId,
                    processingTime: processingTime,
                    timestamp: new Date().toISOString()
                }
            }
        };
        
        console.log(`Sending response: ${assistantMessage.substring(0, 100)}...`);
        res.json(fulfillmentResponse);
        
    } catch (error) {
        console.error('Webhook error:', error.message);
        console.error('Error stack:', error.stack);
        console.error('Request body:', JSON.stringify(req.body, null, 2));
        
        const errorResponse = {
            fulfillmentText: 'Lo siento, hubo un problema técnico. Por favor intenta nuevamente.',
            fulfillmentMessages: [
                {
                    text: {
                        text: ['Lo siento, hubo un problema técnico. Por favor intenta nuevamente.']
                    }
                }
            ],
            source: 'deepseek-webhook',
            payload: {
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
                timestamp: new Date().toISOString()
            }
        };
        
        res.json(errorResponse);
    }
});

// Función para configurar opciones según el intent (optimizada para velocidad)
function getOptionsForIntent(intentName, parameters) {
    const options = {};
    
    switch (intentName) {
        case 'reasoning.task':
            // Usar deepseek-chat en lugar de reasoner para evitar timeouts
            options.model = 'deepseek-chat';
            options.temperature = 0.3;
            options.max_tokens = 1200;
            break;
        case 'creative.writing':
            options.temperature = 0.8;
            options.max_tokens = 1000;
            break;
        case 'json.response':
            options.response_format = { type: 'json_object' };
            options.temperature = 0.2;
            options.max_tokens = 800;
            break;
        case 'technical.help':
            options.temperature = 0.1;
            options.max_tokens = 1200;
            break;
        default:
            options.temperature = 0.7;
            options.max_tokens = 1000;
    }
    
    console.log(`Intent: ${intentName}, Options:`, options);
    return options;
}

// Endpoint especial para consultas que requieren razonamiento profundo
app.post('/webhook-reasoning', async (req, res) => {
    try {
        // Extraer datos del formato de Dialogflow (mismo código que webhook principal)
        const queryResult = req.body.queryResult || req.body;
        const queryText = queryResult.queryText || queryResult.query || req.body.queryText;
        const sessionId = req.body.session || req.body.sessionId || 'anonymous';
        const sessionPath = req.body.session || '';
        const userId = sessionPath.split('/').pop() || sessionId;
        
        console.log(`Reasoning webhook - Query: "${queryText}" from user: ${userId}`);
        
        if (!queryText) {
            return res.json({
                fulfillmentText: 'No pude entender tu consulta para análisis.',
                fulfillmentMessages: [{
                    text: { text: ['No pude entender tu consulta para análisis.'] }
                }]
            });
        }

        // Respuesta inmediata para evitar timeout
        const immediateResponse = {
            fulfillmentText: 'Estoy analizando tu consulta detalladamente. Un momento por favor...',
            fulfillmentMessages: [{
                text: { text: ['Estoy analizando tu consulta detalladamente. Un momento por favor...'] }
            }],
            source: 'deepseek-reasoning-webhook'
        };
        
        res.json(immediateResponse);
        
        // Procesar con deepseek-reasoner en background (opcional: guardar resultado para consulta posterior)
        setTimeout(async () => {
            try {
                const conversationHistory = [
                    {
                        role: 'system',
                        content: 'Eres un asistente experto en razonamiento lógico. Analiza la consulta paso a paso y proporciona una respuesta detallada y bien fundamentada.'
                    },
                    {
                        role: 'user',
                        content: queryText
                    }
                ];
                
                const reasoningResponse = await axios.post(DEEPSEEK_API_URL, {
                    model: 'deepseek-reasoner',
                    messages: conversationHistory,
                    max_tokens: 3000,
                    temperature: 0.2
                }, {
                    headers: {
                        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 15000 // Mayor timeout para razonamiento
                });
                
                console.log(`Reasoning completed for user ${userId}:`, reasoningResponse.data.choices[0].message.content.substring(0, 100));
                // Aquí podrías guardar el resultado en una base de datos o notificar al usuario
                
            } catch (error) {
                console.error('Background reasoning error:', error.message);
            }
        }, 100);
        
    } catch (error) {
        console.error('Reasoning webhook error:', error);
        res.json({
            fulfillmentText: 'Hubo un error al iniciar el análisis.',
            fulfillmentMessages: [{
                text: { text: ['Hubo un error al iniciar el análisis.'] }
            }]
        });
    }
});
app.post('/clear-conversation', (req, res) => {
    const { sessionId } = req.body;
    if (sessionId && conversations.has(sessionId)) {
        conversations.delete(sessionId);
        res.json({ message: 'Conversación eliminada' });
    } else {
        res.status(404).json({ message: 'Sesión no encontrada' });
    }
});

// Endpoint de prueba para simular Dialogflow
app.post('/test-webhook', (req, res) => {
    const testPayload = {
        queryResult: {
            queryText: "Hola, ¿cómo estás?",
            parameters: {},
            intent: {
                displayName: "Default Welcome Intent"
            }
        },
        session: "projects/test-project/agent/sessions/test-session-123"
    };
    
    // Reenviar al webhook principal
    req.body = testPayload;
    app._router.handle({ ...req, url: '/webhook', method: 'POST' }, res, () => {});
});

// Endpoint para debugging - mostrar estructura del request
app.post('/debug-payload', (req, res) => {
    console.log('=== DEBUG PAYLOAD ===');
    console.log('Headers:', req.headers);
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('===================');
    
    res.json({
        message: 'Payload logged to console',
        receivedBody: req.body,
        timestamp: new Date().toISOString()
    });
});
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        conversations: conversations.size
    });
});

// Endpoint para streaming (opcional)
app.post('/stream', async (req, res) => {
    try {
        const { messages, options } = req.body;
        
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        const streamResponse = await axios.post(DEEPSEEK_API_URL, {
            model: options?.model || 'deepseek-chat',
            messages: messages,
            stream: true,
            max_tokens: options?.max_tokens || 2000,
            temperature: options?.temperature || 0.7
        }, {
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            },
            responseType: 'stream'
        });
        
        streamResponse.data.on('data', (chunk) => {
            const lines = chunk.toString().split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ') && !line.includes('[DONE]')) {
                    res.write(line + '\n\n');
                }
            }
        });
        
        streamResponse.data.on('end', () => {
            res.write('data: [DONE]\n\n');
            res.end();
        });
        
    } catch (error) {
        console.error('Streaming error:', error);
        res.status(500).json({ error: 'Error en streaming' });
    }
});

// Manejo de errores global
app.use((err, req, res, next) => {
    console.error('Error global:', err);
    res.status(500).json({ 
        error: 'Error interno del servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Error interno'
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
    console.log(`📋 Webhook URL: https://tu-app.render.com/webhook`);
    console.log(`🔗 Health check: https://tu-app.render.com/health`);
});

module.exports = app;
