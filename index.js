const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { WebhookClient, Suggestion } = require('dialogflow-fulfillment');
require('dotenv').config();

const { buscarProductos, obtenerCategorias } = require('./utils/woocommerce/woocommerce');
const { consultarDeepseek } = require('./utils/deepseek/deepseek');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// Middleware de validación básica
const validateRequest = (req, res, next) => {
  if (!req.body || !req.body.queryResult) {
    return res.status(400).json({ error: 'Invalid request structure' });
  }
  next();
};

// Función para manejar errores de manera consistente
const handleError = (agent, error, context = 'operación') => {
  console.error(`Error en ${context}:`, error);
  agent.add(`Disculpa, hay un problema técnico. ¿Puedo ayudarte de otra manera?`);
  agent.add(new Suggestion('Contactar WhatsApp'));
  agent.add(new Suggestion('Ver catálogo'));
};

// Función para formatear respuestas de productos
const formatearProductos = (productos, categoria, emoji = '🛍️') => {
  if (!productos || productos.length === 0) {
    return `No encontré ${categoria} en este momento. ¿Te gustaría ver otras categorías?`;
  }
  
  let respuesta = `${emoji} Encontré estos ${categoria} para ti:\n\n`;
  
  productos.slice(0, 3).forEach((producto, index) => {
    const precio = parseFloat(producto.price) || 0;
    respuesta += `${index + 1}. **${producto.name}**\n`;
    respuesta += `   💰 $${precio.toLocaleString('es-CO')}\n`;
    respuesta += `   📦 ${producto.stock_status === 'instock' ? 'Disponible' : 'Agotado'}\n\n`;
  });
  
  if (productos.length > 3) {
    respuesta += `... y ${productos.length - 3} productos más en nuestra tienda.`;
  }
  
  return respuesta;
};

