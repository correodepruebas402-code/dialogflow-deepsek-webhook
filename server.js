'use strict';

const express = require('express');
const axios = require('axios');
const { WebhookClient } = require('dialogflow-fulfillment');
require('dotenv').config();

const app = express();
app.use(express.json());

const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
const deepseekApiUrl = 'https://api.deepseek.com/v1/chat/completions';

console.log(`✅ API Key configurada: ${deepseekApiKey ? 'SÍ' : 'NO'}`);

const knowledgeBaseContext = `
Eres un asistente virtual experto y amigable de la tienda AmericanStor Online. Responde de manera clara y concisa usando únicamente la siguiente información. Si no sabes la respuesta, dirige al cliente a los canales de contacto.

**AmericanStor Online:**
- Tienda 100% online de ropa americana original para hombre
- Productos: Ropa (camisetas, buzos, gorras) y perfumes
- Ropa 100% original importada de EE.UU.
- Contacto: WhatsApp e Instagram @americanstor.online
- Web: https://americanstor.online/

**Productos:**
- Ropa americana original para hombres, tallas S-XL
- Perfumes para hombre y mujer
- Perfumes 1.1: réplicas alta calidad, 6-10 horas duración

**Envíos:**
- A toda Colombia vía Inter Rapidísimo/Servientrega
- Costo: $10.000-$15.000 COP
- Tiempo: 1-3 días ciudades principales, hasta 5 días otras zonas

**Pagos:**
- Transferencias (Nequi, Daviplata, Bancolombia)
- Contra entrega en algunas ciudades
- Tarjetas débito/crédito

**Cambios:**
- 5 días después de recibir, prenda sin uso con etiquetas

Si no puedes responder, di: "Para información más detallada, contacta nuestro WhatsApp o Instagram @americanstor.online"
`;

async function handleDeepseekQuery(agent) {
    const userQuery = agent.query;
    console.log(`📝 Consulta: "${userQuery}"`);

    if (!deepseekApiKey) {
        agent.add('Hay un problema de configuración. Contacta soporte técnico.');
        return;
    }

    // Respuestas rápidas para consultas comunes
    const quickResponses = {
        'perfume': '¡Sí! En AmericanStor Online ofrecemos perfumes para hombre y mujer. También tenemos perfumes 1.1 (réplicas de alta calidad) con duración de 6-10 horas y precio más accesible. Para ver nuestro catálogo completo, visita https://americanstor.online/ o escríbenos al WhatsApp.',
        'envio': 'Hacemos envíos a toda Colombia a través de Inter Rapidísimo y Servientrega. El costo es de $10.000 a $15.000 COP. A ciudades principales llega en 1-3 días hábiles, a otras zonas hasta 5 días hábiles.',
        'talla': 'Manejamos tallas americanas desde S hasta XL. Te recomendamos revisar nuestra guía de tallas en https://americanstor.online/ para encontrar tu medida perfecta.',
        'original': 'Sí, toda nuestra ropa es 100% original, importada directamente de Estados Unidos de marcas reconocidas. Garantizamos la autenticidad y excelente calidad.',
        'pago': 'Puedes pagar por transferencias (Nequi, Daviplata, Bancolombia), contra entrega en algunas ciudades, o con tarjetas de débito/crédito a través de plataformas seguras.',
        'cambio': 'Sí, aceptamos cambios por talla o referencia en los primeros 5 días después de recibir el producto. La prenda debe estar en perfecto estado, sin uso y con etiquetas.',
        'contacto': 'Puedes contactarnos por WhatsApp (nuestro canal principal) o Instagram @americanstor.online. También visita nuestra web https://americanstor.online/',
        'hola': '¡Hola! Bienvenido a AmericanStor Online, tu tienda de ropa americana original para hombre y perfumes. ¿En qué puedo ayudarte hoy?'
    };

    // Buscar respuesta rápida
    const queryLower = userQuery.toLowerCase();
    for (const [keyword, response] of Object.entries(quickResponses)) {
        if (queryLower.includes(keyword)) {
            console.log(`⚡ Respuesta rápida para: ${keyword}`);
            agent.add(response);
            return;
        }
    }

    try {
        console.log('🚀 Llamando Deepseek...');
        
        const apiResponse = await axios.post(deepseekApiUrl, {
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: knowledgeBaseContext },
                { role: 'user', content: userQuery }
            ],
            max_tokens: 200, // Reducido para respuesta más rápida
            temperature: 0.3 // Más determinista y rápido
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${deepseekApiKey}`
            },
            timeout: 4000 // Solo 4 segundos para Deepseek
        });

        if (apiResponse.data?.choices?.[0]?.message?.content) {
            const botResponse = apiResponse.data.choices[0].message.content;
            console.log(`✅ Deepseek respondió`);
            agent.add(botResponse);
        } else {
            console.log('⚠️ Respuesta vacía de Deepseek');
            agent.add('Para consultas específicas, contacta nuestro WhatsApp o Instagram @americanstor.online donde te daremos información detallada.');
        }

    } catch (error) {
        console.error(`❌ Error Deepseek: ${error.message}`);
        
        // Respuesta de fallback basada en la consulta
        let fallbackResponse = 'Gracias por contactar AmericanStor Online. ';
        
        if (queryLower.includes('perfume')) {
            fallbackResponse += 'Ofrecemos perfumes originales y réplicas 1.1 de alta calidad. ';
        } else if (queryLower.includes('envio')) {
            fallbackResponse += 'Enviamos a toda Colombia por $10.000-$15.000 COP en 1-5 días hábiles. ';
        } else if (queryLower.includes('talla')) {
            fallbackResponse += 'Manejamos tallas americanas S-XL con guía en nuestra web. ';
        }
        
        fallbackResponse += 'Para información completa, escríbenos al WhatsApp o Instagram @americanstor.online';
        
        agent.add(fallbackResponse);
    }
}

app.post('/webhook', (request, response) => {
    console.log('🔔 Webhook recibido');
    
    const agent = new WebhookClient({ request, response });

    let intentMap = new Map();
    intentMap.set('Default Fallback Intent', handleDeepseekQuery);
    intentMap.set('Consulta_Categorias', handleDeepseekQuery);
    intentMap.set('Envio_sin_cobertura', handleDeepseekQuery);
    intentMap.set('Envios_info', handleDeepseekQuery);
    intentMap.set('Perfumes_Consulta', handleDeepseekQuery);

    agent.handleRequest(intentMap);
});

app.get('/health', async (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        deepseekApiKey: deepseekApiKey ? 'Configurada' : 'Faltante',
        optimizedForDialogflow: true
    });
});

// Test de velocidad
app.get('/speed-test', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const testResponse = await axios.post(deepseekApiUrl, {
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: 'Responde solo "OK"' }],
            max_tokens: 5,
            temperature: 0
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${deepseekApiKey}`
            },
            timeout: 4000
        });

        const duration = Date.now() - startTime;
        
        res.json({
            success: true,
            duration_ms: duration,
            response: testResponse.data,
            dialogflow_compatible: duration < 4000
        });
    } catch (error) {
        const duration = Date.now() - startTime;
        res.json({
            success: false,
            duration_ms: duration,
            error: error.message
        });
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`🚀 Servidor optimizado para Dialogflow en puerto ${port}`);
    console.log(`⚡ Timeout configurado para < 4 segundos`);
});
