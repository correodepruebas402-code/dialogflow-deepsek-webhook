const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

// Health check para Render
app.get('/', (req, res) => {
    res.status(200).send('Webhook activo! Usa POST /webhook para DialogFlow');
});

// Webhook mejorado para Dialogflow
app.post('/webhook', async (req, res) => {
    console.log('Request recibido:', JSON.stringify(req.body, null, 2));
    
    try {
        // Obtener el texto del usuario desde Dialogflow
        const userQuery = req.body.queryResult?.queryText || "No text provided";
        
        console.log('Query del usuario:', userQuery);

        // **CÓDIGO PRINCIPAL: Llamada a DeepSeek**
        const deepseekResponse = await axios.post('https://api.deepseek.com/v1/chat/completions', {
            model: "deepseek-chat",
            messages: [{ role: "user", content: userQuery }],
            max_tokens: 150
        }, {
            headers: { 
                'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 4000 // 4 segundos para evitar timeout de Dialogflow
        });

        // Extraer la respuesta de DeepSeek
        const aiResponse = deepseekResponse.data.choices[0].message.content;

        // Formato correcto para Dialogflow V2
        const response = {
            fulfillmentText: aiResponse,
            fulfillmentMessages: [{
                text: {
                    text: [aiResponse]
                }
            }]
        };

        console.log('Enviando respuesta:', response);
        return res.json(response);

    } catch (error) {
        console.error('Error:', error.message);
        
        // Respuesta de error amigable
        const errorResponse = {
            fulfillmentText: "Disculpa, estoy teniendo problemas técnicos. Intenta nuevamente en un momento.",
            fulfillmentMessages: [{
                text: {
                    text: ["Disculpa, estoy teniendo problemas técnicos. Intenta nuevamente en un momento."]
                }
            }]
        };

        return res.status(200).json(errorResponse); // Siempre 200 para Dialogflow
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
