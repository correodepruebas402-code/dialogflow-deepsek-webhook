// server.js
const express = require("express");
const bodyParser = require("body-parser");
const { WebhookClient } = require("dialogflow-fulfillment");
const axios = require("axios");

const app = express();
app.use(bodyParser.json());

app.post('/webhook', async (req, res) => {
  const intent = req.body.queryResult.intent.displayName;
  const userQuery = req.body.queryResult.queryText;

  let respuesta = "No entendí tu consulta 😅";

  if (intent === "Perfumes_Consulta") {
    // Llamada a DeepSeek
    const deepSeekReply = await consultarDeepSeek(userQuery);
    respuesta = deepSeekReply;
  }

  // 👇 Esta es la parte importante
  res.json({
    fulfillmentText: respuesta,   // <-- Dialogflow mostrará esto en el chat
    fulfillmentMessages: [
      {
        text: {
          text: [respuesta]       // <-- para compatibilidad con todos los canales
        }
      }
    ]
  });
});


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

