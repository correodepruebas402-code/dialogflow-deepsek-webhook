'use strict';

/**
 * server.js
 * - Maneja webhook de Dialogflow
 * - Reenvía consultas a DeepSeek
 * - Exporta la función Firebase: exports.dialogflowWebhook
 *
 * Funcionamiento:
 * - Local: node server.js     -> arranca servidor Express en PORT (3000 por defecto)
 * - Firebase: al desplegar, Firebase invoca exports.dialogflowWebhook
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { WebhookClient } = require('dialogflow-fulfillment');
const functions = require('firebase-functions');
require('dotenv').config();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '128kb' }));

// Leer API key: prioridad .env (desarrollo) -> firebase functions config (producción)
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY ||
  (functions.config && functions.config().deepseek && functions.config().deepseek.key) ||
  '';

process.env.DEBUG = process.env.DEBUG || 'dialogflow:debug';

/* ---------------- Handlers de Intents ---------------- */

function welcome(agent) {
  agent.add('¡Bienvenido a American Store! ¿Quieres conocer nuestras ofertas o productos?');
}

function fallback(agent) {
  agent.add('Lo siento, no entendí eso. ¿Puedes reformular por favor?');
}

function ofertas(agent) {
  agent.add('Actualmente tenemos 20% de descuento en ropa para hombre y envío gratis en todas las compras.');
}

function contacto(agent) {
  agent.add('Puedes contactarnos vía WhatsApp al 3117112995 o por correo: administrador@americanstor.online');
}

/* Intent que consulta DeepSeek */
async function deepSeekIntent(agent) {
  const userQuery = agent.query || (agent.request_ && agent.request_.body && agent.request_.body.queryResult && agent.request_.body.queryResult.queryText) || '';

  if (!DEEPSEEK_KEY) {
    agent.add('La clave de DeepSeek no está configurada. Contacta al administrador.');
    return;
  }

  try {
    const payload = {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'Eres un asistente de ventas para American Store. Responde usando la base de conocimiento de la tienda, sé breve y claro.' },
        { role: 'user', content: userQuery }
      ],
      temperature: 0.25,
      max_tokens: 700
    };

    const resp = await axios.post('https://api.deepseek.com/v1/chat/completions', payload, {
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    // Manejo robusto del formato de respuesta
    const reply =
      resp?.data?.choices?.[0]?.message?.content ||
      resp?.data?.choices?.[0]?.text ||
      (typeof resp?.data === 'string' ? resp.data : null) ||
      'No obtuve una respuesta clara de DeepSeek.';

    agent.add(reply);
  } catch (err) {
    console.error('Error consultando DeepSeek:', err?.response?.data || err?.message || err);
    agent.add('Lo siento, hubo un error consultando la información. Intenta nuevamente más tarde.');
  }
}

/* ---------------- Ruta principal (Dialogflow envía POST aquí) ---------------- */

app.post('/', async (req, res) => {
  // Construye WebhookClient con la petición/respuesta real
  const agent = new WebhookClient({ request: req, response: res });

  // Mapear nombres exactos de intents en Dialogflow a funciones
  const intentMap = new Map();
  intentMap.set('Default Welcome Intent', welcome);
  intentMap.set('Default Fallback Intent', fallback);
  intentMap.set('DeepSeek Intent', deepSeekIntent);   // crea este intent en Dialogflow
  intentMap.set('Ofertas Intent', ofertas);
  intentMap.set('Contacto Intent', contacto);

  try {
    await agent.handleRequest(intentMap);
  } catch (err) {
    console.error('Error en handleRequest:', err);
    res.status(500).send('Error interno en el fulfillment.');
  }
});

/* ---------------- Exports para Firebase y arranque local ---------------- */

// Export para Firebase Functions
exports.dialogflowWebhook = functions.https.onRequest(app);

// Si ejecutas localmente (node server.js) arranca Express en un puerto
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server iniciado en http://localhost:${PORT} (POST / para Dialogflow)`);
  });
}
