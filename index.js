const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const characters = require('./data/characters');

const app = express();
app.use(cors());

const server = http.createServer(app);

// 🌐 CORS для production и development
const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    process.env.CLIENT_URL, // Добавьте в переменные окружения Railway
].filter(Boolean);

const io = new Server(server, {
    cors: { 
        origin: [
            "http://localhost:5173",
            "haikyuu-client.vercel.app"  // Добавите после деплоя на Vercel
        ], 
        methods: ["GET", "POST"],
        credentials: true
    }
});

let games = {};

// Вспомогательная функция задержки
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- ФУНКЦИЯ РОТАЦИИ ---
function rotateTeam(team) {
    team.forEach(player => {
        if (player.position === 1) player.newPos = 6;
        else if (player.position === 6) player.newPos = 5;
        else if (player.position === 5) player.newPos = 4;
        else if (player.position === 4) player.newPos = 3;
        else if (player.position === 3) player.newPos = 2;
        else if (player.position === 2) player.newPos = 1;
    });
    team.forEach(p => p.position = p.newPos);
}

// --- ФУНКЦИЯ КВИРКОВ ---
function applyQuirks(actionType, player) {
    let bonus = 0;
    let log = [];

    if (!player.quirk) return { bonus, log };

    if (actionType === 'SERVE') {
        if (player.id === 'oikawa') { bonus += 5; log.push(`👽 Убийственная подача!`); }
        if (player.id === 'ushijima') { bonus += 4; log.push(`🦅 Пушечная подача!`); }
        if (player.id === 'kageyama') { bonus += 3; log.push(`👑 Подача Короля!`); }
    }

    if (actionType === 'SPIKE') {
        if (player.id === 'hinata') { bonus += 5; log.push(`🍊 ВЖУХ! Скорость!`); }
        if (player.id === 'ushijima') { bonus += 4; log.push(`🦅 Мощь Ушиджимы!`); }
        if (player.id === 'asahi') { bonus += 3; log.push(`🙏 Пробой Аса!`); }
        if (player.id === 'bokuto') {
            if (Math.random() > 0.4) {
                bonus += 8; log.push(`🦉 ХЕЙ ХЕЙ ХЕЙ! (Топ форма)`);
            } else {
                bonus -= 5; log.push(`🦉 Бокуто приуныл...`);
            }
        }
    }

    if (actionType === 'BLOCK') {
        if (player.id === 'kuroo') { bonus += 4; log.push(`😼 Килл-блок Куроо!`); }
        if (player.id === 'tsukishima') { bonus += 4; log.push(`🌙 Чтение блока!`); }
        if (player.id === 'tendo') { bonus += 5; log.push(`👻 Guess Block!`); }
    }

    if (actionType === 'DIG') {
        if (player.id === 'nishinoya') { bonus += 5; log.push(`⚡ ROLLING THUNDER!`); }
        if (player.id === 'yaku') { bonus += 4; log.push(`🐈 Страж Яку!`); }
        if (player.id === 'daichi') { bonus += 2; log.push(`🛡️ Капитан тащит!`); }
    }

    return { bonus, log };
}

