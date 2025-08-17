'use strict';

// Importar las librerías necesarias
const express = require('express');
const axios = require('axios');
const { WebhookClient } = require('dialogflow-fulfillment');
require('dotenv').config(); // Carga las variables de entorno desde el archivo .env

// Crear la aplicación de Express
const app = express();
app.use(express.json()); // Middleware para parsear el cuerpo de las solicitudes como JSON

// Obtener la clave de API desde las variables de entorno
const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
const deepseekApiUrl = 'https://api.deepseek.com/v1/chat/completions'; // URL de la API de Deepseek

// Endpoint principal para el webhook de Dialogflow
app.post('/webhook', (request, response) => {
  const agent = new WebhookClient({ request, response });

  // Función para manejar la lógica de la conversación con Deepseek
  async function handleDeepseekQuery(agent) {
    const userQuery = agent.query; // La pregunta del usuario
    console.log(`Consulta del usuario: ${userQuery}`);

    // Aquí puedes agregar el contexto de tu tienda (del PDF)
    const knowledgeBaseContext = `
      Eres un asistente virtual para una tienda. Utiliza la siguiente información para responder:
      

      ---
      Ahora, responde a la siguiente pregunta del cliente de la manera más útil posible.
    `;

    try {
      // Llamada a la API de Deepseek
      const apiResponse = await axios.post(deepseekApiUrl, {
        model: 'deepseek-chat', // O el modelo que prefieras
        messages: [
          { "role": "system", "content": knowledgeBaseContext },
          { "role": "user", "content": userQuery }
        ]
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${deepseekApiKey}`
        }
      });

      // Extraer la respuesta del modelo
      const botResponse = apiResponse.data.choices[0].message.content;

      // Enviar la respuesta a Dialogflow
      agent.add(botResponse);

    } catch (error) {
      console.error('Error al llamar a la API de Deepseek:', error.response ? error.response.data : error.message);
      agent.add('Lo siento, algo salió mal y no puedo procesar tu solicitud en este momento.');
    }
  }

  // Mapeo de intents a funciones
  let intentMap = new Map();
  // Este intent se activará para todas las consultas que no coincidan con otros intents definidos en Dialogflow.
  // Asegúrate de que el "Default Fallback Intent" en Dialogflow tenga el webhook habilitado.
  intentMap.set('Default Fallback Intent', handleDeepseekQuery);

  agent.handleRequest(intentMap);
});

// Iniciar el servidor
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}`);
});



