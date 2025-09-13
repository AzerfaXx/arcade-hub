// Importe les bibliothèques nécessaires
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
// Configure Socket.IO pour autoriser les connexions depuis n'importe quelle origine (utile pour Netlify + autre hébergeur)
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Garde en mémoire les parties en cours
const games = {}; // ex: { 'ABCD': { players: [socket1, socket2], turn: 'X' } }

// Se déclenche à chaque fois qu'un nouveau joueur se connecte
io.on('connection', (socket) => {
    console.log('Un utilisateur s\'est connecté :', socket.id);

    // Quand un joueur veut héberger une partie
    socket.on('hostGame', () => {
        const gameCode = generateGameCode(); // Crée un code unique
        games[gameCode] = {
            players: [socket],
            turn: 'X'
        };
        socket.join(gameCode); // Le joueur rejoint une "salle" avec le nom du code
        socket.emit('gameHosted', gameCode); // Envoie le code au joueur qui a hébergé
    });

    // Quand un joueur veut rejoindre une partie
    socket.on('joinGame', (gameCode) => {
        const game = games[gameCode];
        if (!game) {
            socket.emit('error', 'Code de partie invalide.');
            return;
        }
        if (game.players.length >= 2) {
            socket.emit('error', 'La partie est déjà pleine.');
            return;
        }

        socket.join(gameCode);
        game.players.push(socket);
        
        // La partie commence ! On informe les deux joueurs.
        io.to(gameCode).emit('gameStarted', 'O'); // Le joueur qui rejoint est 'O'
        game.players[0].emit('gameStarted', 'X'); // L'hôte est 'X'
    });

    // Quand un joueur effectue un coup
    socket.on('makeMove', (data) => {
        const gameCode = Array.from(socket.rooms)[1]; // Trouve le code de la partie
        // Renvoie le coup à l'autre joueur dans la même salle
        socket.to(gameCode).emit('moveMade', data);
    });

    // Gère la déconnexion
    socket.on('disconnect', () => {
        console.log('Un utilisateur s\'est déconnecté :', socket.id);
        // Trouve la partie à laquelle le joueur appartenait
        for (const gameCode in games) {
            const game = games[gameCode];
            const playerIndex = game.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                // Informe l'autre joueur que son adversaire est parti
                socket.to(gameCode).emit('opponentDisconnected');
                delete games[gameCode]; // Supprime la partie
                break;
            }
        }
    });
});

// Fonction simple pour générer un code de 4 lettres
function generateGameCode() {
    let code = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // S'assure que le code n'existe pas déjà
    return games[code] ? generateGameCode() : code;
}

// Lance le serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Serveur en écoute sur le port ${PORT}`));