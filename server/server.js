const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Serve static client files
app.use(express.static(path.join(__dirname, '../client')));

// Standard API route for healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Gridlock server is running.' });
});

// Authoritative Online Room Storage
const rooms = {}; 
// Structure:
// rooms[roomId] = {
//   roomId: string,
//   players: [ { socketId, color: 1 }, { socketId, color: 2 } ],
//   board: 6x6 matrix,
//   currentPlayer: 1,
//   gameOver: false,
//   scores: { 1: { cells: 1, power: 1 }, 2: { cells: 1, power: 1 } }
// }

const GRID_SIZE = 6;

// Helper to initialize authoritative board state
function createInitialBoard() {
  const board = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    const row = [];
    for (let c = 0; c < GRID_SIZE; c++) {
      row.push({ row: r, col: c, player: null, power: 0 });
    }
    board.push(row);
  }
  // P1 starting cell
  board[0][0].player = 1;
  board[0][0].power = 1;

  // P2 starting cell
  board[GRID_SIZE - 1][GRID_SIZE - 1].player = 2;
  board[GRID_SIZE - 1][GRID_SIZE - 1].power = 1;

  return board;
}

// Get Orthogonal Neighbors
function getNeighbors(board, r, c) {
  const neighbors = [];
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, dc] of dirs) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) {
      neighbors.push(board[nr][nc]);
    }
  }
  return neighbors;
}

// Authoritative Move Validation
function checkMoveValidity(board, r, c, player) {
  const cell = board[r][c];
  const neighbors = getNeighbors(board, r, c);

  if (cell.player === player) {
    return { valid: true, type: 'reinforce' };
  }

  if (cell.player === null) {
    const hasOwnNeighbor = neighbors.some(n => n.player === player);
    if (hasOwnNeighbor) {
      return { valid: true, type: 'occupy' };
    }
  }

  if (cell.player !== null && cell.player !== player) {
    const canAttack = neighbors.some(n => n.player === player && n.power > cell.power);
    if (canAttack) {
      return { valid: true, type: 'attack' };
    }
  }

  return { valid: false };
}

// Recalculate authoritative stats
function recalculateScores(board) {
  let p1Cells = 0, p1Power = 0, p2Cells = 0, p2Power = 0;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = board[r][c];
      if (cell.player === 1) {
        p1Cells++;
        p1Power += cell.power;
      } else if (cell.player === 2) {
        p2Cells++;
        p2Power += cell.power;
      }
    }
  }
  return {
    1: { cells: p1Cells, power: p1Power },
    2: { cells: p2Cells, power: p2Power }
  };
}

// Check End Conditions
function checkGameOver(scores, board) {
  if (scores[1].cells === 0 || scores[2].cells === 0) return true;
  let isFull = true;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (board[r][c].player === null) {
        isFull = false;
        break;
      }
    }
    if (!isFull) break;
  }
  return isFull;
}

