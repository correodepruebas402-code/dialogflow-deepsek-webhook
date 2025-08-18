// server.js
const express = require("express");
const bodyParser = require("body-parser");
const { WebhookClient } = require("dialogflow-fulfillment");
const axios = require("axios");

const app = express();
app.use(bodyParser.json());

app.post("/webhook", (req, res) => {
  const agent = new WebhookClient({ request: req, response: res });

  console.log("🔔 Intent detectado:", agent.intent);
  console.log("📩 Query del usuario:", agent.query);

  // Handler general que llama a DeepSeek
  async function handleIntent(agent) {
    try {
      // Llamada a DeepSeek API
      const apiResponse = await axios.post(
        "https://api.deepseek.com/v1/chat/completions",
        {
          model: "deepseek-chat",
          messages: [{ role: "user", content: agent.query }],
        },
        {
          headers: {
            "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const botResponse =
        apiResponse?.data?.choices?.[0]?.message?.content ||
        "Lo siento, no encontré respuesta.";

      console.log("🤖 Respuesta de DeepSeek:", botResponse);

      // 🔑 IMPORTANTE: Esta línea manda fulfillmentText a Dialogflow
      agent.add(botResponse);
    } catch (error) {
      console.error("❌ Error al conectar con DeepSeek:", error.message);
      agent.add("Hubo un error al procesar tu solicitud. Intenta de nuevo.");
    }
  }

  // Mapear intents de Dialogflow
  let intentMap = new Map();
  intentMap.set("Perfumes_Consulta", handleIntent);
  intentMap.set("Consulta_Categorias", handleIntent);
  intentMap.set("Default Fallback Intent", handleIntent);

  agent.handleRequest(intentMap);
});

// Iniciar servidor
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Webhook corriendo en puerto ${PORT}`);
});
