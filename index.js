import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json({ limit: "1mb" }));

// --- Función que llama a DeepSeek ----------------
async function askDeepSeek({ userText, systemPrompt }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(
      `${process.env.DEEPSEEK_BASE_URL?.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
          messages: [
            systemPrompt
              ? { role: "system", content: systemPrompt }
              : { role: "system", content: "Eres un asistente útil y conciso." },
            { role: "user", content: userText || "Hola" },
          ],
          stream: false,
          max_tokens: 512,
          temperature: 0.4,
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`DeepSeek ${res.status}: ${errText}`);
    }
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || "";
  } finally {
    clearTimeout(timeout);
  }
}

// --- Ruta del webhook ----------------------------
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body || {};
    const isCX = !!body.fulfillmentInfo || !!body.sessionInfo;
    const isES = !!body.queryResult;

    let userText = "";
    let systemPrompt = "";

    if (isCX) {
      const tag = body.fulfillmentInfo?.tag || "deepseek";
      const params = body.sessionInfo?.parameters || {};
      userText = body.text || params?.user_input || params?.last_user_utterance || "";
      systemPrompt = params?.system_prompt || "";

      if (tag !== "deepseek") {
        return res.json({
          fulfillmentResponse: {
            messages: [{ text: { text: ["Webhook activo, pero tag no coincide."] } }],
          },
        });
      }

      const answer = await askDeepSeek({ userText, systemPrompt });

      return res.json({
        fulfillmentResponse: {
          messages: [{ text: { text: [answer] } }],
        },
        sessionInfo: {
          parameters: {
            last_user_utterance: userText,
            last_ai_answer: answer,
          },
        },
      });
    }

    if (isES) {
      userText = body.queryResult?.queryText || "";
      systemPrompt =
        body.originalDetectIntentRequest?.payload?.system_prompt || "";

      const answer = await askDeepSeek({ userText, systemPrompt });

      return res.json({ fulfillmentText: answer });
    }

    return res.status(400).json({ error: "Formato desconocido" });
  } catch (err) {
    console.error(err);
    const fallback = "Lo siento, no puedo responder ahora mismo.";
    return res.json({
      fulfillmentResponse: { messages: [{ text: { text: [fallback] } }] },
      fulfillmentText: fallback,
    });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Webhook escuchando en puerto ${port}`);
});
