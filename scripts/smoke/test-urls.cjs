const axios = require('axios');

async function test() {
  const urls = [
    'https://neural-bridge-production.up.railway.app/api/bridge/health',
    'https://neuralbridge-production.up.railway.app/api/bridge/health',
    'https://widge-tdc-production.up.railway.app',
    'https://widgetdc-production.up.railway.app'
  ];
  
  for (const url of urls) {
    try {
      console.log("Testing", url);
      const res = await axios.get(url);
      console.log("HTTP", res.status);
    } catch (e) {
      if (e.response) {
        console.log("HTTP", e.response.status, e.response.data);
      } else {
        console.log("Error", e.message);
      }
    }
  }
}

test();
