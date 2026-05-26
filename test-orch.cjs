const axios = require('axios');

async function test() {
  try {
    const res = await axios.post('https://orchestrator-production-c27e.up.railway.app/api/mcp/route', {jsonrpc: '2.0', method: 'tools/list', params: {}, id: 1}, {headers: {Authorization: 'Bearer WidgeTDC_Orch_2026'}});
    console.log("MCP ROUTE", res.status);
  } catch(e) { if(e.response) console.log("MCP ROUTE", e.response.status, e.response.data); else console.log(e.message); }

  try {
    const res = await axios.post('https://orchestrator-production-c27e.up.railway.app/api/bridge/mcp', {jsonrpc: '2.0', method: 'tools/list', params: {}, id: 1}, {headers: {Authorization: 'Bearer WidgeTDC_Orch_2026'}});
    console.log("MCP BRIDGE", res.status);
  } catch(e) { if(e.response) console.log("MCP BRIDGE", e.response.status, e.response.data); else console.log(e.message); }
}
test();
