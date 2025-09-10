// Importamos dependencias
const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const fs = require("fs");

// Cargamos el archivo brand-voice.json
const brandVoice = JSON.parse(fs.readFileSync("brand-voice.json", "utf8"));


// Configuramos variables de entorno
dotenv.config(); console.log("📌 PORT:", process.env.PORT);
console.log("📌 API KEY:", process.env.DEEPSEEK_API_KEY);


const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para parsear JSON
app.use(bodyParser.json());

// Ruta principal para verificar que el servidor funciona
app.get("/", (req, res) => {
  res.send("✅ Fulfillment Webhook activo y funcionando...");
});

// Ruta del webhook que usará Dialogflow
app.post("/webhook", (req, res) => {
  console.log("👉 Request recibido de Dialogflow:", req.body);

  // Obtenemos la intención detectada
  const intentName = req.body.queryResult.intent.displayName;

  let responseText = brandVoice.examples.default; // respuesta por defecto

// Lógica de ejemplo: responder según intención
switch (intentName) {
  case "Consulta_Categorias":
    responseText = brandVoice.examples.catalog;
    break;

  case "Comparacion_Precios":
    responseText = "Puedes comparar precios en nuestra tienda online. ¿Quieres el link directo?";
    break;

  case "Cambios_Devoluciones":
    responseText = brandVoice.examples.returns;
    break;

  default:
    responseText = brandVoice.examples.default;
}


  // Respondemos a Dialogflow
  res.json({
    fulfillmentText: responseText,
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor webhook corriendo en http://localhost:${PORT}`);
});

