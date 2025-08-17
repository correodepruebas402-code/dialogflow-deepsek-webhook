// index.js
const functions = require('@google-cloud/functions-framework');
const axios = require('axios');
const { americanStoreKnowledge } = require('./knowledgeParser');

functions.http('americanStoreWebhook', async (req, res) => {
  const intentName = req.body.queryResult.intent.displayName;
  const queryText = req.body.queryResult.queryText.toLowerCase();

  // Respuestas directas para intents específicos
  if (intentName === 'ConsultarDescuentos') {
    return res.json({
      fulfillmentText: `Descuentos actuales: ${americanStoreKnowledge.generalInfo.discounts.general}`
    });
  }

  // Consulta compleja a DeepSeek
  try {
    const deepSeekResponse = await queryDeepSeekWithContext(queryText);
    return res.json({ fulfillmentText: deepSeekResponse });
  } catch (error) {
    console.error(error);
    return res.json({
      fulfillmentText: "Por favor contáctanos via WhatsApp al 3117112995 para asistencia inmediata."
    });
  }
});

async function queryDeepSeekWithContext(query) {
  const contextPrompt = `
  Eres un asistente de American Store. Responde ÚNICAMENTE basado en esta información:

  INFORMACIÓN DE LA TIENDA:
  - Descuentos: ${JSON.stringify(americanStoreKnowledge.generalInfo.discounts)}
  - Categorías: ${americanStoreKnowledge.categories.join(', ')}
  - Contacto: ${JSON.stringify(americanStoreKnowledge.contact)}

  REGLAS:
  1. Si preguntan por precios específicos, menciona que pueden consultarlos por WhatsApp
  2. Para devoluciones, dirigir al email de administración
  3. Nunca inventes información fuera de este contexto
  `;

  const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
    model: "deepseek-chat",
    messages: [
      { role: "system", content: contextPrompt },
      { role: "user", content: query }
    ],
    temperature: 0.3
  }, {
    headers: { 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` }
  });

  return response.data.choices[0].message.content;
}