// Socket.io room orchestration
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // 1. CREATE ONLINE ROOM
  socket.on('createRoom', () => {
    // Generate unique 6-character uppercase alphanumeric room ID
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    rooms[roomId] = {
      roomId,
      players: [ { socketId: socket.id, color: 1 } ], // Host is always Player 1 (Red)
      board: createInitialBoard(),
      currentPlayer: 1,
      gameOver: false,
      scores: { 1: { cells: 1, power: 1 }, 2: { cells: 1, power: 1 } }
    };

    socket.join(roomId);
    socket.roomId = roomId;

    console.log(`[Room] Created Room: ${roomId} by Host: ${socket.id}`);
    socket.emit('roomCreated', { roomId });
  });

  // 2. JOIN ONLINE ROOM
  socket.on('joinRoom', ({ roomId }) => {
    const room = rooms[roomId];

    if (!room) {
      socket.emit('errorMsg', { message: 'Room not found! / Miestnosť nebola nájdená!' });
      return;
    }

    if (room.players.length >= 2) {
      socket.emit('errorMsg', { message: 'Room is already full! / Miestnosť je plná!' });
      return;
    }

    // Add Player 2 (Blue)
    room.players.push({ socketId: socket.id, color: 2 });
    socket.join(roomId);
    socket.roomId = roomId;

    console.log(`[Room] Player joined: ${socket.id} in Room: ${roomId}`);

    // Trigger Game Start to both players in room
    io.to(roomId).emit('gameStart', {
      roomId,
      board: room.board,
      currentPlayer: room.currentPlayer,
      scores: room.scores,
      player1Socket: room.players[0].socketId,
      player2Socket: room.players[1].socketId
    });
  });

  // 3. AUTHORITATIVE PLAYER MOVE
  socket.on('makeMove', ({ r, c }) => {
    const roomId = socket.roomId;
    const room = rooms[roomId];

    if (!room || room.gameOver) return;

    // Identify which player is sending the move
    const playerRecord = room.players.find(p => p.socketId === socket.id);
    if (!playerRecord) return;

    const movingPlayer = playerRecord.color;

    // Check if it is actually their turn
    if (room.currentPlayer !== movingPlayer) {
      socket.emit('errorMsg', { message: 'Not your turn! / Nie ste na ťahu!' });
      return;
    }

    // Validate the requested move
    const validity = checkMoveValidity(room.board, r, c, movingPlayer);
    if (!validity.valid) {
      socket.emit('errorMsg', { message: 'Invalid Move! / Neplatný ťah!' });
      return;
    }

    // Execute Move
    const cell = room.board[r][c];
    if (validity.type === 'occupy') {
      cell.player = movingPlayer;
      cell.power = 1;
    } else if (validity.type === 'reinforce') {
      cell.power += 1;
    } else if (validity.type === 'attack') {
      cell.player = movingPlayer;
      cell.power = 1;
    }

    // Recalculate State
    room.scores = recalculateScores(room.board);
    room.gameOver = checkGameOver(room.scores, room.board);

    if (room.gameOver) {
      io.to(roomId).emit('gameOver', {
        board: room.board,
        scores: room.scores
      });
    } else {
      // Advance Turn
      room.currentPlayer = room.currentPlayer === 1 ? 2 : 1;
      
      // Broadcast state update
      io.to(roomId).emit('stateUpdate', {
        board: room.board,
        currentPlayer: room.currentPlayer,
        scores: room.scores
      });
    }
  });

  // 4. RESET GAME ONLINE
  socket.on('resetGame', () => {
    const roomId = socket.roomId;
    const room = rooms[roomId];

    if (!room) return;

    room.board = createInitialBoard();
    room.currentPlayer = 1;
    room.gameOver = false;
    room.scores = { 1: { cells: 1, power: 1 }, 2: { cells: 1, power: 1 } };

    console.log(`[Room] Reset requested in Room: ${roomId}`);

    io.to(roomId).emit('gameStart', {
      roomId,
      board: room.board,
      currentPlayer: room.currentPlayer,
      scores: room.scores,
      player1Socket: room.players[0].socketId,
      player2Socket: room.players[1].socketId
    });
  });

  // 5. DISCONNECT
  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
    const roomId = socket.roomId;
    
    if (roomId && rooms[roomId]) {
      const room = rooms[roomId];
      
      // Remove room
      delete rooms[roomId];
      console.log(`[Room] Disbanded Room: ${roomId} due to disconnect`);
      
      // Notify other players in the room
      socket.to(roomId).emit('opponentDisconnected', {
        message: 'Opponent disconnected. Returning to menu... / Súper sa odpojil. Návrat do menu...'
      });
    }
  });
});

server.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`  GRIDLOCK SERVER IS UP AND RUNNING!              `);
  console.log(`  Local URL: http://localhost:3000             `);
  console.log(`==================================================`);
});
