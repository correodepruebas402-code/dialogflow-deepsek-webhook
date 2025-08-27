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
        const { queryText, sessionId, parameters, intentDisplayName } = req.body;
        const userId = sessionId || 'anonymous';
        
        // Obtener historial de conversación
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
        
        // Respuesta para Dialogflow
        const fulfillmentResponse = {
            fulfillmentText: assistantMessage,
            fulfillmentMessages: [
                {
                    text: {
                        text: [assistantMessage]
                    }
                }
            ],
            payload: {
                deepseek: {
                    model: deepseekResponse.model,
                    usage: deepseekResponse.usage,
                    reasoning: deepseekResponse.choices[0].message.reasoning_content
                }
            }
        };
        
        res.json(fulfillmentResponse);
        
    } catch (error) {
        console.error('Webhook error:', error);
        res.json({
            fulfillmentText: 'Lo siento, hubo un error al procesar tu solicitud. Por favor intenta nuevamente.',
            fulfillmentMessages: [
                {
                    text: {
                        text: ['Lo siento, hubo un error al procesar tu solicitud. Por favor intenta nuevamente.']
                    }
                }
            ]
        });
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

// Endpoint de salud
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
