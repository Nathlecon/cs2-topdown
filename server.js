const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 10000;
const wss = new WebSocketServer({ port: PORT });

const rooms = new Map();

wss.on('connection', (ws) => {
  let currentRoom = null;
  let playerId = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      
      switch (msg.type) {
        case 'join':
          currentRoom = msg.room;
          playerId = msg.playerId;
          
          if (!rooms.has(currentRoom)) {
            rooms.set(currentRoom, new Map());
          }
          rooms.get(currentRoom).set(playerId, ws);
          
          ws.send(JSON.stringify({ type: 'joined', room: currentRoom, playerId }));
          
          for (const [id, client] of rooms.get(currentRoom)) {
            if (id !== playerId && client.readyState === 1) {
              client.send(JSON.stringify({ type: 'playerJoined', playerId }));
            }
          }
          break;
          
        case 'playerState':
        case 'bullet':
        case 'enemyState':
        case 'enemyDeath':
        case 'gameState':
        case 'hostState':
          if (currentRoom && rooms.has(currentRoom)) {
            for (const [id, client] of rooms.get(currentRoom)) {
              if (id !== playerId && client.readyState === 1) {
                client.send(JSON.stringify(msg));
              }
            }
          }
          break;
      }
    } catch (e) {
      console.error('Message error:', e);
    }
  });

  ws.on('close', () => {
    if (currentRoom && rooms.has(currentRoom) && playerId) {
      rooms.get(currentRoom).delete(playerId);
      for (const [id, client] of rooms.get(currentRoom)) {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ type: 'playerLeft', playerId }));
        }
      }
      if (rooms.get(currentRoom).size === 0) {
        rooms.delete(currentRoom);
      }
    }
  });

  ws.on('error', () => {});
});

wss.on('error', (err) => {
  console.error('Server error:', err);
});

const healthEndpoint = (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OK');
};

if (require.main === module) {
  require('http').createServer((req, res) => {
    if (req.url === '/health') return healthEndpoint(req, res);
    res.writeHead(404);
    res.end();
  }).listen(PORT + 1);
}

console.log(`Backend running on port ${PORT}`);