// Manejador principal del webhook
app.post('/webhook', validateRequest, async (req, res) => {
  console.log('Webhook recibido:', new Date().toISOString());
  console.log('Intención:', req.body.queryResult?.intent?.displayName);
  console.log('Query:', req.body.queryResult?.queryText);
  
  try {
    const agent = new WebhookClient({ request: req, response: res });

    // Función de bienvenida
    function welcome(agent) {
      agent.add('¡Hola! 👋 Soy tu asistente de American Store. ¿Cómo puedo ayudarte hoy con ropa, perfumes, o información de tu pedido?');
      agent.add(new Suggestion('Ver ropa'));
      agent.add(new Suggestion('Ver perfumes'));
      agent.add(new Suggestion('Rastrear mi pedido'));
      agent.add(new Suggestion('Formas de pago'));
    }

    // Función para buscar ropa
    async function buscarRopa(agent) {
      try {
        const tipoRopa = agent.parameters?.ropa_tipo || '';
        const marca = agent.parameters?.['sys.brand'] || '';
        const query = (tipoRopa || marca || 'ropa').toLowerCase().trim();

        // Validar longitud de query
        if (query.length > 100) {
          agent.add('La búsqueda es muy específica. ¿Puedes ser más breve?');
          return;
        }

        console.log(`Buscando ropa con query: "${query}"`);
        const productos = await Promise.race([
          buscarProductos(query),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 10000)
          )
        ]);

        if (productos && productos.length > 0) {
          const respuestaFormateada = formatearProductos(productos, query, '👕');
          agent.add(respuestaFormateada);
          agent.add(new Suggestion('¿Tienen tallas grandes?'));
          agent.add(new Suggestion('¿Cuál es el costo de envío?'));
        } else {
          agent.add(`No encontré productos de "${query}" en este momento. ¿Te gustaría ver nuestras categorías principales?`);
          agent.add(new Suggestion('Ver camisetas'));
          agent.add(new Suggestion('Ver chaquetas'));
          agent.add(new Suggestion('Contactar asesor'));
        }
      } catch (error) {
        handleError(agent, error, 'búsqueda de ropa');
      }
    }

    // Función para buscar perfumes
    async function buscarPerfumes(agent) {
      try {
        const tipoPerfume = agent.parameters?.perfume_tipo || '';
        const marca = agent.parameters?.marcas_perfumes || '';
        const genero = agent.parameters?.['sys.gender'] || '';
        const query = (tipoPerfume || marca || genero || 'perfumes').toLowerCase().trim();

        console.log(`Buscando perfumes con query: "${query}"`);
        const productos = await Promise.race([
          buscarProductos(query),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 10000)
          )
        ]);

        if (productos && productos.length > 0) {
          const respuestaFormateada = formatearProductos(productos, query, '✨');
          agent.add(respuestaFormateada);
          agent.add(new Suggestion('¿Qué significa réplica 1:1?'));
          agent.add(new Suggestion('¿Cuánto duran los perfumes?'));
        } else {
          // Fallback a Deepseek para información general
          try {
            const deepseekRes = await consultarDeepseek(
              `Dame información sobre ${query} en perfumes o recomienda algunos.`
            );
            agent.add(deepseekRes);
            agent.add('También puedes explorar nuestra sección de perfumes en la web.');
          } catch (deepseekError) {
            agent.add(`No encontré perfumes de "${query}" en este momento, pero puedes contactar a un asesor para recomendaciones personalizadas.`);
            agent.add(new Suggestion('Contactar WhatsApp'));
          }
        }
      } catch (error) {
        handleError(agent, error, 'búsqueda de perfumes');
      }
    }

    // Función para consultar políticas
    async function consultarPoliticas(agent) {
      try {
        const consulta = agent.query;
        console.log(`Consultando políticas para: "${consulta}"`);
        
        const deepseekRes = await Promise.race([
          consultarDeepseek(consulta),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 15000)
          )
        ]);
        
        agent.add(deepseekRes);
        agent.add(new Suggestion('¿Tienen pago contra entrega?'));
        agent.add(new Suggestion('¿Cómo hago un cambio?'));
      } catch (error) {
        handleError(agent, error, 'consulta de políticas');
        agent.add('Puedes encontrar información detallada en nuestro sitio web o contactar a un asesor.');
      }
    }

    // Función para rastrear pedidos
    async function rastrearPedido(agent) {
      try {
        const numeroPedido = agent.parameters?.['sys.number'];
        
        if (numeroPedido) {
          agent.add(`🔍 Para rastrear tu pedido #${numeroPedido}:`);
          agent.add('1. Revisa el correo que te enviamos con el número de guía');
          agent.add('2. Ingresa el número en el sitio web de la transportadora');
          agent.add('3. Si no lo encuentras, nuestro asesor te ayudará por WhatsApp');
          agent.add(new Suggestion('Contactar WhatsApp'));
        } else {
          agent.add('📦 Para rastrear tu pedido necesito:');
          agent.add('• El número de pedido, O');
          agent.add('• El número de guía de envío');
          agent.add('¿Me puedes proporcionar alguno de estos números?');
          agent.add(new Suggestion('No tengo el número'));
          agent.add(new Suggestion('Hablar con asesor'));
        }
      } catch (error) {
        handleError(agent, error, 'rastreo de pedido');
      }
    }

    // Función para contacto WhatsApp
    async function contactarWhatsApp(agent) {
      agent.add('📱 ¡Perfecto! Puedes chatear directamente con uno de nuestros asesores:');
      agent.add('👥 **WhatsApp:** +57 320 890 0000');
      agent.add('🔗 **Enlace directo:** https://wa.me/573208900000');
      agent.add('⏰ **Horario:** Lunes a Sábado de 8:00 AM a 6:00 PM');
      agent.add(new Suggestion('Volver al menú principal'));
    }

    // Función fallback mejorada
    async function fallback(agent) {
      try {
        const preguntaUsuario = agent.query;
        console.log(`Fallback activado para: "${preguntaUsuario}"`);
        
        const deepseekRes = await Promise.race([
          consultarDeepseek(
            preguntaUsuario, 
            `El usuario preguntó: "${preguntaUsuario}". Dialogflow no identificó una intención específica. Proporciona una respuesta útil basada en las políticas de American Store.`
          ),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 12000)
          )
        ]);
        
        agent.add(deepseekRes);
        agent.add('¿Hay algo más en lo que pueda ayudarte?');
        agent.add(new Suggestion('Ver ropa'));
        agent.add(new Suggestion('Ver perfumes'));
        agent.add(new Suggestion('Contactar WhatsApp'));
      } catch (error) {
        console.error('Error en fallback:', error);
        agent.add('No estoy seguro de cómo ayudarte con eso específicamente, pero nuestros asesores pueden darte una respuesta más detallada.');
        agent.add(new Suggestion('Contactar WhatsApp'));
        agent.add(new Suggestion('Ver catálogo'));
      }
    }

    // Mapeo de intenciones
    const intentMap = new Map();
    
    // Intenciones básicas
    intentMap.set('Default Welcome Intent', welcome);
    intentMap.set('Default Fallback Intent', fallback);
    
    // Intenciones de ropa
    intentMap.set('Ropa_Consulta_General', buscarRopa);
    intentMap.set('Ropa_Por_Categoria', buscarRopa);
    intentMap.set('Ropa_Por_Marca', buscarRopa);
    intentMap.set('Ropa_Tallas_Consulta', consultarPoliticas);
    intentMap.set('Ropa_Disponibilidad', buscarRopa);
    
    // Intenciones de calidad/originalidad
    intentMap.set('Productos_Originales_Confirmacion', consultarPoliticas);
    intentMap.set('Duda_Originalidad', consultarPoliticas);
    intentMap.set('Desconfianza_Calidad', consultarPoliticas);
    
    // Intenciones de perfumes
    intentMap.set('Perfumes_Consulta_General', buscarPerfumes);
    intentMap.set('Perfumes_Marca_Especifica', buscarPerfumes);
    intentMap.set('Perfumes_Por_Genero', buscarPerfumes);
    intentMap.set('Perfumes_Por_Tipo', buscarPerfumes);
    intentMap.set('Perfumes_Durabilidad', consultarPoliticas);
    intentMap.set('Perfumes_Originales_vs_Replicas', consultarPoliticas);
    intentMap.set('Perfumes_Recomendacion_Personal', consultarPoliticas);
    intentMap.set('Qué_es_Dior_Sauvage', consultarPoliticas);
    
    // Intenciones de compra
    intentMap.set('Quiero_Este_Producto', buscarRopa);
    intentMap.set('Comparacion_Precios', consultarPoliticas);
    intentMap.set('Listo_Para_Comprar', consultarPoliticas);
    intentMap.set('Proceso_Compra_Paso_a_Paso', consultarPoliticas);
    
    // Intenciones de pedidos
    intentMap.set('Estado_Pedido', rastrearPedido);
    intentMap.set('Rastreo_Envio', rastrearPedido);
    
    // Intenciones de pagos
    intentMap.set('Pagos_Formas', consultarPoliticas);
    intentMap.set('Pagos_Contra_Entrega', consultarPoliticas);
    intentMap.set('Separar_Producto', consultarPoliticas);
    
    // Intenciones de envíos
    intentMap.set('Envios_Info_General', consultarPoliticas);
    intentMap.set('Envios_Ciudades_Disponibles', consultarPoliticas);
    intentMap.set('Envios_Costo', consultarPoliticas);
    intentMap.set('Envio_sin_cobertura', consultarPoliticas);
    
    // Intenciones de políticas
    intentMap.set('Politicas_Tienda', consultarPoliticas);
    intentMap.set('Cambios_Devoluciones', consultarPoliticas);
    intentMap.set('Garantia_Productos', consultarPoliticas);
    intentMap.set('Miedo_Envio', consultarPoliticas);
    intentMap.set('Precio_Alto', consultarPoliticas);
    
    // Contacto
    intentMap.set('Contacto_WhatsApp', contactarWhatsApp);

    // Procesar la solicitud
    agent.handleRequest(intentMap);

  } catch (error) {
    console.error('Error crítico en webhook:', error);
    res.status(500).json({
      fulfillmentText: 'Error interno del servidor. Por favor, intenta más tarde.',
      fulfillmentMessages: [{
        text: { text: ['Error interno del servidor. Por favor, intenta más tarde.'] }
      }]
    });
  }
});

