'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 4310;
const MAX_BODY_BYTES = 256 * 1024;
const MAX_TEXT_LENGTH = 2400;
const AREAS = new Set(['FA', 'REWORK', 'CALIDAD', 'PROCESOS', 'MANUFACTURA', 'PRUEBAS', 'POR REVISAR']);
const STATIC_FILES = new Map([
  ['/', { file: 'rcca-dashboard.html', type: 'text/html; charset=utf-8' }],
  ['/index.html', { file: 'index.html', type: 'text/html; charset=utf-8' }],
  ['/rcca-dashboard.html', { file: 'rcca-dashboard.html', type: 'text/html; charset=utf-8' }],
  ['/rcca-domain.js', { file: 'rcca-domain.js', type: 'text/javascript; charset=utf-8' }],
  ['/rcca-detail-table.js', { file: 'rcca-detail-table.js', type: 'text/javascript; charset=utf-8' }],
  ['/ingrasys-emblem.png', { file: 'ingrasys-emblem.png', type: 'image/png' }]
]);

function jsonResponse(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(JSON.stringify(data));
}

function providerConfig() {
  const baseUrl = String(process.env.AI_BASE_URL || '').trim();
  const model = String(process.env.AI_MODEL || '').trim();
  let validUrl = false;
  try {
    const parsed = new URL(baseUrl);
    validUrl = parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {}
  return { baseUrl, model, apiKey: String(process.env.AI_API_KEY || ''), configured: validUrl && Boolean(model) };
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES && !tooLarge) {
        tooLarge = true;
        reject(Object.assign(new Error('La solicitud excede el límite permitido.'), { statusCode: 413 }));
      }
      if (!tooLarge) chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) return;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(Object.assign(new Error('El cuerpo debe ser JSON válido.'), { statusCode: 400 })); }
    });
    req.on('error', reject);
  });
}

function endpointUrl(baseUrl) {
  const normalized = baseUrl.replace(/\/+$/, '');
  if (/\/chat\/completions$/i.test(normalized)) return normalized;
  return normalized + '/chat/completions';
}

function parseModelJson(content) {
  const cleaned = String(content || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

async function classify(records) {
  const config = providerConfig();
  if (!config.configured) {
    const error = new Error('Proveedor IA no configurado. Define AI_BASE_URL y AI_MODEL en el entorno del servidor.');
    error.statusCode = 503;
    throw error;
  }
  if (!Array.isArray(records) || records.length < 1 || records.length > 20) {
    const error = new Error('Envía entre 1 y 20 eventos por solicitud.');
    error.statusCode = 400;
    throw error;
  }

  const safeRecords = records.map((record, index) => ({
    id: String(record?.id || 'event-' + index).slice(0, 100),
    errorDesc: String(record?.errorDesc || '').slice(0, MAX_TEXT_LENGTH),
    reasonDesc: String(record?.reasonDesc || '').slice(0, MAX_TEXT_LENGTH),
    remark: String(record?.remark || '').slice(0, MAX_TEXT_LENGTH)
  }));
  const prompt = [
    'Clasifica cada evento en una sola área responsable usando ERROR DESC, REASON_DESC2 y REMARK. No inventes datos.',
    'Áreas válidas: FA, REWORK, CALIDAD, PROCESOS, MANUFACTURA, PRUEBAS, POR REVISAR.',
    'Criterios: ciclos, retest o actualización de prueba → PRUEBAS, incluso si también aparece reseat; reemplazo por falla funcional → FA; daño físico, mala colocación o mal ensamble → MANUFACTURA; mala reparación → REWORK; error de método, temperatura, fluido o parámetros de proceso → PROCESOS; falla de inspección, aceptación, liberación o detección → CALIDAD.',
    'Da prioridad a la causa/responsabilidad descrita, no a la estación donde se registró la falla. Si hay conflicto real o evidencia insuficiente, asigna POR REVISAR y explica qué falta.',
    'Responde solo JSON: {"classifications":[{"id":"...","area":"...","reason":"explicación breve en español","needsReview":false}]}. Incluye cada id exactamente una vez.',
    'Eventos: ' + JSON.stringify(safeRecords)
  ].join('\n');

  const headers = { 'Content-Type': 'application/json' };
  if (config.apiKey) headers.Authorization = 'Bearer ' + config.apiKey;
  let response;
  try {
    response = await fetch(endpointUrl(config.baseUrl), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Eres especialista en asignación de causa de manufactura y pruebas. Cumple el formato JSON solicitado.' },
          { role: 'user', content: prompt }
        ]
      }),
      signal: AbortSignal.timeout(60000)
    });
  } catch {
    const error = new Error('No fue posible conectar con el proveedor IA configurado.');
    error.statusCode = 502;
    throw error;
  }
  if (!response.ok) {
    const error = new Error('El proveedor IA rechazó la solicitud (' + response.status + ').');
    error.statusCode = 502;
    throw error;
  }

  let payload;
  try { payload = await response.json(); }
  catch {
    const error = new Error('El proveedor IA devolvió una respuesta inválida.');
    error.statusCode = 502;
    throw error;
  }
  let decoded;
  try { decoded = parseModelJson(payload.choices?.[0]?.message?.content); }
  catch {
    const error = new Error('El proveedor IA no devolvió el formato esperado.');
    error.statusCode = 502;
    throw error;
  }

  const returned = new Map((Array.isArray(decoded.classifications) ? decoded.classifications : []).map(item => [String(item.id), item]));
  return safeRecords.map(record => {
    const item = returned.get(record.id);
    const proposedArea = String(item?.area || '').toUpperCase();
    const needsReview = Boolean(item?.needsReview) || !AREAS.has(proposedArea) || proposedArea === 'POR REVISAR';
    return {
      id: record.id,
      area: needsReview ? 'POR REVISAR' : proposedArea,
      reason: String(item?.reason || (item ? 'El caso requiere validación de Calidad.' : 'El modelo omitió este evento.')).slice(0, 400),
      needsReview
    };
  });
}

