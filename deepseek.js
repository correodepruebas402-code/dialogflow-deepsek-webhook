const axios = require('axios');
require('dotenv').config();
const { tiendaFAQs } = require('../../data/faqs'); // Ruta corregida

// Configuración de la API
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_BASE_URL = process.env.DEEPSEEK_API_BASE_URL || 'https://api.deepseek.com/v1';

// Validar configuración
if (!DEEPSEEK_API_KEY) {
  console.error('⚠️  DEEPSEEK_API_KEY no está configurada en .env');
}

// Cache simple para respuestas comunes (opcional)
const responseCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos

/**
 * Consulta a la API de Deepseek con manejo robusto de errores
 * @param {string} preguntaUsuario - La pregunta del usuario
 * @param {string} contextoAdicional - Contexto adicional opcional
 * @returns {Promise<string>} - La respuesta formateada
 */
async function consultarDeepseek(preguntaUsuario, contextoAdicional = '') {
  // Validación de entrada
  if (!preguntaUsuario || typeof preguntaUsuario !== 'string') {
    return 'Lo siento, no pude procesar tu consulta. ¿Puedes reformular la pregunta?';
  }

  // Limpiar y truncar la pregunta si es muy larga
  const preguntaLimpia = preguntaUsuario.trim().substring(0, 500);
  
  // Verificar cache (opcional)
  const cacheKey = `${preguntaLimpia}_${contextoAdicional}`.substring(0, 100);
  const cached = responseCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    console.log('📋 Respuesta obtenida desde cache');
    return cached.response;
  }

  // Construir el prompt del sistema
  const systemPrompt = `Eres un asistente de ventas experto para American Store, una tienda online colombiana especializada en ropa importada original de Estados Unidos y perfumes réplica de alta calidad.

**Tu personalidad:**
- Amigable, profesional y orientado al cliente
- Conocedor de productos de moda y fragancias
- Empático con las dudas sobre compras online
- Conciso pero completo en tus respuestas (máximo 280 caracteres cuando sea posible)

**Información clave de American Store:**
${tiendaFAQs}

**Instrucciones específicas:**
1. SIEMPRE mantén un tono amigable y profesional
2. Si no tienes información específica, sugiere contactar al asesor por WhatsApp
3. Para preguntas de stock específico, dirige a la tienda online
4. Enfatiza la calidad y originalidad de los productos
5. Tranquiliza sobre seguridad de envíos y pagos
6. NO inventes información que no esté en el contexto
7. Si la pregunta es muy general, ofrece opciones específicas

${contextoAdicional ? `\n**Contexto adicional:** ${contextoAdicional}` : ''}`;

  const messages = [
    {
      role: "system",
      content: systemPrompt
    },
    {
      role: "user", 
      content: preguntaLimpia
    }
  ];

  try {
    console.log(`🤖 Consultando Deepseek para: "${preguntaLimpia.substring(0, 50)}..."`);
    
    const response = await axios.post(
      `${DEEPSEEK_API_BASE_URL}/chat/completions`,
      {
        model: "deepseek-chat",
        messages: messages,
        temperature: 0.7,
        max_tokens: 400,
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          'User-Agent': 'American-Store-Webhook/1.0'
        },
        timeout: 15000, // 15 segundos timeout
        validateStatus: function (status) {
          return status < 500; // Resuelve solo si el status es menor a 500
        }
      }
    );

    // Verificar respuesta exitosa
    if (response.status !== 200) {
      throw new Error(`API respondió con status ${response.status}: ${response.data?.error?.message || 'Error desconocido'}`);
    }

    // Extraer y limpiar la respuesta
    const respuestaIA = response.data?.choices?.[0]?.message?.content;
    
    if (!respuestaIA) {
      throw new Error('Respuesta vacía de la API');
    }

    // Limpiar y formatear la respuesta
    let respuestaFormateada = respuestaIA
      .trim()
      .replace(/\n{3,}/g, '\n\n') // Reducir múltiples saltos de línea
      .replace(/American Store/gi, 'American Store') // Consistencia en el nombre
      .substring(0, 800); // Limitar longitud máxima

    // Añadir emoji si no tiene ninguno y es apropiado
    if (!/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(respuestaFormateada)) {
      if (respuestaFormateada.toLowerCase().includes('perfume')) {
        respuestaFormateada = '✨ ' + respuestaFormateada;
      } else if (respuestaFormateada.toLowerCase().includes('ropa')) {
        respuestaFormateada = '👕 ' + respuestaFormateada;
      } else if (respuestaFormateada.toLowerCase().includes('envío')) {
        respuestaFormateada = '📦 ' + respuestaFormateada;
      } else if (respuestaFormateada.toLowerCase().includes('pago')) {
        respuestaFormateada = '💳 ' + respuestaFormateada;
      }
    }

    // Guardar en cache
    responseCache.set(cacheKey, {
      response: respuestaFormateada,
      timestamp: Date.now()
    });

    // Limpiar cache periódicamente
    if (responseCache.size > 100) {
      const oldestKeys = Array.from(responseCache.keys()).slice(0, 20);
      oldestKeys.forEach(key => responseCache.delete(key));
    }

    console.log('✅ Respuesta exitosa de Deepseek');
    return respuestaFormateada;

  } catch (error) {
    console.error('❌ Error al consultar Deepseek:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });

    // Respuestas de error específicas según el tipo de error
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return 'Estamos experimentando problemas de conexión. Por favor, contacta a nuestro asesor por WhatsApp para obtener ayuda inmediata.';
    }
    
    if (error.response?.status === 401) {
      console.error('🔑 Error de autenticación con Deepseek API');
      return 'Disculpa, hay un problema técnico con el sistema. Nuestro asesor por WhatsApp te puede ayudar de inmediato.';
    }
    
    if (error.response?.status === 429) {
      return 'El sistema está muy ocupado en este momento. ¿Podrías intentar en unos minutos o contactar a nuestro asesor?';
    }
    
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return 'La consulta está tomando más tiempo del esperado. Para una respuesta rápida, contacta a nuestro asesor por WhatsApp.';
    }

    // Error genérico
    return 'No pude procesar tu consulta en este momento. Para obtener ayuda personalizada, puedes contactar a nuestro asesor por WhatsApp. ¿Hay algo más en lo que pueda ayudarte?';
  }
}

/**
 * Función auxiliar para limpiar cache manualmente
 */
function limpiarCache() {
  responseCache.clear();
  console.log('🗑️  Cache de Deepseek limpiado');
}

/**
 * Función auxiliar para obtener estadísticas del cache
 */
function obtenerEstadisticasCache() {
  return {
    entradas: responseCache.size,
    memoriaAprox: JSON.stringify([...responseCache.entries()]).length,
    ttl: CACHE_TTL
  };
}

module.exports = {
  consultarDeepseek,
  limpiarCache,
  obtenerEstadisticasCache
};