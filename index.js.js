const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

app.post('/webhook', async (req, res) => {
  const userMessage = req.body.queryResult.queryText;

  try {
    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: userMessage }]
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const botReply = response.data.choices[0].message.content;
    res.json({ fulfillmentText: botReply });
  } catch (error) {
    console.error(error);
    res.json({ fulfillmentText: 'Ocurrió un error al procesar tu solicitud.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