function sendStatic(res, pathname) {
  const asset = STATIC_FILES.get(pathname);
  if (!asset) return jsonResponse(res, 404, { error: 'No encontrado.' });
  const filePath = path.join(ROOT, asset.file);
  fs.readFile(filePath, (error, contents) => {
    if (error) return jsonResponse(res, 404, { error: 'No se encontró el recurso solicitado.' });
    res.writeHead(200, {
      'Content-Type': asset.type,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY'
    });
    res.end(contents);
  });
}

function createServer() {
  return http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url, 'http://' + (req.headers.host || '127.0.0.1'));
    if (req.method === 'GET' && requestUrl.pathname === '/api/status') {
      return jsonResponse(res, 200, { configured: providerConfig().configured });
    }
    if (requestUrl.pathname === '/api/classify' && req.method === 'POST') {
      const origin = req.headers.origin;
      if (origin) {
        try {
          if (new URL(origin).host !== req.headers.host) return jsonResponse(res, 403, { error: 'Origen no permitido.' });
        } catch { return jsonResponse(res, 403, { error: 'Origen no permitido.' }); }
      }
      try {
        const body = await readJson(req);
        const classifications = await classify(body.records);
        return jsonResponse(res, 200, { classifications });
      } catch (error) {
        if (!res.headersSent && !res.destroyed) return jsonResponse(res, error.statusCode || 500, { error: error.message || 'No se pudo clasificar el lote.' });
        return undefined;
      }
    }
    if ((req.method === 'GET' || req.method === 'HEAD') && STATIC_FILES.has(requestUrl.pathname)) {
      if (req.method === 'HEAD') {
        const asset = STATIC_FILES.get(requestUrl.pathname);
        res.writeHead(200, { 'Content-Type': asset.type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        return res.end();
      }
      return sendStatic(res, requestUrl.pathname);
    }
    return jsonResponse(res, 404, { error: 'No encontrado.' });
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, '127.0.0.1', () => {
    console.log('RCCA dashboard local: http://127.0.0.1:' + PORT);
  });
}

module.exports = { createServer };
