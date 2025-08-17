// server.js
const express = require('express');
const { WebhookClient } = require('dialogflow-fulfillment');
const axios = require('axios');
const cors = require('cors');
const functions = require('firebase-functions'); // para leer funciones.config() en deploy
require('dotenv').config();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Busca la API key: .env (local) o firebase functions config (deploy)
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || (functions.config && functions.config().deepseek && functions.config().deepseek.key) || '';

process.env.DEBUG = process.env.DEBUG || 'dialogflow:debug';

// Ruta principal: Dialogflow envía POST aquí
app.post('/', async (req, res) => {
  const agent = new WebhookClient({ request: req, response: res });

  // Handlers básicos
  function welcome(agent) {
    agent.add("¡Bienvenido a American Store! ¿Quieres conocer nuestras ofertas o productos?");
  }

  function fallback(agent) {
    agent.add("No entendí bien lo que dijiste. ¿Puedes repetirlo?");
  }

  function ofertas(agent) {
    agent.add("Actualmente tenemos 20% de descuento en ropa para hombre y envío gratis en todas las compras.");
  }

  function contacto(agent) {
    agent.add("Puedes contactarnos vía WhatsApp al 3117112995 o por correo: administrador@americanstor.online");
  }

  // Handler que llama a DeepSeek
  async function deepSeekIntent(agent) {
    const userQuery = agent.query || (req.body && req.body.queryResult && req.body.queryResult.queryText) || '';

    if (!DEEPSEEK_KEY) {
      agent.add("Falta la clave de DeepSeek en la configuración del servidor.");
      return;
    }

    try {
      const payload = {
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "Eres un asistente de ventas para American Store. Usa la base de conocimiento para responder preguntas sobre productos, ofertas y políticas." },
          { role: "user", content: userQuery }
        ],
        temperature: 0.7
      };

      const dsRes = await axios.post(
        "https://api.deepseek.com/v1/chat/completions",
        payload,
        {
          headers: {
            "Authorization": `Bearer ${DEEPSEEK_KEY}`,
            "Content-Type": "application/json"
          },
          timeout: 15000
        }
      );

      // lectura segura de la respuesta (según formato esperado)
      const reply =
        dsRes.data?.choices?.[0]?.message?.content ||
        dsRes.data?.choices?.[0]?.text ||
        "Lo siento, no obtuve una respuesta clara.";

      agent.add(reply);
    } catch (err) {
      console.error("Error DeepSeek:", err?.response?.data || err.message || err);
      agent.add("Lo siento, hubo un error consultando la información. Intenta de nuevo más tarde.");
    }
  }

  // Mapear intents (usa exactamente los nombres de Intent en Dialogflow)
  const intentMap = new Map();
  intentMap.set("Default Welcome Intent", welcome);
  intentMap.set("Default Fallback Intent", fallback);
  intentMap.set("DeepSeek Intent", deepSeekIntent);     // crea este intent en Dialogflow
  intentMap.set("Ofertas Intent", ofertas);
  intentMap.set("Contacto Intent", contacto);

  agent.handleRequest(intentMap);
});

module.exports = app;
