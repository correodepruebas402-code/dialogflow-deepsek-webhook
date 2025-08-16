const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

// Health check para Render
app.get('/', (req, res) => {
    const status = {
        status: 'active',
        timestamp: new Date().toISOString(),
        service: 'Dialogflow Webhook',
        deepseek_configured: !!process.env.DEEPSEEK_API_KEY,
        version: '2.0'
    };
    res.json(status);
});

// Webhook mejorado para Dialogflow
app.post('/webhook', async (req, res) => {
    console.log('Request recibido:', JSON.stringify(req.body, null, 2));
    
    try {
        // Obtener el texto del usuario desde Dialogflow
        const userQuery = req.body.queryResult?.queryText || "No text provided";
        console.log('Query del usuario:', userQuery);

        // Verificar API Key
        if (!process.env.DEEPSEEK_API_KEY) {
            console.error('❌ DEEPSEEK_API_KEY no configurada');
            throw new Error('API Key not configured');
        }

        console.log('🔑 API Key configurada, haciendo llamada a DeepSeek...');

        // **CÓDIGO PRINCIPAL: Llamada a DeepSeek con fallback**
        let aiResponse;
        
        try {
            const deepseekResponse = await axios.post('https://api.deepseek.com/v1/chat/completions', {
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: "Responde en español de manera amigable y concisa." },
                    { role: "user", content: userQuery }
                ],
                max_tokens: 100,
                temperature: 0.7
            }, {
                headers: { 
                    'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 2500 // 2.5 segundos
            });

            console.log('✅ Respuesta de DeepSeek recibida');
            aiResponse = deepseekResponse.data.choices[0].message.content;
            console.log('💬 Respuesta AI:', aiResponse);
            
        } catch (deepseekError) {
            console.error('⚠️ DeepSeek falló, usando respuesta local:', deepseekError.message);
            
            // Respuestas inteligentes locales mientras arreglamos DeepSeek
            const responses = {
                'hola': '¡Hola! ¿Cómo estás? Soy tu asistente virtual. ¿En qué puedo ayudarte hoy?',
                'adios': '¡Hasta luego! Que tengas un excelente día.',
                'gracias': '¡De nada! Siempre es un placer ayudarte.',
                'como estas': '¡Estoy muy bien, gracias por preguntar! ¿Y tú cómo estás?',
                'que puedes hacer': 'Puedo ayudarte con información, resolver dudas, mantener conversaciones y mucho más. ¿Qué necesitas?'
            };
            
            const lowerQuery = userQuery.toLowerCase();
            aiResponse = responses[lowerQuery] || 
                        `Entiendo que me preguntas sobre "${userQuery}". Estoy aquí para ayudarte, aunque en este momento estoy funcionando en modo básico. ¿Puedes ser más específico sobre lo que necesitas?`;
        }

        // Formato correcto para Dialogflow V2
        const response = {
            fulfillmentText: aiResponse,
            fulfillmentMessages: [{
                text: {
                    text: [aiResponse]
                }
            }]
        };

        console.log('📤 Enviando respuesta a Dialogflow');
        return res.json(response);

    } catch (error) {
        console.error('❌ Error completo:', {
            message: error.message,
            code: error.code,
            response: error.response?.data,
            status: error.response?.status
        });
        
        // Respuesta de error amigable
        const errorResponse = {
            fulfillmentText: "Hola! Disculpa, tengo un pequeño problema técnico. ¿Puedes intentar de nuevo?",
            fulfillmentMessages: [{
                text: {
                    text: ["Hola! Disculpa, tengo un pequeño problema técnico. ¿Puedes intentar de nuevo?"]
                }
            }]
        };

        return res.status(200).json(errorResponse);
    }
});

// Keep-alive para evitar que el servicio se duerma (plan gratuito)
setInterval(() => {
    axios.get('https://dialogflow-deepsek-webhook.onrender.com')
        .then(() => console.log('Keep-alive ping exitoso'))
        .catch(() => console.log('Keep-alive ping falló'));
}, 840000); // Cada 14 minutos

app.listen(PORT, () => {
    console.log(`✅ Servidor activo en puerto ${PORT}`);
});

module.exports = app;

