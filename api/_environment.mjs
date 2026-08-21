export function requestHostname(request) {
  const host = String(request.headers.host || '').split(':')[0].toLowerCase();
  return host;
}

export function isDemoRequest(request) {
  const host = requestHostname(request);
  return (
    process.env.FRIZI_ENABLE_DEMO_APIS === 'true' ||
    host === 'clientdemo.frizi.ca' ||
    host === 'prodemo.frizi.ca' ||
    host === 'localhost' ||
    host === '127.0.0.1'
  );
}

export function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

export function sendProductionDisabled(response, feature) {
  return sendJson(response, 501, {
    error: `${feature} is not enabled for production yet.`,
    status: 'coming_soon',
  });
}
