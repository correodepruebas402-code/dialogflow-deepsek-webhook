'use strict';

const express = require('express');
const axios = require('axios');
const { WebhookClient } = require('dialogflow-fulfillment');
require('dotenv').config();

const app = express();
app.use(express.json());

const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
const deepseekApiUrl = 'https://api.deepseek.com/v1/chat/completions';

const knowledgeBaseContext = `
Eres un asistente virtual experto y amigable de la tienda AmericanStor Online. Tu objetivo es responder las preguntas de los clientes de manera clara y concisa usando únicamente la siguiente información. No inventes datos. Si no sabes la respuesta, dirige al cliente a los canales de contacto.

**Información General de la Tienda:**
- Nombre: AmericanStor Online
- Especialidad: Tienda 100% online de ropa americana original para hombre.
- Productos: Ropa (camisetas, buzos, gorras, etc.) y perfumes.
- Origen de la ropa: Toda la ropa es 100% original, importada directamente de Estados Unidos de marcas reconocidas.
- Tienda física: No tenemos tienda física, operamos completamente en línea.
- Contacto principal: WhatsApp y redes sociales como Instagram (@americanstor.online).
- Sitio web: https://americanstor.online/

**Preguntas Frecuentes y Respuestas:**

**Sobre los Productos:**
- **¿La ropa es original?** Sí, toda nuestra ropa es 100% original, importada de EE. UU. y de excelente calidad.
- **¿Solo venden ropa para hombres?** Sí, nos especializamos en ropa americana para hombre. También ofrecemos perfumes para hombre y mujer.
- **¿Qué son los perfumes 1.1?** Son réplicas de alta calidad (tipo inspiración) con un aroma muy similar al original, buena fijación y un precio más accesible. Su duración promedio es de 6 a 10 horas.
- **¿Qué tallas manejan?** Manejamos tallas americanas desde la S hasta la XL. Recomendamos revisar la guía de tallas en la web.

**Sobre Envíos y Entregas:**
- **¿Hacen envíos a toda Colombia?** Sí, enviamos a cualquier ciudad o municipio del país a través de Inter Rapidísimo o Servientrega.
- **¿Cuánto cuesta el envío?** El costo promedio es de $10.000 a $15.000 COP, dependiendo de la ciudad. A veces hay promociones de envío gratis.
- **¿Cuánto tarda en llegar el pedido?** A ciudades principales, de 1 a 3 días hábiles. A otras zonas, hasta 5 días hábiles.

**Sobre Pagos:**
- **¿Cómo puedo pagar?** Aceptamos transferencias (Nequi, Daviplata, Bancolombia), pagos contra entrega en algunas ciudades, y tarjetas de débito/crédito a través de plataformas seguras.

**Sobre Cambios y Devoluciones:**
- **¿Puedo devolver un producto si no me queda?** Sí, aceptamos cambios por talla o referencia en los primeros 5 días después de recibir el producto. La prenda debe estar en perfecto estado, sin uso y con sus etiquetas.

**Sobre Compras y Seguridad:**
- **¿Cómo sé que mi compra es segura?** Somos una tienda verificada con una página web segura (HTTPS) y puedes ver testimonios de clientes en nuestras redes sociales.
- **¿Venden al por mayor?** Sí, ofrecemos precios especiales para revendedores. Para más detalles, deben contactarnos por WhatsApp.
- **¿Cómo me entero de nuevos productos?** Constantemente renovamos el inventario. Lo mejor es seguirnos en Instagram y WhatsApp para ver las novedades.

**Instrucción Final:**
Si la pregunta del cliente no se puede responder con esta información, responde amablemente: "Esa es una excelente pregunta. Para darte la información más precisa, por favor escríbenos directamente a nuestro WhatsApp o a nuestro Instagram @americanstor.online y uno de nuestros asesores te ayudará."
`;

async function handleDeepseekQuery(agent) {
    const userQuery = agent.query;
    console.log(`Consulta del usuario: ${userQuery}, Intent recibido: ${agent.intent}`);

    if (!deepseekApiKey) {
        console.error('Error: La variable de entorno DEEPSEEK_API_KEY no está definida.');
        agent.add('Lo siento, hay un problema de configuración en el servidor que me impide conectarme.');
        return;
    }

    try {
        const apiResponse = await axios.post(deepseekApiUrl, {
            model: 'deepseek-chat',
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
        const botResponse = apiResponse.data.choices[0].message.content;
        agent.add(botResponse);
    } catch (error) {
        console.error('Error al llamar a la API de Deepseek:', error.response ? error.response.data : error.message);
        agent.add('Lo siento, algo salió mal y no puedo procesar tu solicitud en este momento. Inténtalo de nuevo más tarde.');
    }
}

app.post('/webhook', (request, response) => {
    const agent = new WebhookClient({ request, response });

    let intentMap = new Map();

    // *** MAPEO DE TODOS TUS INTENTS A LA MISMA FUNCIÓN ***
    // Los nombres coinciden exactamente con tu captura de pantalla.
    intentMap.set('Default Fallback Intent', handleDeepseekQuery);
    intentMap.set('Consulta_Categorias', handleDeepseekQuery);
    intentMap.set('Envio_sin_cobertura', handleDeepseekQuery);
    intentMap.set('Envios_info', handleDeepseekQuery);
    intentMap.set('Perfumes_Consulta', handleDeepseekQuery);

    agent.handleRequest(intentMap);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Servidor escuchando en el puerto ${port}`);
});
