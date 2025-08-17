'use strict';

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { WebhookClient } = require('dialogflow-fulfillment');
const functions = require('firebase-functions'); // opcional, no rompe en Render
require('dotenv').config();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '256kb' }));

// CONFIG: variables de entorno (Render / .env / Firebase config)
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY ||
  (functions.config && functions.config().deepseek && functions.config().deepseek.key) || '';

const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN ||
  (functions.config && functions.config().webhook && functions.config().webhook.token) || '';

// Seguridad básica: validar header secreto (opcional pero recomendado)
app.use((req, res, next) => {
  // solo proteger rutas POST que vienen de Dialogflow
  if (req.method === 'POST') {
    const token = req.header('x-webhook-token') || '';
    if (WEBHOOK_TOKEN && token !== WEBHOOK_TOKEN) {
      console.warn('Access rejected: invalid webhook token');
      return res.status(403).send('Forbidden: invalid token');
    }
  }
  next();
});

process.env.DEBUG = process.env.DEBUG || 'dialogflow:debug';

/* ---------- Handlers de intents ---------- */

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

async function deepSeekIntent(agent) {
  const userQuery = agent.query ||
    (agent.request_ && agent.request_.body && agent.request_.body.queryResult && agent.request_.body.queryResult.queryText) ||
    '';

  if (!DEEPSEEK_KEY) {
    agent.add('La clave de DeepSeek no está configurada en el servidor.');
    return;
  }

  try {
    const payload = {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'Eres un asistente de ventas para American Store. Usa la base de conocimiento para responder preguntas sobre productos, ofertas y políticas.' },
        { role: 'user', content: userQuery }
      ],
      temperature: 0.3,
      max_tokens: 700
    };

    const resp = await axios.post('https://api.deepseek.com/v1/chat/completions', payload, {
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    const reply =
      resp?.data?.choices?.[0]?.message?.content ||
      resp?.data?.choices?.[0]?.text ||
      'No obtuve una respuesta clara de DeepSeek.';

    agent.add(reply);
  } catch (err) {
    console.error('Error DeepSeek:', err?.response?.data || err?.message || err);
    agent.add('Lo siento, hubo un error consultando la información. Intenta nuevamente más tarde.');
  }
}

/* ---------- Ruta principal (Dialogflow enviará POST aquí) ---------- */

app.post('/', async (req, res) => {
  const agent = new WebhookClient({ request: req, response: res });

  const intentMap = new Map();
  intentMap.set('Default Welcome Intent', welcome);
  intentMap.set('Default Fallback Intent', fallback);
  intentMap.set('DeepSeek Intent', deepSeekIntent);   // asegúrate de que el nombre coincida en Dialogflow
  intentMap.set('Ofertas Intent', ofertas);
  intentMap.set('Contacto Intent', contacto);

  try {
    await agent.handleRequest(intentMap);
  } catch (err) {
    console.error('Error en handleRequest:', err);
    res.status(500).send('Error interno en el fulfillment.');
  }
});

/* ---------- Exponer servidor (Render usa process.env.PORT) ---------- */

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server iniciado en http://localhost:${PORT} (POST / para Dialogflow)`);
  });
}

// Si usas Firebase Functions localmente o en otro host, exporta:
try {
  exports.dialogflowWebhook = functions.https.onRequest(app);
} catch (e) {
  // ignore si functions no está disponible (por ejemplo en Render)
}
