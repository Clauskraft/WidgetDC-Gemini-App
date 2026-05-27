const axios = require('axios');
async function test() {
  const params = {jsonrpc: '2.0', method: 'tools/list', params: {}, id: 1};
  try {
    const res = await axios.post('http://localhost:3000/api/mcp/proxy', params, {
      headers: { Cookie: "mcp_token=WidgeTDC_Orch_2026" }
    });
    console.log(res.status, "Length:", res.data?.result?.tools?.length);
  } catch(e) {
    console.log(e.response ? e.response.status : e.message);
  }
}
test();
