
const http = require('http');

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function get(resource) {
  return new Promise((resolve) => {
    const opts = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/${resource}?limit=1`,
      method: 'GET',
    };

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        let json = {};
        try { json = JSON.parse(data); } catch (e) {}
        resolve({ status: res.statusCode, body: json });
      });
    });
    req.end();
  });
}

(async () => {
  console.log('--- INSPECTING ACCOUNT STRUCTURE ---');
  const res = await get('accounts');
  if (res.status === 200 && res.body.length > 0) {
    console.log(JSON.stringify(res.body[0], null, 2));
  } else {
    console.log('No accounts found or error:', res.status, res.body);
  }
})();
