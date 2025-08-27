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

// Función para llamar a DeepSeek API
async function callDeepSeekAPI(messages, options = {}) {
    try {
        const response = await axios.post(DEEPSEEK_API_URL, {
            model: options.model || 'deepseek-chat',
            messages: messages,
            max_tokens: options.max_tokens || 2000,
            temperature: options.temperature || 0.7,
            stream: false,
            response_format: options.response_format || { type: 'text' }
        }, {
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data;
    } catch (error) {
        console.error('Error calling DeepSeek API:', error.response?.data || error.message);
        throw error;
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
                                    textToSpeech: assistantMessage,
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
                    timestamp: new Date().toISOString()
                }
            }
        };
        
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

// Función para configurar opciones según el intent
function getOptionsForIntent(intentName, parameters) {
    const options = {};
    
    switch (intentName) {
        case 'reasoning.task':
            options.model = 'deepseek-reasoner';
            options.temperature = 0.3;
            break;
        case 'creative.writing':
            options.temperature = 0.9;
            options.max_tokens = 3000;
            break;
        case 'json.response':
            options.response_format = { type: 'json_object' };
            options.temperature = 0.2;
            break;
        case 'technical.help':
            options.temperature = 0.1;
            options.max_tokens = 4000;
            break;
        default:
            options.temperature = 0.7;
            options.max_tokens = 2000;
    }
    
    return options;
}

// Endpoint para limpiar conversación
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
