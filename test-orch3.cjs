const axios = require('axios');

async function test() {
  const url = 'https://orchestrator-production-c27e.up.railway.app';
  const paths = [
    '/mcp',
    '/api/mcp',
    '/mcp/sse',
    '/api/bridge/tools',
    '/api/system/health',
    '/api/mcp/route'
  ];
  
  for(const path of paths) {
    try {
      const res = await axios.post(url + path, {jsonrpc: '2.0', method: 'tools/list', params: {}, id: 1}, {headers: {Authorization: 'Bearer WidgeTDC_Orch_2026'}});
      console.log(path, res.status, res.data);
    } catch(e) {
      if(e.response) console.log(path, e.response.status, e.response.data);
      else console.log(path, e.message);
    }
  }
}
test();