// Endpoint de salud
app.get('/health', async (req, res) => {
  try {
    console.log('Iniciando health check...');
    
    // Verificar conexión WooCommerce
    let woocommerceStatus = 'ERROR';
    let woocommerceError = null;
    
    try {
      const categorias = await obtenerCategorias(1);
      woocommerceStatus = Array.isArray(categorias) && categorias.length >= 0 ? 'OK' : 'ERROR';
      console.log('WooCommerce check:', woocommerceStatus, 'Categorías encontradas:', categorias.length);
    } catch (error) {
      woocommerceError = error.message;
      console.log('Error WooCommerce:', error.message);
    }
    
    // Verificar configuración Deepseek
    const deepseekConfigured = process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_BASE_URL;
    
    const response = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        woocommerce: {
          status: woocommerceStatus,
          configured: !!(process.env.WOO_STORE_URL && process.env.WOO_CONSUMER_KEY && process.env.WOO_CONSUMER_SECRET),
          error: woocommerceError
        },
        deepseek: {
          status: deepseekConfigured ? 'CONFIGURED' : 'NOT_CONFIGURED',
          configured: deepseekConfigured
        }
      },
      environment: {
        port: process.env.PORT || 3000,
        node_version: process.version
      }
    };
    
    console.log('Health check response:', JSON.stringify(response, null, 2));
    res.json(response);
    
  } catch (error) {
    console.error('Error en health check:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Ruta de prueba
app.get('/', (req, res) => {
  res.send(`
    <h1>🛍️ American Store Webhook</h1>
    <p><strong>Estado:</strong> ✅ Funcionando correctamente</p>
    <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
    <p><strong>Version:</strong> 1.0.0</p>
    <hr>
    <p><a href="/health">🔍 Health Check</a></p>
  `);
});

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Manejo global de errores
app.use((error, req, res, next) => {
  console.error('Error no capturado:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log('🚀 ======================================');
  console.log(`📱 American Store Webhook INICIADO`);
  console.log(`🌐 Puerto: ${PORT}`);
  console.log(`⏰ Tiempo: ${new Date().toISOString()}`);
  console.log('🔗 Endpoints disponibles:');
  console.log(`   - GET  /       : Página de estado`);
  console.log(`   - GET  /health : Health check`);
  console.log(`   - POST /webhook: Webhook principal`);
  console.log('🚀 ======================================');
});

// Manejo graceful de cierre del servidor
process.on('SIGTERM', () => {
  console.log('🛑 Recibida señal SIGTERM, cerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Recibida señal SIGINT, cerrando servidor...');
  process.exit(0);
});