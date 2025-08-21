'use strict';

const express = require('express');
const { WebhookClient } = require('dialogflow-fulfillment');

require('dotenv').config();

const app = express();
app.use(express.json());

// 🚀 ENDPOINTS DE VERIFICACIÓN
app.get('/', (req, res) => {
    res.json({ 
        status: 'AmericanStor Webhook ULTRA FAST', 
        version: '2.0',
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        service: 'AmericanStor ULTRA FAST',
        response_time: 'sub_1_second'
    });
});

// ⚡ RESPUESTAS INSTANTÁNEAS - SIN APIS EXTERNAS
function getRespuestaInstantanea(query, intent) {
    const q = query.toLowerCase();
    
    // Respuestas específicas por intent y keywords
    if (intent === 'Perfumes_Consulta_General' || q.includes('perfume') || q.includes('fragancia')) {
        if (q.includes('hombre')) {
            return '¡Perfecto! 😊 Tenemos excelentes fragancias para hombre: Jean Paul Gaultier, Dior, Hugo Boss y más. ¿Te interesa alguna marca específica? 🎯';
        }
        if (q.includes('mujer')) {
            return '¡Genial! 💃 Manejamos hermosas fragancias femeninas: Chanel, Dior, Carolina Herrera y más. ¿Buscas algo en particular? ✨';
        }
        if (q.includes('tipo') || q.includes('venden') || q.includes('tienen')) {
            return '¡Hola! 😊 Sí, tenemos una amplia gama de perfumes: para hombre, mujer, unisex, de todas las marcas reconocidas. ¿Qué tipo te interesa? 🎯';
        }
        return '¡Hola! 🌟 Somos especialistas en perfumes de las mejores marcas. Tenemos fragancias para hombre, mujer y unisex. ¿En qué puedo ayudarte? 😊';
    }
    
    if (intent === 'Ropa_Consulta_General' || q.includes('ropa') || q.includes('camiseta') || q.includes('pantalón')) {
        return '¡Excelente! 👕 Tenemos ropa de calidad: camisetas, pantalones, chaquetas en todas las tallas (S-XXL). ¿Qué tipo de prenda buscas? 😊';
    }
    
    if (intent === 'Ropa_Tallas_Consulta' || q.includes('talla') || q.includes('medida')) {
        return 'Manejamos todas las tallas desde S hasta XXL. 📏 También tenemos una guía de tallas para ayudarte. ¿Qué prenda te interesa? 👍';
    }
    
    if (q.includes('envío') || q.includes('entrega') || q.includes('domicilio')) {
        return 'Realizamos envíos a todo Colombia. 🚚 Tiempo: 2-5 días hábiles. Costo desde $8,000. ¿A qué ciudad sería el envío? 📦';
    }
    
    if (q.includes('pago') || q.includes('tarjeta') || q.includes('efectivo')) {
        return 'Aceptamos múltiples formas de pago: 💳 Tarjetas débito/crédito, PSE, Nequi, Daviplata y contraentrega. ¡Tú eliges! 😊';
    }
    
    // Respuesta por defecto
    return '¡Hola! 👋 Soy tu asistente de AmericanStor. Tenemos ropa y perfumes de las mejores marcas. ¿En qué puedo ayudarte hoy? 🛍️';
}

// 🎯 WEBHOOK PRINCIPAL - RESPUESTA INSTANTÁNEA
app.post('/webhook', (req, res) => {
    const startTime = Date.now();
    console.log('⚡ REQUEST:', new Date().toISOString());
    
    try {
        const agent = new WebhookClient({ request: req, response: res });
        const query = agent.query || '';
        const intent = agent.intent || '';
        
        console.log('🎯', intent, '|', query);
        
        // RESPUESTA INSTANTÁNEA - NO ASYNC, NO AWAIT
        const respuesta = getRespuestaInstantanea(query, intent);
        agent.add(respuesta);
        
        const time = Date.now() - startTime;
        console.log('✅ Enviado en:', time + 'ms');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        
        // RESPUESTA DE EMERGENCIA ULTRA RÁPIDA
        const agent = new WebhookClient({ request: req, response: res });
        agent.add('¡Hola! 😊 Soy tu asistente de AmericanStor. ¿En qué puedo ayudarte? 🛍️');
    }
});

// 🚀 INICIAR SERVIDOR
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log('⚡ AmericanStor ULTRA FAST Webhook - Puerto:', PORT);
    console.log('🔗', `https://dialogflow-deepseek-webhook.onrender.com/webhook`);
    console.log('⏱️ Respuestas < 1 segundo garantizado');
    console.log('🚀 NO external APIs - INSTANT responses');
    console.log('////////////////////////////////////////////////');
});

// Manejo de errores mínimo
process.on('uncaughtException', (error) => {
    console.log('⚠️', error.message);
});
