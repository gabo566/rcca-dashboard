'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const { test } = require('node:test');
const { createServer } = require('./rcca-server');

function listen(server) {
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

function close(server) {
  return new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

test('status and classification contract with and without configured provider', async t => {
  const envKeys = ['AI_BASE_URL', 'AI_MODEL', 'AI_API_KEY'];
  const previousEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  envKeys.forEach(key => { delete process.env[key]; });

  const app = createServer();
  const appPort = await listen(app);
  const appUrl = 'http://127.0.0.1:' + appPort;
  const landing = await fetch(appUrl + '/index.html');
  assert.equal(landing.status, 200);
  assert.match(await landing.text(), /rcca-dashboard\.html/);
  t.after(async () => {
    await close(app);
    envKeys.forEach(key => previousEnv[key] === undefined ? delete process.env[key] : process.env[key] = previousEnv[key]);
  });

  const status = await fetch(appUrl + '/api/status').then(response => response.json());
  assert.equal(status.configured, false);
  const disabled = await postJson(appUrl + '/api/classify', { records: [{ id: 'event-1', remark: 'AC CYCLE' }] });
  assert.equal(disabled.status, 503);

  let requestBody;
  let authorization;
  const provider = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    requestBody = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    authorization = req.headers.authorization;
    const prompt = requestBody.messages[1].content;
    const sourceJson = prompt.slice(prompt.lastIndexOf('Eventos: ') + 'Eventos: '.length);
    const records = JSON.parse(sourceJson);
    const classifications = records.map(record => {
      const combined = [record.errorDesc, record.reasonDesc, record.remark].join(' ').toLowerCase();
      let area = 'POR REVISAR';
      let reason = 'Falta evidencia suficiente.';
      if (combined.includes('retest') || combined.includes('cycle')) { area = 'PRUEBAS'; reason = 'El remark describe un ciclo o retest.'; }
      else if (combined.includes('kapton')) { area = 'MANUFACTURA'; reason = 'El remark describe colocación de material.'; }
      else if (combined.includes('ipex') && combined.includes('functional')) { area = 'FA'; reason = 'Reemplazo por falla funcional.'; }
      else if (combined.includes('damage') && combined.includes('cable')) { area = 'MANUFACTURA'; reason = 'Daño físico en el conjunto.'; }
      return { id: record.id, area, reason, needsReview: area === 'POR REVISAR' };
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ classifications }) } }] }));
  });
  const providerPort = await listen(provider);
  process.env.AI_BASE_URL = 'http://127.0.0.1:' + providerPort + '/v1';
  process.env.AI_MODEL = 'mock-quality-model';
  process.env.AI_API_KEY = 'test-only-secret';
  t.after(() => close(provider));

  const ready = await fetch(appUrl + '/api/status').then(response => response.json());
  assert.equal(ready.configured, true);
  const records = [
    { id: '1', errorDesc: 'test error', reasonDesc: 'NDF', remark: 'AC CYCLE' },
    { id: '2', errorDesc: 'Missing Kapton', reasonDesc: 'assembly', remark: 'colocacion de cinta kapton' },
    { id: '3', errorDesc: 'IPEX functional failure', reasonDesc: 'EEPROM', remark: 'reemplazo IPEX' },
    { id: '4', errorDesc: 'BMC issue', reasonDesc: 'functional', remark: 'RESEAT BMC, RETEST' },
    { id: '5', errorDesc: 'No boot', reasonDesc: 'Bianca L Damage', remark: 'reemplazo cable J15' },
    { id: '6', errorDesc: '', reasonDesc: '', remark: 'Sin detalles' }
  ];
  const classified = await postJson(appUrl + '/api/classify', { records });
  assert.equal(classified.status, 200);
  assert.deepEqual(classified.body.classifications.map(item => item.area), ['PRUEBAS', 'MANUFACTURA', 'FA', 'PRUEBAS', 'MANUFACTURA', 'POR REVISAR']);
  assert.equal(classified.body.classifications[5].needsReview, true);
  assert.equal(authorization, 'Bearer test-only-secret');

  const sentRecords = JSON.parse(requestBody.messages[1].content.slice(requestBody.messages[1].content.lastIndexOf('Eventos: ') + 'Eventos: '.length));
  assert.deepEqual(Object.keys(sentRecords[0]).sort(), ['errorDesc', 'id', 'reasonDesc', 'remark']);
  assert.equal(JSON.stringify(sentRecords).includes('serial'), false);
  assert.equal(JSON.stringify(sentRecords).includes('workorder'), false);
});
