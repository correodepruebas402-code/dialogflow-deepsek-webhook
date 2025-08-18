'use strict';

const express = require('express');
const axios = require('axios');
const { WebhookClient } = require('dialogflow-fulfillment');
require('dotenv').config();

const app = express();
app.use(express.json());

const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
const deepseekApiUrl = 'https://api.deepseek.com/v1/chat/completions';

// Validar API Key al inicio
if (!deepseekApiKey) {
    console.error('❌ DEEPSEEK_API_KEY no configurada');
} else {
    console.log(`✅ DEEPSEEK_API_KEY configurada (longitud: ${deepseekApiKey.length} caracteres)`);
    console.log(`🔑 Primeros 10 caracteres: ${deepseekApiKey.substring(0, 10)}...`);
}

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
- **¿Puedo devolver un producto si no me queda?** Sí, aceptamos cambios por talla or referencia en los primeros 5 días después de recibir el producto. La prenda debe estar en perfecto estado, sin uso y con sus etiquetas.

**Sobre Compras y Seguridad:**
- **¿Cómo sé que mi compra es segura?** Somos una tienda verificada con una página web segura (HTTPS) y puedes ver testimonios de clientes en nuestras redes sociales.
- **¿Venden al por mayor?** Sí, ofrecemos precios especiales para revendedores. Para más detalles, deben contactarnos por WhatsApp.
- **¿Cómo me entero de nuevos productos?** Constantemente renovamos el inventario. Lo mejor es seguirnos en Instagram y WhatsApp para ver las novedades.

**Instrucción Final:**
Si la pregunta del cliente no se puede responder con esta información, responde amablemente: "Esa es una excelente pregunta. Para darte la información más precisa, por favor escríbenos directamente a nuestro WhatsApp o a nuestro Instagram @americanstor.online y uno de nuestros asesores te ayudará."
`;

// Función para probar la conexión con Deepseek
async function testDeepseekConnection() {
    try {
        console.log('🧪 Probando conexión con Deepseek...');
        
        const testResponse = await axios.post(deepseekApiUrl, {
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: 'Test' }],
            max_tokens: 10
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${deepseekApiKey}`
            },
            timeout: 30000
        });
        
        console.log('✅ Conexión con Deepseek exitosa');
        return true;
    } catch (error) {
        console.error('❌ Error probando conexión con Deepseek:');
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        return false;
    }
}

async function handleDeepseekQuery(agent) {
    const userQuery = agent.query;
    console.log(`📝 Consulta: "${userQuery}" | Intent: ${agent.intent}`);

    if (!deepseekApiKey) {
        console.error('❌ API Key no configurada');
        agent.add('Lo siento, hay un problema de configuración. Contacta a soporte técnico.');
        return;
    }

    // Respuesta de fallback si Deepseek falla
    const fallbackResponse = `¡Hola! Soy el asistente de AmericanStor Online. 

Para consultas específicas sobre productos, envíos o cualquier otra pregunta, te invito a contactarnos:

📱 WhatsApp: Nuestro canal principal de atención
📸 Instagram: @americanstor.online
🌐 Web: https://americanstor.online/

¿En qué más puedo ayudarte?`;

    try {
        console.log('🚀 Intentando conectar con Deepseek...');
        
        const requestPayload = {
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: knowledgeBaseContext },
                { role: 'user', content: userQuery }
            ],
            max_tokens: 300,
            temperature: 0.7
        };

        console.log('📤 Enviando petición...');

        const apiResponse = await axios.post(deepseekApiUrl, requestPayload, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${deepseekApiKey}`,
                'User-Agent': 'AmericanStor-Webhook/1.0'
            },
            timeout: 25000 // 25 segundos
        });

        console.log(`✅ Respuesta HTTP: ${apiResponse.status}`);

        if (apiResponse.data?.choices?.[0]?.message?.content) {
            const botResponse = apiResponse.data.choices[0].message.content;
            console.log(`🤖 Respuesta: ${botResponse.substring(0, 100)}...`);
            agent.add(botResponse);
        } else {
            console.log('⚠️ Respuesta vacía, usando fallback');
            agent.add(fallbackResponse);
        }

    } catch (error) {
        console.error('❌ ERROR DETALLADO:');
        console.error('- Tipo:', error.constructor.name);
        console.error('- Código:', error.code || 'N/A');
        console.error('- Mensaje:', error.message);
        
        if (error.response) {
            console.error('- Status HTTP:', error.response.status);
            console.error('- Headers:', JSON.stringify(error.response.headers, null, 2));
            console.error('- Data:', JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            console.error('- Request timeout o sin respuesta');
        }

        // Usar respuesta de fallback
        console.log('🔄 Usando respuesta de fallback');
        agent.add(fallbackResponse);
    }
}

app.post('/webhook', (request, response) => {
    console.log('🔔 Nueva petición webhook recibida');
    
    const agent = new WebhookClient({ request, response });

    let intentMap = new Map();
    intentMap.set('Default Fallback Intent', handleDeepseekQuery);
    intentMap.set('Consulta_Categorias', handleDeepseekQuery);
    intentMap.set('Envio_sin_cobertura', handleDeepseekQuery);
    intentMap.set('Envios_info', handleDeepseekQuery);
    intentMap.set('Perfumes_Consulta', handleDeepseekQuery);

    agent.handleRequest(intentMap);
});

// Health check mejorado
app.get('/health', async (req, res) => {
    const healthData = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        deepseekApiKey: deepseekApiKey ? 'Configurada' : 'Faltante',
        deepseekConnection: null
    };

    // Probar conexión con Deepseek
    if (deepseekApiKey) {
        healthData.deepseekConnection = await testDeepseekConnection();
    }

    res.json(healthData);
});

// Test endpoint para probar Deepseek directamente
app.get('/test-deepseek', async (req, res) => {
    if (!deepseekApiKey) {
        return res.json({ error: 'API Key no configurada' });
    }

    try {
        const testResponse = await axios.post(deepseekApiUrl, {
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: 'Responde solo "TEST OK"' }],
            max_tokens: 10
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${deepseekApiKey}`
            },
            timeout: 30000
        });

        res.json({
            success: true,
            response: testResponse.data
        });
    } catch (error) {
        res.json({
            success: false,
            error: {
                message: error.message,
                code: error.code,
                response: error.response?.data
            }
        });
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`🚀 Servidor iniciado en puerto ${port}`);
    console.log(`🏥 Health check: http://localhost:${port}/health`);
    console.log(`🧪 Test Deepseek: http://localhost:${port}/test-deepseek`);
    
    // Probar conexión al inicio
    if (deepseekApiKey) {
        setTimeout(testDeepseekConnection, 2000);
    }
});
