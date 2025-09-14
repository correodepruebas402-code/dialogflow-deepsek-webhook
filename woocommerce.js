const WooCommerceAPI = require('woocommerce-api');
require('dotenv').config();

// Configuración de la API de WooCommerce
const wc = new WooCommerceAPI({
  url: process.env.WOO_STORE_URL,
  consumerKey: process.env.WOO_CONSUMER_KEY,
  consumerSecret: process.env.WOO_CONSUMER_SECRET,
  version: 'wc/v3',
  queryStringAuth: true,
  timeout: 12000 // 12 segundos timeout
});

// Cache para productos y categorías
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

/**
 * Formatea los datos del producto para respuesta consistente
 * @param {Object} producto - Producto de WooCommerce
 * @returns {Object} - Producto formateado
 */
function formatearProducto(producto) {
  return {
    id: producto.id,
    name: producto.name ? producto.name.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>') : 'Sin nombre',
    price: parseFloat(producto.price) || 0,
    regular_price: parseFloat(producto.regular_price) || 0,
    sale_price: parseFloat(producto.sale_price) || null,
    stock_status: producto.stock_status,
    stock_quantity: producto.stock_quantity,
    on_sale: producto.on_sale,
    permalink: producto.permalink,
    short_description: producto.short_description ? producto.short_description.replace(/<[^>]*>/g, '').substring(0, 200) : '',
    images: producto.images && producto.images.length > 0 ? producto.images[0].src : null,
    categories: producto.categories ? producto.categories.map(cat => cat.name) : [],
    tags: producto.tags ? producto.tags.map(tag => tag.name) : []
  };
}

/**
 * Filtra productos según criterios específicos
 * @param {Array} productos - Array de productos
 * @param {Object} filtros - Filtros a aplicar
 * @returns {Array} - Productos filtrados
 */
function filtrarProductos(productos, filtros = {}) {
  return productos.filter(producto => {
    // Solo productos en stock
    if (filtros.soloEnStock && producto.stock_status !== 'instock') {
      return false;
    }
    
    // Filtro por precio mínimo
    if (filtros.precioMin && parseFloat(producto.price) < filtros.precioMin) {
      return false;
    }
    
    // Filtro por precio máximo
    if (filtros.precioMax && parseFloat(producto.price) > filtros.precioMax) {
      return false;
    }
    
    // Solo productos en oferta
    if (filtros.enOferta && !producto.on_sale) {
      return false;
    }
    
    return true;
  });
}

/**
 * Busca productos en WooCommerce con filtros opcionales
 * @param {string} query - Término de búsqueda
 * @param {number|null} categoryId - ID de categoría (opcional)
 * @param {number} perPage - Número de productos por página
 * @param {Object} filtros - Filtros adicionales
 * @returns {Promise<Array>} - Array de productos encontrados
 */
async function buscarProductos(query, categoryId = null, perPage = 5, filtros = {}) {
  const cacheKey = `buscar-${query}-${categoryId}-${perPage}-${JSON.stringify(filtros)}`;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('Productos desde cache');
    return cached.data;
  }

  try {
    // Mejorar términos de búsqueda
    const terminos = query.toLowerCase()
      .replace(/camiseta/g, 'camiseta t-shirt tshirt')
      .replace(/pantalon/g, 'pantalon pants jean')
      .replace(/zapato/g, 'zapato shoe calzado')
      .replace(/perfume/g, 'perfume fragancia colonia');

    let endpoint = `products?search=${encodeURIComponent(terminos)}&per_page=${perPage}&status=publish`;
    
    if (categoryId) {
      endpoint += `&category=${categoryId}`;
    }

    // Filtros adicionales en la URL
    if (filtros.soloEnStock) {
      endpoint += '&stock_status=instock';
    }
    
    if (filtros.enOferta) {
      endpoint += '&on_sale=true';
    }

    if (filtros.ordenarPor) {
      endpoint += `&orderby=${filtros.ordenarPor}`;
      endpoint += `&order=${filtros.orden || 'asc'}`;
    }

    console.log('Consultando WooCommerce:', endpoint);
    const response = await wc.get(endpoint);
    let productos = JSON.parse(response.body);

    // Formatear productos
    productos = productos.map(formatearProducto);

    // Aplicar filtros adicionales
    if (filtros.precioMin || filtros.precioMax) {
      productos = filtrarProductos(productos, filtros);
    }

    // Guardar en cache
    cache.set(cacheKey, {
      data: productos,
      timestamp: Date.now()
    });

    return productos;

  } catch (error) {
    console.error('Error al buscar productos en WooCommerce:', error.message);
    
    if (error.response && error.response.data) {
      console.error('Detalles del error:', error.response.data);
    }
    
    return [];
  }
}

/**
 * Obtiene un producto específico por su ID
 * @param {number} productId - ID del producto
 * @returns {Promise<Object|null>} - Producto encontrado o null
 */
async function obtenerProductoPorId(productId) {
  const cacheKey = `producto-${productId}`;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const response = await wc.get(`products/${productId}`);
    const producto = formatearProducto(JSON.parse(response.body));
    
    cache.set(cacheKey, {
      data: producto,
      timestamp: Date.now()
    });
    
    return producto;
  } catch (error) {
    console.error('Error al obtener producto por ID:', error.message);
    return null;
  }
}

/**
 * Obtiene las categorías de productos disponibles
 * @param {number} perPage - Número de categorías por página
 * @returns {Promise<Array>} - Array de categorías
 */
async function obtenerCategorias(perPage = 20) {
  const cacheKey = `categorias-${perPage}`;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const response = await wc.get(`products/categories?per_page=${perPage}&hide_empty=true`);
    const categorias = JSON.parse(response.body);
    
    const categoriasFormateadas = categorias.map(cat => ({
      id: cat.id,
      name: cat.name,
      count: cat.count,
      slug: cat.slug
    }));
    
    cache.set(cacheKey, {
      data: categoriasFormateadas,
      timestamp: Date.now()
    });
    
    return categoriasFormateadas;
  } catch (error) {
    console.error('Error al obtener categorías:', error.message);
    return [];
  }
}

/**
 * Búsqueda avanzada con múltiples criterios
 * @param {Object} criterios - Criterios de búsqueda
 * @returns {Promise<Array>} - Productos encontrados
 */
async function busquedaAvanzada(criterios) {
  const {
    query = '',
    categoria = null,
    precioMin = null,
    precioMax = null,
    enOferta = false,
    soloEnStock = true,
    ordenarPor = 'date',
    orden = 'desc',
    perPage = 10
  } = criterios;

  return await buscarProductos(query, categoria, perPage, {
    precioMin,
    precioMax,
    enOferta,
    soloEnStock,
    ordenarPor,
    orden
  });
}

module.exports = {
  buscarProductos,
  obtenerProductoPorId,
  obtenerCategorias,
  busquedaAvanzada,
  formatearProducto,
  filtrarProductos
};