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
Eres un asistente virtual experto y amigable de la tienda AmericanStor Online. Responde de manera clara, concisa y natural usando únicamente la siguiente información. Siempre responde como un vendedor experto y entusiasta.

**AmericanStor Online:**
- Tienda 100% online de ropa americana original para hombre
- Productos: Ropa (camisetas, buzos, gorras) y perfumes
- Ropa 100% original importada de EE.UU.
- Contacto: WhatsApp e Instagram @americanstor.online
- Web: https://americanstor.online/

**CATÁLOGO DE PERFUMES:**

**Perfumes Originales para Hombre:**
- Dior Sauvage (fresco, cítrico, amaderado) - Muy popular
- Hugo Boss Bottled (elegante, frutal, masculino)
- Calvin Klein CK One (unisex, cítrico puro, fresco)
- Versace Eros (intenso, oriental, seductor)
- Armani Code (sofisticado, especiado, nocturno)
- Paco Rabanne 1 Million (dorado, especiado, llamativo)

**Perfumes Originales para Mujer:**
- Chanel Coco Mademoiselle (elegante, oriental, sofisticado)
- Victoria's Secret (variedad: Bombshell, Love, Pure Seduction)
- Marc Jacobs Daisy (floral, fresco, juvenil)
- Carolina Herrera Good Girl (dual, elegante, moderno)

**Perfumes 1.1 (Réplicas Alta Calidad):**
- Versiones 1.1 de TODAS las marcas mencionadas
- Duración: 6-10 horas (excelente calidad)
- Mismas notas olfativas que los originales
- Precio mucho más accesible

**TIPOS DE FRAGANCIAS por categoría:**
- **Cítricas/Frescas:** Dior Sauvage, CK One (energizantes, día, verano)
- **Frutales:** Hugo Boss, Victoria's Secret Bombshell (dulces, juveniles)
- **Orientales/Intensas:** Versace Eros, Chanel Coco (sensuales, noche)
- **Florales:** Marc Jacobs Daisy, Carolina Herrera (delicadas, femeninas)
- **Amaderadas:** Dior Sauvage base, Armani Code (masculinas, elegantes)
- **Especiadas:** Paco Rabanne 1 Million, Armani Code (llamativas, invierno)

**Ropa Americana Original:**
- Camisetas, buzos, gorras de marcas reconocidas (Nike, Adidas, Supreme, etc.)
- Tallas americanas: S, M, L, XL
- 100% original importada de Estados Unidos

**Información Comercial:**
- **Envíos:** Toda Colombia, Inter Rapidísimo/Servientrega, $10.000-$15.000, 1-5 días
- **Pagos:** Nequi, Daviplata, Bancolombia, contra entrega, tarjetas
- **Cambios:** 5 días, producto sin uso con etiquetas
- **Garantía:** Productos 100% originales

