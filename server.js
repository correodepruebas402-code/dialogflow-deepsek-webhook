const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Configuración
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

console.log('🚀 Server starting...');
console.log('🔑 API Key configured:', !!DEEPSEEK_API_KEY);

// Personalidad y contexto del agente
const SYSTEM_PROMPT = `Eres un asistente virtual experto para una tienda de perfumes y ropa online. Tu personalidad es:

CARACTERÍSTICAS:
- Amigable, profesional y conocedor de productos
- Especialista en perfumes (originales, réplicas, durabilidad, notas olfativas)
- Experto en ropa (tallas, disponibilidad, estilos)
- Vendes tanto productos originales como réplicas de alta calidad
- Siempre mencionas métodos de pago, envíos y garantías
- Promueves activamente las ventas de manera natural

INSTRUCCIONES:
1. Saluda cordialmente y pregunta en qué puedes ayudar
2. Para perfumes: recomienda según preferencias, ocasión, durabilidad
3. Para ropa: consulta tallas, colores, estilos disponibles
4. Siempre menciona precios, formas de pago y tiempos de envío
5. Ofrece promociones y descuentos cuando sea apropiado
6. Responde de manera concisa pero completa
7. Si no tienes información específica, ofrece ayuda para consultar disponibilidad

PRODUCTOS PRINCIPALES:
- Perfumes originales y réplicas de marcas premium
- Ropa casual y elegante para hombres y mujeres
- Accesorios y productos de cuidado personal

Responde siempre en español y mantén un tono conversacional y vendedor.`;

// Función mejorada para llamar a DeepSeek
async function callDeepSeek(userMessage, sessionId = 'default') {
    try {
        console.log('📞 Making request to DeepSeek API...');
        console.log('💬 User message:', userMessage);
        
        // Configuración mejorada de la petición
        const requestData = {
            model: 'deepseek-chat',
            messages: [
                {
                    role: 'system',
                    content: SYSTEM_PROMPT
                },
                {
                    role: 'user',
                    content: userMessage
                }
            ],
            max_tokens: 1500,
            temperature: 0.8,
            top_p: 0.95,
            stream: false
        };

        console.log('📋 Request data:', JSON.stringify(requestData, null, 2));

        const response = await axios.post(DEEPSEEK_API_URL, requestData, {
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 30000, // Aumentado a 30 segundos
            validateStatus: function (status) {
                return status >= 200 && status < 500; // No rechazar en 4xx
            }
        });

        console.log('✅ DeepSeek response status:', response.status);
        console.log('📄 Response data:', JSON.stringify(response.data, null, 2));

        // Verificar si la respuesta es exitosa
        if (response.status !== 200) {
            throw new Error(`API returned status ${response.status}: ${JSON.stringify(response.data)}`);
        }

        // Extraer la respuesta
        if (response.data && response.data.choices && response.data.choices.length > 0) {
            const aiResponse = response.data.choices[0].message.content;
            console.log('🤖 AI Response:', aiResponse);
            return aiResponse;
        } else {
            throw new Error('Invalid response format from DeepSeek API');
        }
        
    } catch (error) {
        console.error('❌ DeepSeek error:', error.message);
        console.error('🔍 Error details:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            headers: error.response?.headers,
            code: error.code,
            timeout: error.code === 'ECONNABORTED'
        });
        
        // Respuestas de fallback más específicas
        if (error.response?.status === 401) {
            return "🔑 Error de autenticación con el servicio de IA. Por favor, contacta al administrador.";
        }
        if (error.response?.status === 429) {
            return "⏰ El servicio está sobrecargado. Por favor, espera unos segundos e intenta nuevamente.";
        }
        if (error.response?.status === 403) {
            return "🚫 Acceso denegado al servicio de IA. Contacta al soporte técnico.";
        }
        if (error.code === 'ECONNABORTED') {
            return "⏱️ La consulta está tomando mucho tiempo. ¿Podrías reformular tu pregunta de manera más simple?";
        }
        if (error.response?.status >= 500) {
            return "🛠️ El servicio de IA está temporalmente fuera de servicio. Intenta en unos minutos.";
        }
        
        return "🤖 Hola! Soy tu asistente de la tienda. Aunque tengo un pequeño problema técnico ahora, puedo ayudarte con información sobre nuestros perfumes y ropa. ¿En qué estás interesado?";
    }
}

// Función para extraer información de Dialogflow
function extractQueryFromDialogflow(reqBody) {
    console.log('📥 Processing Dialogflow request...');
    
    let queryText = '';
    let sessionId = '';
    let intentName = '';
    let parameters = {};
    
    try {
        // Extraer información del payload
        if (reqBody.queryResult) {
            queryText = reqBody.queryResult.queryText || '';
            intentName = reqBody.queryResult.intent?.displayName || '';
            parameters = reqBody.queryResult.parameters || {};
        }
        
        if (reqBody.session) {
            sessionId = reqBody.session.split('/').pop() || 'default';
        }
        
        // Si no hay texto, usar texto por defecto
        if (!queryText) {
            queryText = "Hola, ¿en qué puedo ayudarte?";
        }
        
        console.log('📊 Extracted data:', {
            queryText,
            sessionId,
            intentName,
            parameters
        });
        
        return { queryText, sessionId, intentName, parameters };
        
    } catch (error) {
        console.error('❌ Error extracting Dialogflow data:', error);
        return { 
            queryText: "Hola, ¿en qué puedo ayudarte?", 
            sessionId: 'default', 
            intentName: '', 
            parameters: {} 
        };
    }
}

