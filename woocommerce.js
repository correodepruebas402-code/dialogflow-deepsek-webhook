const WooCommerceRestApi = require("@woocommerce/woocommerce-rest-api").default;
require('dotenv').config();

// Configuración de la API de WooCommerce
const wc = new WooCommerceRestApi({
  url: process.env.WOO_STORE_URL,
  consumerKey: process.env.WOO_CONSUMER_KEY,
  consumerSecret: process.env.WOO_CONSUMER_SECRET,
  version: "wc/v3",
  timeout: 12000
});

// Cache para productos y categorías
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000;

/**
 * Formatea los datos del producto para respuesta consistente
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
 * Busca productos en WooCommerce
 */
async function buscarProductos(query, categoryId = null, perPage = 5, filtros = {}) {
  const cacheKey = `buscar-${query}-${categoryId}-${perPage}-${JSON.stringify(filtros)}`;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('Productos desde cache');
    return cached.data;
  }

  try {
    const terminos = query.toLowerCase()
      .replace(/camiseta/g, 'camiseta t-shirt tshirt')
      .replace(/pantalon/g, 'pantalon pants jean')
      .replace(/zapato/g, 'zapato shoe calzado')
      .replace(/perfume/g, 'perfume fragancia colonia');

    let params = {
      search: terminos,
      per_page: perPage,
      status: 'publish'
    };
    
    if (categoryId) {
      params.category = categoryId;
    }

    if (filtros.soloEnStock) {
      params.stock_status = 'instock';
    }
    
    if (filtros.enOferta) {
      params.on_sale = true;
    }

    console.log('Consultando WooCommerce con params:', params);
    const response = await wc.get("products", params);
    let productos = response.data;

    productos = productos.map(formatearProducto);

    cache.set(cacheKey, {
      data: productos,
      timestamp: Date.now()
    });

    return productos;

  } catch (error) {
    console.error('Error al buscar productos en WooCommerce:', error.message);
    return [];
  }
}

/**
 * Obtiene las categorías de productos disponibles
 */
async function obtenerCategorias(perPage = 20) {
  const cacheKey = `categorias-${perPage}`;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const response = await wc.get("products/categories", {
      per_page: perPage,
      hide_empty: true
    });
    
    const categorias = response.data;
    
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

module.exports = {
  buscarProductos,
  obtenerCategorias,
  formatearProducto
};