io.on('connection', (socket) => {
    console.log(`[+] Игрок подключился: ${socket.id}`);

    // 1. ЛОББИ
    socket.on('create_game', () => {
        const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
        games[roomId] = {
            players: [socket.id],
            team1: [],
            team2: [],
            state: 'lobby',
            bannedCharacters: []
        };
        socket.join(roomId);
        socket.emit('game_created', roomId);
    });

    socket.on('join_game', (roomId) => {
        const room = games[roomId];
        if (room && room.players.length < 2) {
            room.players.push(socket.id);
            socket.join(roomId);
            io.to(roomId).emit('game_started', { 
                start: true, 
                players: room.players,
                allCharacters: characters 
            });
        } else {
            socket.emit('error_message', 'Ошибка входа');
        }
    });

    socket.on('character_picked', ({ roomId, charId }) => {
        const room = games[roomId];
        if (!room) return;

        if (!room.bannedCharacters.includes(charId)) {
            room.bannedCharacters.push(charId);
        }

        io.to(roomId).emit('banned_characters', room.bannedCharacters);
    });

    // 2. ДРАФТ
    socket.on('team_ready', ({ roomId, team }) => {
        const room = games[roomId];
        if (!room) return;

        if (socket.id === room.players[0]) room.team1 = team;
        else room.team2 = team;

        if (room.team1.length === 6 && room.team2.length === 6) {
            const firstServerIndex = Math.random() < 0.5 ? 0 : 1;
            const servingPlayerId = room.players[firstServerIndex];
            
            room.gameState = {
                phase: 'SERVE', 
                turn: servingPlayerId, 
                score: { team1: 0, team2: 0 },
                servingTeam: firstServerIndex === 0 ? 'team1' : 'team2'
            };

            io.to(roomId).emit('match_start', { 
                team1: room.team1, 
                team2: room.team2,
                players: room.players,
                turn: servingPlayerId,
                score: room.gameState.score
            });
        }
    });

    // 3. ПОДАЧА (с задержкой)
    socket.on('action_serve', async ({ roomId }) => {
        const room = games[roomId];
        if (!room || room.gameState.turn !== socket.id) return;

        console.log(`[SERVE] Игрок ${socket.id} подает`);

        const isTeam1 = room.players[0] === socket.id;
        const attackingTeam = isTeam1 ? room.team1 : room.team2;
        const defendingTeam = isTeam1 ? room.team2 : room.team1;

        const serverPlayer = attackingTeam.find(p => p.position === 1);
        const backRow = defendingTeam.filter(p => [1, 5, 6].includes(p.position));
        const receiver = backRow[Math.floor(Math.random() * backRow.length)] || defendingTeam[0];

        const serveQuirk = applyQuirks('SERVE', serverPlayer);
        const digQuirk = applyQuirks('DIG', receiver);

        const attackRoll = Math.floor(Math.random() * 20) + 1;
        const defenseRoll = Math.floor(Math.random() * 20) + 1;
        
        const totalAttack = serverPlayer.stats.power + attackRoll + serveQuirk.bonus;
        const totalDefense = receiver.stats.receive + defenseRoll + digQuirk.bonus;
        
        const diff = totalDefense - totalAttack;

        let message = '';
        let quirkMsg = [...serveQuirk.log, ...digQuirk.log].join(' | ');
        if (quirkMsg) message = `[${quirkMsg}] `;
        
        // ⏱️ ЗАДЕРЖКА для анимации подачи
        await delay(1200);
        
        if (diff < -5) {
            message += `🔥 ЭЙС! ${serverPlayer.name} пробил ${receiver.name}!`;
            if (isTeam1) room.gameState.score.team1++;
            else room.gameState.score.team2++;
            
            room.gameState.phase = 'SERVE';
            room.gameState.turn = socket.id;
        } else {
            if (diff < 0) message += `⚠️ Тяжелый прием от ${receiver.name}...`;
            else message += `🏐 Отличный прием! ${receiver.name} поднял мяч.`;
            
            room.gameState.phase = 'SET';
            room.gameState.turn = room.players.find(id => id !== socket.id);
        }

        io.to(roomId).emit('serve_result', {
            message,
            score: room.gameState.score,
            nextTurn: room.gameState.turn,
            phase: room.gameState.phase
        });
    });

    // 4. ПАС (с задержкой)
    socket.on('action_set', async ({ roomId, targetPos }) => {
        const room = games[roomId];
        if (!room) return;

        room.gameState.ballPosition = targetPos;
        room.gameState.phase = 'BLOCK';
        
        const attackerId = socket.id;
        const defenderId = room.players.find(id => id !== socket.id);
        room.gameState.turn = defenderId;

        let positionName = "";
        if (targetPos === 4) positionName = "ЛЕВЫЙ ФЛАНГ";
        if (targetPos === 3) positionName = "ЦЕНТР";
        if (targetPos === 2) positionName = "ПРАВЫЙ ФЛАНГ";

        // ⏱️ ЗАДЕРЖКА для анимации паса
        await delay(1000);

        io.to(attackerId).emit('set_result', {
            message: `Вы пасанули на ${positionName}. Ждем блок...`,
            phase: 'BLOCK',
            nextTurn: defenderId,
            targetPos: targetPos
        });

        io.to(defenderId).emit('set_result', {
            message: `❗ Связующий сделал передачу! УГАДАЙ НАПРАВЛЕНИЕ!`,
            phase: 'BLOCK',
            nextTurn: defenderId,
            targetPos: null 
        });
    });

    // 5. БЛОК (с задержкой)
    socket.on('action_block', async ({ roomId, blockPos }) => {
        const room = games[roomId];
        if (!room) return;

        const ballPos = room.gameState.ballPosition;

        let correctBlockPos = 3;
        if (ballPos === 4) correctBlockPos = 2;
        if (ballPos === 2) correctBlockPos = 4;
        const isGuessCorrect = blockPos === correctBlockPos;

        const defenderId = socket.id;
        const isTeam1Defending = room.players[0] === defenderId;
        const defendingTeam = isTeam1Defending ? room.team1 : room.team2;
        const attackingTeam = isTeam1Defending ? room.team2 : room.team1;

        const spiker = attackingTeam.find(p => p.position === ballPos) || attackingTeam[0];
        const blockerPosToFind = isGuessCorrect ? correctBlockPos : 3;
        const blocker = defendingTeam.find(p => p.position === blockerPosToFind) || defendingTeam.find(p => p.position === 3);

        let targetDefPos = 6; 
        if (ballPos === 4) targetDefPos = 1;
        if (ballPos === 2) targetDefPos = 5;
        const floorDefender = defendingTeam.find(p => p.position === targetDefPos) || defendingTeam.find(p => p.position === 6);

        const spikeQuirk = applyQuirks('SPIKE', spiker);
        const blockQuirk = applyQuirks('BLOCK', blocker);
        const digQuirk = applyQuirks('DIG', floorDefender);

        const d20_atk = Math.floor(Math.random() * 20) + 1;
        const d20_blk = Math.floor(Math.random() * 20) + 1;
        const d20_dig = Math.floor(Math.random() * 20) + 1;

        let attackPower = spiker.stats.power + d20_atk + spikeQuirk.bonus;
        
        let blockPower = 0;
        if (isGuessCorrect) {
            blockPower = blocker.stats.block + d20_blk + 5 + blockQuirk.bonus;
        }

        let digPower = floorDefender.stats.receive + d20_dig + digQuirk.bonus;

        let quirkLog = [...spikeQuirk.log];
        if (isGuessCorrect) quirkLog.push(...blockQuirk.log);
        quirkLog.push(...digQuirk.log);
        
        let message = quirkLog.length ? `[${quirkLog.join(' | ')}] ` : "";
        let winner = null;
        let details = '';
        let nextPhase = 'SERVE';
        let nextTurn = null;

        // ⏱️ ЗАДЕРЖКА для анимации атаки
        await delay(900);

        // БИТВА
        if (isGuessCorrect && blockPower > attackPower) {
            winner = 'DEFENSE';
            message += `🧱 KILL BLOCK! ${blocker.name} закрыл атаку!`;
            details = `Блок ${blockPower} > Атака ${attackPower}`;
        } else {
            let remainingForce = attackPower;
            let preMsg = '';
            
            if (isGuessCorrect) {
                remainingForce = Math.floor((attackPower - blockPower) / 2);
                if (remainingForce < 0) remainingForce = 5;
                preMsg = `🛡️ Смягчение блоком!`;
            } else {
                remainingForce = attackPower + 5;
                preMsg = `💥 ЧИСТАЯ СЕТКА!`;
            }

            if (digPower >= remainingForce) {
                const isCounterAttack = Math.random() < 0.5;
                if (isCounterAttack) {
                    message += `${preMsg} ${floorDefender.name} ТАЩИТ! Переход в атаку!`;
                    nextPhase = 'SET';
                    nextTurn = defenderId;
                } else {
                    message += `${preMsg} ${floorDefender.name} поднял, но мяч перелетел сетку!`;
                    nextPhase = 'SET';
                    nextTurn = room.players.find(id => id !== defenderId);
                }
                details = `Прием ${digPower} > Удар ${remainingForce}`;
                winner = null; 
            } else {
                winner = 'ATTACK';
                message += `🏐 ГОЛ! ${spiker.name} пробил защиту!`;
                details = `Удар ${remainingForce} > Прием ${digPower}`;
            }
        }

        let rotMessage = '';
        if (winner) {
            nextPhase = 'SERVE';
            
            if (winner === 'ATTACK') {
                if (isTeam1Defending) {
                    room.gameState.score.team2++;
                    if (room.gameState.servingTeam === 'team1') {
                        rotateTeam(room.team2);
                        rotMessage = ' (Переход подачи!)';
                        room.gameState.servingTeam = 'team2';
                    }
                    nextTurn = room.players[1];
                } else {
                    room.gameState.score.team1++;
                    if (room.gameState.servingTeam === 'team2') {
                        rotateTeam(room.team1);
                        rotMessage = ' (Переход подачи!)';
                        room.gameState.servingTeam = 'team1';
                    }
                    nextTurn = room.players[0];
                }
            } else {
                if (isTeam1Defending) {
                    room.gameState.score.team1++;
                    if (room.gameState.servingTeam === 'team2') {
                        rotateTeam(room.team1);
                        rotMessage = ' (Переход подачи!)';
                        room.gameState.servingTeam = 'team1';
                    }
                    nextTurn = room.players[0];
                } else {
                    room.gameState.score.team2++;
                    if (room.gameState.servingTeam === 'team1') {
                        rotateTeam(room.team2);
                        rotMessage = ' (Переход подачи!)';
                        room.gameState.servingTeam = 'team2';
                    }
                    nextTurn = room.players[1];
                }
            }
        } 
        
        room.gameState.turn = nextTurn;
        room.gameState.phase = nextPhase;

        const s1 = room.gameState.score.team1;
        const s2 = room.gameState.score.team2;
        
        if (winner && (s1 >= 25 || s2 >= 25) && Math.abs(s1 - s2) >= 2) {
            io.to(roomId).emit('game_over', {
                message: `🏆 ПОБЕДА! Счет ${s1} : ${s2}`
            });
        } else {
            io.to(roomId).emit('spike_result', {
                message: message + rotMessage,
                score: room.gameState.score,
                nextTurn: nextTurn,
                phase: nextPhase,
                details: details,
                team1: room.team1, 
                team2: room.team2
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('[-] Игрок отключился');
    });
});

// 🚀 Production-ready сервер
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
    console.log(`--- СЕРВЕР ЗАПУЩЕН (${PORT}) ---`);
    console.log(`Окружение: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Разрешенные origin: ${allowedOrigins.join(', ')}`);
});