INSTRUCCIONES DE RESPUESTA:
- Siempre sé entusiasta y conocedor
- Si preguntan por tipos específicos, menciona 2-3 opciones concretas
- Incluye tanto originales como réplicas 1.1 como opciones
- Si no tienes info específica de una marca: "Para confirmar esa referencia específica, escríbeme al WhatsApp"
- Termina con llamado a la acción (WhatsApp, Instagram o web)
`;

// Sistema híbrido: Respuestas inteligentes instantáneas + Deepseek como respaldo
function getIntelligentResponse(query) {
    const queryLower = query.toLowerCase();
    
    // 1. SALUDOS
    if (/^(hola|hello|hi|buenas|buenos|saludos|que tal|hey)/i.test(query.trim())) {
        return '¡Hola! 😊 Bienvenido a AmericanStor Online. Somos especialistas en ropa americana original y perfumes de las mejores marcas. ¿En qué puedo ayudarte hoy?';
    }
    
    // 2. PERFUMES CÍTRICOS/FRESCOS - Respuesta específica
    if (queryLower.includes('citrico') || queryLower.includes('citricos') || (queryLower.includes('fresco') && queryLower.includes('perfume'))) {
        return '¡Excelente elección! 🍋 En perfumes cítricos/frescos tenemos:\n\n• **Dior Sauvage** - Cítrico-amaderado, muy fresco y masculino\n• **Calvin Klein CK One** - Cítrico puro, unisex, súper refrescante\n\nAmbos disponibles en versión **original** y **réplica 1.1** (6-10h duración). Para precios y disponibilidad, escríbeme al WhatsApp 📱';
    }
    
    // 3. PERFUMES POR GÉNERO
    if (queryLower.includes('perfume') && queryLower.includes('hombre')) {
        return '¡Perfecto! 💪 Para hombre tenemos excelentes opciones:\n\n• **Dior Sauvage** (fresco, cítrico)\n• **Versace Eros** (intenso, seductor)\n• **Hugo Boss Bottled** (elegante, frutal)\n• **Armani Code** (sofisticado, nocturno)\n\nTodos disponibles originales y réplicas 1.1. ¿Te interesa alguno en particular? Escríbeme al WhatsApp para precios 📱';
    }
    
    if (queryLower.includes('perfume') && (queryLower.includes('mujer') || queryLower.includes('dama'))) {
        return '¡Hermoso! ✨ Para mujer tenemos:\n\n• **Chanel Coco Mademoiselle** (elegante, sofisticado)\n• **Victoria\'s Secret** (Bombshell, Love, Pure Seduction)\n• **Marc Jacobs Daisy** (floral, juvenil)\n• **Carolina Herrera Good Girl** (moderno, elegante)\n\nOriginales y réplicas 1.1 disponibles. ¿Cuál te llama la atención? Escríbeme al WhatsApp 📱';
    }
    
    // 4. MARCAS ESPECÍFICAS
    if (queryLower.includes('dior')) {
        return '¡Dior Sauvage! 🔥 Uno de nuestros más vendidos. Es fresco, cítrico con base amaderada - perfecto para cualquier ocasión. Disponible:\n\n• **Original importado** (máxima calidad)\n• **Réplica 1.1** (6-10h duración, precio accesible)\n\nPara precios actuales y disponibilidad, escríbeme al WhatsApp 📱';
    }
    
    if (queryLower.includes('versace')) {
        return '¡Versace Eros! ⚡ Perfume intenso y seductor, perfecto para la noche. Disponible en:\n\n• **Original importado**\n• **Réplica 1.1** (excelente calidad)\n\nTambién manejamos otras fragancias Versace. Para catálogo completo, WhatsApp 📱';
    }
    
    // 5. ROPA
    if (queryLower.includes('ropa') || queryLower.includes('camisa') || queryLower.includes('buzo') || queryLower.includes('gorra')) {
        return '¡Ropa americana original! 👕 Importamos directamente de EE.UU.:\n\n• **Camisetas** (Nike, Adidas, Supreme, etc.)\n• **Buzos** de marcas reconocidas\n• **Gorras** originales\n• **Tallas:** S, M, L, XL\n\nTodo 100% original con etiquetas. Ver catálogo: https://americanstor.online/ o WhatsApp 📱';
    }
    
    // 6. TALLAS
    if (queryLower.includes('talla')) {
        return 'Manejamos **tallas americanas**: S, M, L, XL 📏\n\nTe recomiendo revisar nuestra guía de tallas en https://americanstor.online/ o envíame tus medidas al WhatsApp y te ayudo a encontrar tu talla perfecta 📱';
    }
    
    // 7. ENVÍOS
    if (queryLower.includes('envio') || queryLower.includes('entrega')) {
        return '📦 **Envíos a toda Colombia:**\n\n• Transportadoras: Inter Rapidísimo/Servientrega\n• Costo: $10.000 - $15.000\n• Tiempo: 1-3 días ciudades principales, hasta 5 días otras zonas\n\n¿A qué ciudad necesitas el envío? Te confirmo el tiempo exacto por WhatsApp 📱';
    }
    
    // 8. PAGOS
    if (queryLower.includes('pago') || queryLower.includes('precio')) {
        return '💳 **Formas de pago:**\n\n• Transferencias: Nequi, Daviplata, Bancolombia\n• Contra entrega (ciudades disponibles)\n• Tarjetas débito/crédito\n\nPara precios específicos de productos, escríbeme al WhatsApp con lo que te interesa 📱';
    }
    
    // 9. PERFUMES GENERALES
    if (queryLower.includes('perfume') && !queryLower.includes('tipo') && !queryLower.includes('cual')) {
        return '¡Perfumes! ✨ Somos especialistas con amplio catálogo:\n\n🔸 **Originales importados** de las mejores marcas\n🔸 **Réplicas 1.1** (alta calidad, 6-10h duración)\n\nPara hombre y mujer. ¿Buscas algo específico o prefieres ver el catálogo completo? WhatsApp 📱';
    }
    
    // 10. CONTACTO/INFO GENERAL
    if (queryLower.includes('contacto') || queryLower.includes('whatsapp') || queryLower.includes('instagram') || queryLower.includes('info')) {
        return '📞 **Contáctanos:**\n\n• WhatsApp (atención personalizada)\n• Instagram: @americanstor.online\n• Web: https://americanstor.online/\n\n¡Estamos aquí para ayudarte! 😊';
    }
    
    return null; // Si no hay respuesta inteligente, ir a Deepseek
}

async function handleQuery(agent) {
    const userQuery = agent.query;
    const intentName = agent.intent || 'Unknown';
    
    console.log(`📝 Intent: ${intentName} | Consulta: "${userQuery}"`);

    // 1. PRIMER INTENTO: Respuesta inteligente instantánea
    const intelligentResponse = getIntelligentResponse(userQuery);
    if (intelligentResponse) {
        console.log(`⚡ Respuesta inteligente aplicada`);
        agent.add(intelligentResponse);
        return;
    }

    // 2. SEGUNDO INTENTO: Deepseek para consultas complejas
    if (!deepseekApiKey) {
        console.log('❌ API Key no configurada, usando fallback');
        agent.add('Gracias por contactar AmericanStor Online. Para información detallada sobre nuestros productos, escríbeme al WhatsApp o Instagram @americanstor.online 📱');
        return;
    }

    try {
        console.log('🚀 Consultando Deepseek...');
        
        const apiResponse = await axios.post(deepseekApiUrl, {
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: knowledgeBaseContext },
                { role: 'user', content: userQuery }
            ],
            max_tokens: 200,
            temperature: 0.3,
            top_p: 0.9
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${deepseekApiKey}`
            },
            timeout: 3000
        });

        if (apiResponse.data?.choices?.[0]?.message?.content) {
            const botResponse = apiResponse.data.choices[0].message.content.trim();
            console.log(`✅ Deepseek respondió`);
            agent.add(botResponse);
        } else {
            throw new Error('Empty response from Deepseek');
        }

    } catch (error) {
        console.error(`❌ Error Deepseek: ${error.message}`);
        
        // 3. TERCER INTENTO: Fallback inteligente
        const fallbackResponse = getSmartFallback(userQuery);
        console.log(`🔄 Usando fallback inteligente`);
        agent.add(fallbackResponse);
    }
}

