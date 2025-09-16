const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);

// --- Middleware ---
// Indique au serveur de rendre les fichiers du dossier 'public' accessibles
app.use(express.static('public'));
// Permet au serveur de comprendre les requêtes envoyées en format JSON
app.use(express.json());

// --- Connexion à la base de données MongoDB ---
mongoose.connect('mongodb://localhost:27017/arcadehub')
  .then(() => console.log('[SERVEUR] Connexion à MongoDB réussie !'))
  .catch(err => console.error('[SERVEUR] Erreur de connexion à MongoDB', err));

// --- Schéma de la base de données ---
// Définit la structure des données pour chaque joueur/score
const scoreSchema = new mongoose.Schema({
    gameName: { type: String, required: true, index: true },
    playerName: { type: String, required: true },
    score: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now }
});

// Création d'un index pour s'assurer que le couple playerName/gameName est unique
scoreSchema.index({ playerName: 1, gameName: 1 }, { unique: true });

const Score = mongoose.model('Score', scoreSchema);


// ==================================================================
//               ROUTES API POUR LES SCORES
// ==================================================================

// Route pour enregistrer ou mettre à jour un score (REMPLACE les anciennes routes)
app.post('/api/scores', async (req, res) => {
    try {
        const { playerName, score, gameName } = req.body;

        // Validation simple des données reçues
        if (!playerName || playerName.trim().length < 3 || typeof score !== 'number' || !gameName) {
            return res.status(400).json({ message: "Données invalides (pseudo 3 car. min, score, nom du jeu)." });
        }

        // On cherche un joueur existant avec ce pseudo pour ce jeu
        const sanitizedPlayerName = playerName.trim().substring(0, 15);

        const player = await Score.findOne({ playerName: sanitizedPlayerName, gameName });

        if (player) {
            // Si le joueur existe et que son nouveau score est meilleur, on le met à jour
            if (score > player.score) {
                player.score = score;
                await player.save();
                console.log(`[SERVEUR] Nouveau meilleur score pour ${sanitizedPlayerName} sur ${gameName}: ${score}`);
                return res.status(200).json({ message: "Meilleur score mis à jour !", player });
            }
            return res.status(200).json({ message: "Le score n'a pas dépassé le record." });

        } else {
            // Si le joueur n'existe pas, on crée une nouvelle entrée dans le classement
            const newPlayer = new Score({
                gameName,
                playerName: sanitizedPlayerName,
                score
            });
            await newPlayer.save();
            console.log(`[SERVEUR] Nouveau joueur ajouté au classement ${gameName}: ${sanitizedPlayerName} avec ${score}`);
            res.status(201).json({ message: "Score enregistré !", player: newPlayer });
        }

    } catch (error) {
        // Gère le cas où le pseudo est déjà pris (violation de l'index unique)
        if (error.code === 11000) {
             return res.status(409).json({ message: "Ce pseudo est déjà pris pour ce jeu." });
        }
        console.error("[SERVEUR] Erreur lors de la soumission du score:", error);
        res.status(500).json({ message: "Erreur interne du serveur." });
    }
});


// Route pour récupérer le classement d'un jeu
app.get('/api/scores/:gameName', async (req, res) => {
    try {
        const { gameName } = req.params;
        // On cherche les joueurs avec un score supérieur à 0
        const topScores = await Score.find({ gameName: gameName, score: { $gt: 0 } })
                                     .sort({ score: -1 }) // Trie du plus haut au plus bas
                                     .limit(10);          // Ne garde que les 10 meilleurs
        res.json(topScores);
    } catch (error) {
        console.error("[SERVEUR] Erreur lors de la récupération du classement:", error);
        res.status(500).json({ message: "Erreur interne du serveur." });
    }
});


// ==================================================================
//               GESTION MULTIJOUEUR (INCHANGÉ)
// ==================================================================
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const games = {};

io.on('connection', (socket) => {
    console.log(`[SERVEUR] Connexion: ${socket.id}`);

    socket.on('hostGame', () => {
        const gameCode = generateGameCode();
        games[gameCode] = { players: [socket] };
        socket.join(gameCode);
        socket.gameCode = gameCode;
        socket.emit('gameHosted', gameCode);
        console.log(`[SERVEUR] ${socket.id} a créé la partie ${gameCode}.`);
    });

    socket.on('joinGame', (gameCode) => {
        const game = games[gameCode];
        if (!game) return socket.emit('error', 'Code invalide.');
        if (game.players.length >= 2) return socket.emit('error', 'Partie pleine.');

        socket.join(gameCode);
        game.players.push(socket);
        socket.gameCode = gameCode;
        
        console.log(`[SERVEUR] ${socket.id} a rejoint ${gameCode}. Début de la partie.`);
        
        game.players[0].emit('gameStarted', 'X');
        game.players[1].emit('gameStarted', 'O');
    });

    socket.on('makeMove', (data) => {
        if (socket.gameCode) {
            socket.to(socket.gameCode).emit('moveMade', data);
        }
    });

    socket.on('disconnect', () => {
        console.log(`[SERVEUR] Déconnexion: ${socket.id}`);
        const gameCode = socket.gameCode;
        if (gameCode && games[gameCode]) {
            socket.to(gameCode).emit('opponentDisconnected');
            delete games[gameCode];
            console.log(`[SERVEUR] Partie ${gameCode} supprimée.`);
        }
    });
});

function generateGameCode() {
    let code = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return games[code] ? generateGameCode() : code;
}


// --- Démarrage du serveur ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Serveur en écoute sur le port ${PORT}`));