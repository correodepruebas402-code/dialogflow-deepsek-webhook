# American Store Webhook

**Webhook** Node.js para el chatbot de *American Store*. Integra:
- Dialogflow (Fulfillment)
- WooCommerce (API)
- Deepseek (API de respuestas/IA)

---

## Tabla de contenidos
1. [Descripción general](#descripción-general)  
2. [Pre-requisitos](#pre-requisitos)  
3. [Estructura del proyecto](#estructura-del-proyecto)  
4. [Instalación local](#instalación-local)  
5. [Configuración de variables de entorno (.env)](#configuración-de-variables-de-entorno-env)  
6. [Ejecución y pruebas](#ejecución-y-pruebas)  
7. [Probar webhook (Dialogflow)](#probar-webhook-dialogflow)  
8. [Despliegue en Render](#despliegue-en-render)  
9. [Buenas prácticas de seguridad](#buenas-prácticas-de-seguridad)  
10. [Solución de problemas comunes](#solución-de-problemas-comunes)  
11. [Contribuir](#contribuir)  
12. [Licencia](#licencia)

---

## Descripción general
Este proyecto expone un servidor Express que recibe llamadas desde Dialogflow, consulta productos en WooCommerce y usa Deepseek para respuestas más ricas. Ideal para atención automatizada y ventas.

---

## Pre-requisitos
- Node.js >= 18.x (recomendado)  
- npm (v8+ normalmente)  
- Git (para subir a GitHub)  
- Cuenta en GitHub (para repo)  
- Cuenta en Render (o similar) para producción  
- ngrok (opcional, para testing con Dialogflow si trabajas en local)

---

## Estructura del proyecto
Explicación de los archivos/folders más importantes:

