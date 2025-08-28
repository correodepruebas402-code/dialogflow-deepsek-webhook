const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Configuración
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

console.log('Server starting...');
console.log('API Key configured:', !!DEEPSEEK_API_KEY);

// Función simple para llamar a DeepSeek
async function callDeepSeek(userMessage) {
    try {
        console.log('Making request to DeepSeek...');
        
        const response = await axios.post(DEEPSEEK_API_URL, {
            model: 'deepseek-chat',
            messages: [
                {
                    role: 'user',
                    content: userMessage
                }
            ],
            max_tokens: 1000,
            temperature: 0.7
        }, {
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 4000
        });

        console.log('DeepSeek response received');
        return response.data.choices[0].message.content;
        
    } catch (error) {
        console.error('DeepSeek error:', error.message);
        console.error('Error details:', error.response?.data);
        
        // Respuestas de fallback según el tipo de error
        if (error.response?.status === 401) {
            return "Error de configuración del servicio. Contacta al administrador.";
        }
        if (error.response?.status === 429) {
            return "El servicio está ocupado. Intenta en unos momentos.";
        }
        if (error.code === 'ECONNABORTED') {
            return "La consulta está tomando mucho tiempo. Intenta con una pregunta más simple.";
        }
        
        return "Hubo un problema técnico. ¿Podrías intentar nuevamente?";
    }
}

// Webhook principal de Dialogflow
app.post('/webhook', async (req, res) => {
    try {
        console.log('Webhook called');
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        
        // Extraer el texto de la consulta del payload de Dialogflow
        let queryText = '';
        
        if (req.body.queryResult && req.body.queryResult.queryText) {
            queryText = req.body.queryResult.queryText;
        } else if (req.body.queryText) {
            queryText = req.body.queryText;
        } else {
            queryText = "Hola";
        }
        
        console.log('Query text:', queryText);
        
        // Llamar a DeepSeek
        const response = await callDeepSeek(queryText);
        
        // Respuesta para Dialogflow
        const dialogflowResponse = {
            fulfillmentText: response,
            fulfillmentMessages: [
                {
                    text: {
                        text: [response]
                    }
                }
            ]
        };
        
        console.log('Sending response to Dialogflow');
        res.json(dialogflowResponse);
        
    } catch (error) {
        console.error('Webhook error:', error.message);
        
        const errorResponse = {
            fulfillmentText: "Lo siento, hubo un error. Intenta nuevamente.",
            fulfillmentMessages: [
                {
                    text: {
                        text: ["Lo siento, hubo un error. Intenta nuevamente."]
                    }
                }
            ]
        };
        
        res.json(errorResponse);
    }
});

// Test endpoint
app.get('/test', async (req, res) => {
    try {
        const testResponse = await callDeepSeek("Responde solo: Test exitoso");
        res.json({ 
            status: 'success', 
            response: testResponse,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'error', 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        apiKeyConfigured: !!DEEPSEEK_API_KEY
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Webhook URL: https://your-app.onrender.com/webhook`);
});

module.exports = app;

