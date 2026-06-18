import http from 'http';
const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.end(JSON.stringify({status:'ok', version:'test', path: req.url}));
});
server.listen(3100, () => console.log('Test server on 3100'));
