const https = require('https');

const data = JSON.stringify({
  tool: 'reason_deeply',
  payload: {
    mode: 'plan',
    task: 'make the layout tighter and optimize UX for the WidgeTDC frontend'
  }
});

const options = {
  hostname: 'backend-production-d3da.up.railway.app',
  path: '/api/mcp/route',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer 16IhluefvQdtIasp2f6YLhT2IBpBG3Gp',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (d) => body += d);
  res.on('end', () => console.log(body));
});

req.on('error', (e) => console.error(e));
req.write(data);
req.end();