function getSmartFallback(query) {
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('perfume')) {
        return 'Tenemos excelente variedad en perfumes originales e importados y réplicas 1.1 de alta calidad. Para información específica sobre la referencia que buscas, escríbeme al WhatsApp donde te puedo mostrar disponibilidad y precios actuales 📱';
    }
    
    if (queryLower.includes('ropa')) {
        return 'Especialistas en ropa americana original importada de EE.UU. Para ver nuestro catálogo completo y tallas disponibles: https://americanstor.online/ o WhatsApp 📱';
    }
    
    return 'Gracias por contactar AmericanStor Online 😊 Para brindarte la información más precisa sobre tu consulta, escríbeme al WhatsApp o síguenos en Instagram @americanstor.online 📱';
}

// Webhook
app.post('/webhook', (request, response) => {
    console.log('🔔 Webhook recibido');
    const agent = new WebhookClient({ request, response });
    
    let intentMap = new Map();
    // Todos los intents van a la misma función inteligente
    intentMap.set('Default Fallback Intent', handleQuery);
    intentMap.set('Consulta_Categorias', handleQuery);
    intentMap.set('Envio_sin_cobertura', handleQuery);
    intentMap.set('Envios_info', handleQuery);
    intentMap.set('Perfumes_Consulta', handleQuery);
    intentMap.set('Consulta_Tallas', handleQuery);
    intentMap.set('Consulta_Pagos', handleQuery);
    intentMap.set('Saludos', handleQuery);

    agent.handleRequest(intentMap);
});

// Health check
app.get('/health', async (req, res) => {
    let deepseekStatus = 'No configurada';
    
    if (deepseekApiKey) {
        try {
            const startTime = Date.now();
            await axios.post(deepseekApiUrl, {
                model: 'deepseek-chat',
                messages: [{ role: 'user', content: 'Test' }],
                max_tokens: 5
            }, {
                headers: {
                    'Authorization': `Bearer ${deepseekApiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 2000
            });
            
            const latency = Date.now() - startTime;
            deepseekStatus = `OK (${latency}ms)`;
        } catch (error) {
            deepseekStatus = `Error: ${error.message}`;
        }
    }
    
    res.json({ 
        status: 'OK',
        timestamp: new Date().toISOString(),
        deepseek: deepseekStatus,
        intelligentResponses: 'Activadas',
        fallbackSystem: 'Triple capa'
    });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`🚀 AmericanStor Bot optimizado en puerto ${port}`);
    console.log(`⚡ Sistema híbrido: Respuestas inteligentes + Deepseek + Fallback`);
    console.log(`🎯 Cobertura: 100% de consultas con respuesta natural`);
});
