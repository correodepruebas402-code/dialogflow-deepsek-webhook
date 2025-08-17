// server.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

app.post('/webhook', async (req, res) => {
    try {
        const queryText = req.body.queryResult.queryText;

        // Petición a DeepSeek (o cualquier IA)
        const response = await axios.post(
            'https://api.deepseek.com/v1/chat/completions',
            {
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: "Eres un asistente experto en perfumes y fragancias." },
                    { role: "user", content: queryText }
                ]
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const fulfillmentText = response.data.choices[0].message.content;

        res.json({
            fulfillmentText
        });

    } catch (error) {
        console.error('Error en el webhook:', error);
        res.json({ fulfillmentText: "Lo siento, ocurrió un error procesando tu solicitud." });
    }
});

app.listen(3000, () => {
    console.log('Servidor escuchando en http://localhost:3000');
});

