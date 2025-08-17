'use strict';

// Importar las librerías necesarias
const express = require('express');
const axios = require('axios');
const { WebhookClient } = require('dialogflow-fulfillment');
require('dotenv').config(); // Carga las variables de entorno desde el archivo .env

// Crear la aplicación de Express
const app = express();
app.use(express.json()); // Middleware para parsear el cuerpo de las solicitudes como JSON

// Obtener la clave de API desde las variables de entorno
const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
const deepseekApiUrl = 'https://api.deepseek.com/v1/chat/completions'; // URL de la API de Deepseek

// Endpoint principal para el webhook de Dialogflow
app.post('/webhook', (request, response) => {
  const agent = new WebhookClient({ request, response });

  // Función para manejar la lógica de la conversación con Deepseek
  async function handleDeepseekQuery(agent) {
    const userQuery = agent.query; // La pregunta del usuario
    console.log(`Consulta del usuario: ${userQuery}`);

    // Aquí puedes agregar el contexto de tu tienda (del PDF)
    const knowledgeBaseContext = `
      Eres un asistente virtual para una tienda. Utiliza la siguiente información para responder:
      %PDF-1.3
%ÿÿÿÿ
7 0 obj
<<
/Type /Page
/Parent 1 0 R
/MediaBox [0 0 612 792]
/Contents 5 0 R
/Resources 6 0 R
>>
endobj
6 0 obj
<<
/ProcSet [/PDF /Text /ImageB /ImageC /ImageI]
/Font <<
/F2 8 0 R
/F1 9 0 R
>>
/ColorSpace <<
>>
>>
endobj
5 0 obj
<<
/Length 1231
/Filter /FlateDecode
>>
stream
xœ­X»Ž#7Ìõü£›ý‚vàÌðf†a‘7päß7º9£™]êönÖ—)M«««›*	¤/%A²Ši|½üs)ÝÚÏ/ëbI¥Hf  K†–•ÓËëå§_1!¤—åòç•Q‹‘
‚²¿2é¢³.JZuÒª¢³±.8!pÑIÅP«’„|×På–à¯ôòÛå——Ëïß‚…hYD 8i­¹`ƒURÙ`™öP7_»jQÖ…î·$®THq¡BBÈèN…˜îDÄ·D’®8ß’BºÞA'ÿè¿TˆsÒë… 3‚ÕJÛÚß—?¾}$¤
¹n]ÏRuV½9å× jÒâô.äî'Õ¢ã–µ øÙ!]…[”µœaÙ!gf~Ð‹+$Ïð¤èyÛIÝ²{K_Š¤ëÿM²‡GÈbØ…_œr>Z8†t5v%:šs!@³½€Ðôêd)™l:–E{ia!z¦øÖb„àïu1ð´øëþkv6·o{ã·þœ{#oý\Øøôœqß<IƒTÌ_%ÂÂúôw;«ÑJDŽŠª8S% 8‹Ë†\E¿ŠËkaT1—¸'…Èº=
{:¤‰7ëz›æ³(U2}™ˆÎ­nMçéè?ïwœáÆàIÖzë¢Üø5¶ý4“Á‘ý³È¥d,]…	Ü7q{~Ï—•eêñN¡fµpH•‡“ÕÞ"qÒ4®Ñ9Þ‚9)³vÂ·@½‡<Š‘,aªbNtÑÏy‰@ÍR;±VÁõ|¢žÒÓ.ÌU²aÇ¦?×Enn¯bÈgâ³OJ¤“Àöt/
cÏØÙçªåÚ/6¸}ûÐCžnG½2.dQ/ÑÛ|WL¯#..–ð…ªãó^M¢¹²7k¤šA¤Ãcñ{»5»Â÷èÑ­)*WšcÎÓîˆ.d?VëãÊ&ÚúâÙšåR²Z'3*Ûœc˜·Û*ð®Í,Ç¶aa‘Í.ÏÂ¡jy€N„;yô¾½–IÇ˜ý½ÞK3Â€çþxÒ@¹R'i¢
Ç…Írš!éèŸß·l>py›A†>yüÚA<æ# ÄÈC?ž$ÎÂÍeèÊ•äÅÝ‡çpÉ1f}9`ôÚüSŽ¸~$NÆL¥çOüÝU£§´~„ûllžMÃdo9’u0U5‰ùŒüÂ3õ}*ülü¥ápVïZãË›‚~æ*á}R “¨{_ñÙÞj}¬}¯õ¡—×6”íÖ÷àyÑqžbì¢ÈöÃü´Úv‘‰+LÓÊIVP†Œ}Go7ÏÈoØêéîÌ™úî½šLmÐU9rgcdé;ùcø–J$:Îõq×‰‹õçCÍÚ·ùívIëøuK_ÂeÞ\2­øhwÑÖ¡«ßPtúÔpˆ€ÙúÉ ‰øüãÊ0ä
Ï1mÖ³
µaÞ®çƒ™d N%Žì_9D”ŸrÍCÅ=,)þ?Á¶ø½õW˜3wÿ|\~ð–Ül×Óè3ˆ»Å§ì°”![ße×¿¦ÖIß[ÿJROËŒƒù´¬pútˆiØ‹_Âý„kä&ä£Qr»ÌžŠY!×¾U2-¤q—ûàŒ§â˜åÒ·ºjHJûŽöQƒ>—IýVªþïp; 
endstream
endobj
12 0 obj
<<
/Type /Page
/Parent 1 0 R
/MediaBox [0 0 612 792]
/Contents 10 0 R
/Resources 11 0 R
>>
endobj
11 0 obj
<<
/ProcSet [/PDF /Text /ImageB /ImageC /ImageI]
/Font <<
/F1 9 0 R
/F2 8 0 R
>>
/ColorSpace <<
>>
>>
endobj
10 0 obj
<<
/Length 1080
/Filter /FlateDecode
>>
stream
xœ½X½Žó6ìý|áþ‹ÀÁE€¤Häº ÅA«\‘*¯ìR’åÓÝ}''H#´IîÌÎÎ®©¤’¾A*É*¦ñõò×k?>/‹¤$#Ê4pz~½üð3$ÀôÜ.¿?	ªiÓÑDIk#éåê;ž°\Sù#=ÿrùéùòëWî€šÅO¾¿ƒýüYY«ßŸÅÈo9wz‘¬ ,:_–ôd:OÚ°(«ôç5Q¬_Jzú@j…l:ã°AÉo°7 ?¸åï‹”D4½^ j&´Ze]ûóòÛ×âQÈ é˜@÷¤+(k;‹’$ó‘íKég?FEÈR"Á‚',¦Z°˜é `l¤`ÅÊI"²x"Uª$gc(–í‚‰Š¾8,i†êbtÒö P©”>å*Vs5}ƒR Bê#ÈT3”ƒ8VdJÚƒ¿vC£ ¬“Vµ^”ôëÍKÄ$¾þ
\c5Âœ-ôëËqÐµ5ÆA§éÌHkÏCÖîˆ«<,n0¤ôOî&ódÝÔ`s;b±XýÜ‰VŸ8‹ƒ†LÇ¬{¯ÜŸ;9óð±býÔqG‘ßNê5lJÉÌn{ƒe$¨ÕÖµ¯Ú{uÙÑö ôý€çIÉ<äÈE2baôµ“ä°Ž
” çkÒÅãÑkyQ+¹2˜­†™Ì=·,¼©M'OßNg½1KƒU]û¦>O´šï,Ý¸°p×ëBmŽÍ£?Ùî!½„ëÔm½çÔ<´.ö³Äg:v}Â/ãP"A¬‹Û>Hƒç>¦ŒÞœd-J&/Ô{_Ùª“ÅÈŠöj„Ó•Èª}‹Nc—0T³úú[Öl°Ò¥Ýš÷qzªKWD7[,KðêQ[]x½œN>j–ã4D|ž fá>É=–þ==B*Êá±=;É{ë•è+§ñf­ë%y¯õö6.‚ôŽÕ¢úÛ®B±øµéáÕ®_o}Ÿ×Âw¹´Ü~JÿþLô_û¾(€—Nº‚½è4O>NŸ¢„ê<Ö€Þ(!G5-÷FÓë1s¿wIâ÷ÒÎ½é›¶»êöI­õ©#ØüP :ÍRƒ¥‹ú{¶KÒÀ¹ÊÑïì†—Û¾
×ìG5¾­o3µ16Ÿ”ÿ]'Zž{3¤XÛbàk\ˆa$Œp‘úpã‡U=ÿò@¹=aØ#µ’kU¼©-9ªX¿«Œe†Ü&J\4=
ÚEìõ@Ú®‰ñ;{m™ìí“{A[_Ùòü€w’XÆwxª÷<Eþn€¢Mß5 \†fúŽuÞìïšXzì_»î¿Õôú¼å»çbã¬k¦¿r†jº¹¾“ÖGäÄ”é8îP¹cÊ/¥­³a4Ìõ®±à@H…
	~­ÓŽ>¾Ç@Y—$Hü›q•„Œ!^´c¬Œéû^
ÿ ÕE¸f
endstream
endobj
14 0 obj
(PDFKit)
endobj
15 0 obj
(PDFKit)
endobj
16 0 obj
(D:20250817001434Z)
endobj
13 0 obj
<<
/Producer 14 0 R
/Creator 15 0 R
/CreationDate 16 0 R
>>
endobj
9 0 obj
<<
/Type /Font
/BaseFont /Helvetica
/Subtype /Type1
/Encoding /WinAnsiEncoding
>>
endobj
8 0 obj
<<
/Type /Font
/BaseFont /Helvetica-Bold
/Subtype /Type1
/Encoding /WinAnsiEncoding
>>
endobj
4 0 obj
<<
>>
endobj
3 0 obj
<<
/Type /Catalog
/Pages 1 0 R
/Names 2 0 R
>>
endobj
1 0 obj
<<
/Type /Pages
/Count 2
/Kids [7 0 R 12 0 R]
>>
endobj
2 0 obj
<<
/Dests <<
  /Names [
]
>>
>>
endobj
xref
0 17
0000000000 65535 f 
0000003363 00000 n 
0000003427 00000 n 
0000003301 00000 n 
0000003280 00000 n 
0000000236 00000 n 
0000000119 00000 n 
0000000015 00000 n 
0000003178 00000 n 
0000003081 00000 n 
0000001765 00000 n 
0000001647 00000 n 
0000001540 00000 n 
0000003005 00000 n 
0000002919 00000 n 
0000002944 00000 n 
0000002969 00000 n 
trailer
<<
/Size 17
/Root 3 0 R
/Info 13 0 R
/ID [<a9006ecf89fbf8675427d284d9132207> <a9006ecf89fbf8675427d284d9132207>]
>>
startxref
3474
%%EOF

      ---
      Ahora, responde a la siguiente pregunta del cliente de la manera más útil posible.
    `;

    try {
      // Llamada a la API de Deepseek
      const apiResponse = await axios.post(deepseekApiUrl, {
        model: 'deepseek-chat', // O el modelo que prefieras
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

      // Extraer la respuesta del modelo
      const botResponse = apiResponse.data.choices[0].message.content;

      // Enviar la respuesta a Dialogflow
      agent.add(botResponse);

    } catch (error) {
      console.error('Error al llamar a la API de Deepseek:', error.response ? error.response.data : error.message);
      agent.add('Lo siento, algo salió mal y no puedo procesar tu solicitud en este momento.');
    }
  }

  // Mapeo de intents a funciones
  let intentMap = new Map();
  // Este intent se activará para todas las consultas que no coincidan con otros intents definidos en Dialogflow.
  // Asegúrate de que el "Default Fallback Intent" en Dialogflow tenga el webhook habilitado.
  intentMap.set('Default Fallback Intent', handleDeepseekQuery);

  agent.handleRequest(intentMap);
});

// Iniciar el servidor
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}`);
});