// Webhook principal de Dialogflow (mejorado)
app.post('/webhook', async (req, res) => {
    try {
        console.log('🎯 Webhook called');
        console.log('📨 Full request body:', JSON.stringify(req.body, null, 2));
        
        // Extraer información de Dialogflow
        const { queryText, sessionId, intentName, parameters } = extractQueryFromDialogflow(req.body);
        
        console.log('🔍 Processing:', {
            query: queryText,
            session: sessionId,
            intent: intentName
        });
        
        // Crear contexto adicional para la IA
        let contextualQuery = queryText;
        if (intentName) {
            contextualQuery = `Intent: ${intentName}. Usuario pregunta: ${queryText}`;
        }
        
        // Llamar a DeepSeek
        const aiResponse = await callDeepSeek(contextualQuery, sessionId);
        
        // Respuesta para Dialogflow (formato actualizado)
        const dialogflowResponse = {
            fulfillmentText: aiResponse,
            fulfillmentMessages: [
                {
                    text: {
                        text: [aiResponse]
                    }
                }
            ],
            source: 'deepseek-webhook'
        };
        
        console.log('📤 Sending response to Dialogflow');
        console.log('📋 Response:', JSON.stringify(dialogflowResponse, null, 2));
        
        res.status(200).json(dialogflowResponse);
        
    } catch (error) {
        console.error('❌ Webhook error:', error);
        
        const errorResponse = {
            fulfillmentText: "Hola! Soy tu asistente de la tienda. Temporalmente tengo un problema técnico, pero estoy aquí para ayudarte con nuestros productos. ¿Qué te interesa?",
            fulfillmentMessages: [
                {
                    text: {
                        text: ["Hola! Soy tu asistente de la tienda. Temporalmente tengo un problema técnico, pero estoy aquí para ayudarte con nuestros productos. ¿Qué te interesa?"]
                    }
                }
            ],
            source: 'deepseek-webhook-error'
        };
        
        res.status(200).json(errorResponse);
    }
});

// Endpoint de prueba mejorado
app.get('/test', async (req, res) => {
    try {
        console.log('🧪 Test endpoint called');
        
        const testMessage = req.query.message || "Hola, quiero información sobre perfumes";
        const testResponse = await callDeepSeek(testMessage);
        
        res.json({ 
            status: '✅ success', 
            query: testMessage,
            response: testResponse,
            timestamp: new Date().toISOString(),
            apiKey: !!DEEPSEEK_API_KEY ? '✅ Configured' : '❌ Missing'
        });
    } catch (error) {
        console.error('❌ Test error:', error);
        res.status(500).json({ 
            status: '❌ error', 
            error: error.message,
            timestamp: new Date().toISOString(),
            apiKey: !!DEEPSEEK_API_KEY ? '✅ Configured' : '❌ Missing'
        });
    }
});

// Health check mejorado
app.get('/health', (req, res) => {
    const health = {
        status: '✅ OK',
        timestamp: new Date().toISOString(),
        apiKey: !!DEEPSEEK_API_KEY ? '✅ Configured' : '❌ Missing',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        memory: process.memoryUsage()
    };
    
    console.log('🏥 Health check:', health);
    res.json(health);
});

// Endpoint para probar Dialogflow payload
app.post('/test-dialogflow', async (req, res) => {
    try {
        console.log('🎯 Testing with Dialogflow format');
        
        const mockDialogflowPayload = {
            queryResult: {
                queryText: req.body.message || "Hola, quiero ver perfumes",
                intent: {
                    displayName: "Test_Intent"
                }
            },
            session: "projects/test/sessions/test-session"
        };
        
        console.log('📨 Mock payload:', JSON.stringify(mockDialogflowPayload, null, 2));
        
        // Simular el procesamiento del webhook
        const { queryText, sessionId } = extractQueryFromDialogflow(mockDialogflowPayload);
        const response = await callDeepSeek(queryText, sessionId);
        
        res.json({
            status: '✅ success',
            originalMessage: req.body.message,
            extractedQuery: queryText,
            sessionId: sessionId,
            aiResponse: response,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        res.status(500).json({
            status: '❌ error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Middleware de manejo de errores
app.use((error, req, res, next) => {
    console.error('❌ Unhandled error:', error);
    res.status(500).json({
        status: 'error',
        message: 'Internal server error',
        timestamp: new Date().toISOString()
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔗 Webhook URL: https://your-app.onrender.com/webhook`);
    console.log(`🧪 Test URL: https://your-app.onrender.com/test`);
    console.log(`🏥 Health check: https://your-app.onrender.com/health`);
    console.log(`🎯 Dialogflow test: https://your-app.onrender.com/test-dialogflow`);
});

module.exports = app;

