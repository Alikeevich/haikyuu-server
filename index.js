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
    "https://haikyuu-client.vercel.app",
    process.env.CLIENT_URL,
].filter(Boolean);

const io = new Server(server, {
    cors: { 
        origin: allowedOrigins,
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

// --- УЧЕТ ПАССИВКИ КЕНМЫ ---
function getEffectiveStats(player, team) {
    let stats = { ...player.stats };
    const hasKenma = team.some(p => p.id === 'kenma');
    if (hasKenma && player.team === 'Nekoma') {
        stats.power += 2;
        stats.receive += 2;
        stats.block += 2;
        stats.serve += 2;
        stats.set += 2;
    }
    return stats;
}

// --- ФУНКЦИЯ КВИРКОВ ---
function applyQuirks(actionType, player, effectiveStats) {
    let bonus = 0;
    let log = [];

    if (!player.quirk) return { bonus, log };

    if (actionType === 'SERVE') {
        if (player.id === 'oikawa') { bonus += 5; log.push(`👽 Убийственная подача!`); }
        if (player.id === 'ushijima') { bonus += 4; log.push(`🦅 Пушечная подача!`); }
        if (player.id === 'kageyama') { bonus += 3; log.push(`👑 Подача Короля!`); }
        if (player.id === 'atsumu') { bonus += 4; log.push(`🦊 Двойной вилд!`); }
        if (player.id === 'yamaguchi') { bonus += 4; log.push(`🎈 Планер!`); }
    }

    if (actionType === 'SPIKE') {
        if (player.id === 'hinata') { bonus += 5; log.push(`🍊 ВЖУХ!`); }
        if (player.id === 'ushijima') { bonus += 4; log.push(`🦅 Мощь Ушиджимы!`); }
        if (player.id === 'asahi') { bonus += 3; log.push(`🙏 Пробой Аса!`); }
        if (player.id === 'aran') { bonus += 3; log.push(`🦊 Топ-3 Ас!`); }
        if (player.id === 'kiryu') { bonus += 3; log.push(`👹 Бэнкей!`); }
        if (player.id === 'bokuto') {
            if (Math.random() > 0.4) {
                bonus += 8; log.push(`🦉 ХЕЙ ХЕЙ ХЕЙ!`);
            } else {
                bonus -= 5; log.push(`🦉 Бокуто приуныл...`);
            }
        }
    }

    if (actionType === 'BLOCK') {
        if (player.id === 'kuroo') { bonus += 4; log.push(`😼 Килл-блок!`); }
        if (player.id === 'tsukishima') { bonus += 4; log.push(`🌙 Чтение блока!`); }
        if (player.id === 'tendo') { bonus += 5; log.push(`👻 Guess Block!`); }
        if (player.id === 'aone') { bonus += 5; log.push(`🛡️ Железная стена!`); }
        if (player.id === 'hirugami') { bonus += 3; log.push(`🗿 Неподвижный!`); }
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
            room.draftTurn = room.players[Math.random() < 0.5 ? 0 : 1];
            io.to(roomId).emit('draft_turn', { turn: room.draftTurn });
        } else {
            socket.emit('error_message', 'Ошибка входа');
        }
    });

    socket.on('character_picked', ({ roomId, charId }) => {
        const room = games[roomId];
        if (!room) return;
        if (room.draftTurn && room.draftTurn !== socket.id) return;

        if (!room.bannedCharacters.includes(charId)) {
            room.bannedCharacters.push(charId);
            io.to(roomId).emit('banned_characters', room.bannedCharacters);
            const otherId = room.players.find(id => id !== socket.id);
            room.draftTurn = otherId;
            io.to(roomId).emit('draft_turn', { turn: room.draftTurn });
        }
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
                servingTeam: firstServerIndex === 0 ? 'team1' : 'team2',
                setterBonus: 0,
                lastServerId: null,
                serveStreak: 0
            };

            room.draftTurn = null;
            io.to(roomId).emit('draft_finished');

            io.to(roomId).emit('match_start', { 
                team1: room.team1, 
                team2: room.team2,
                players: room.players,
                turn: servingPlayerId,
                score: room.gameState.score
            });
        }
    });

// 3. ПОДАЧА + ПРИВЫКАНИЕ
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

        // --- ЛОГИКА ПРИВЫКАНИЯ (ADAPTATION) ---
        if (room.gameState.lastServerId === serverPlayer.id) {
            // Если подает тот же самый игрок
            room.gameState.serveStreak++;
        } else {
            // Если подающий сменился (или начало игры)
            room.gameState.lastServerId = serverPlayer.id;
            room.gameState.serveStreak = 0;
        }

        // Штраф растет с каждой следующей подачей подряд
        // 1-я: 0, 2-я: -3, 3-я: -6, 4-я: -9
        const adaptationPenalty = room.gameState.serveStreak * 3;

        // --- СТАТЫ И КВИРКИ ---
        const sStats = getEffectiveStats(serverPlayer, attackingTeam);
        const rStats = getEffectiveStats(receiver, defendingTeam);

        const serveQuirk = applyQuirks('SERVE', serverPlayer, sStats);
        const digQuirk = applyQuirks('DIG', receiver, rStats);

        const attackRoll = Math.floor(Math.random() * 20) + 1;
        const defenseRoll = Math.floor(Math.random() * 20) + 1;
        
        // РАСЧЕТ СИЛЫ С УЧЕТОМ ШТРАФА
        let totalAttack = sStats.serve + attackRoll + serveQuirk.bonus - adaptationPenalty;
        
        // Защита от отрицательных чисел (хотя в формуле diff это не критично, но для красоты)
        if (totalAttack < 1) totalAttack = 1;

        const totalDefense = rStats.receive + defenseRoll + digQuirk.bonus;
        
        const diff = totalDefense - totalAttack;

        // --- ФОРМИРОВАНИЕ СООБЩЕНИЯ ---
        let message = '';
        let quirkMsg = [...serveQuirk.log, ...digQuirk.log];
        
        // Добавляем инфу о привыкании в лог, если штраф есть
        if (adaptationPenalty > 0) {
            quirkMsg.push(`📉 Привыкание: -${adaptationPenalty}`);
        }
        
        if (quirkMsg.length > 0) message = `[${quirkMsg.join(' | ')}] `;
        
        await delay(1200);
        
        // --- РЕЗУЛЬТАТ ---
        if (diff < -5) {
            message += `🔥 ЭЙС! ${serverPlayer.name} пробил ${receiver.name}!`;
            if (isTeam1) room.gameState.score.team1++;
            else room.gameState.score.team2++;
            
            // Если эйс - подающий остается тот же, стрик увеличится в следующий раз
            room.gameState.phase = 'SERVE';
            room.gameState.turn = socket.id;
        } else {
            if (diff < 0) message += `⚠️ Тяжелый прием от ${receiver.name}...`;
            else message += `🏐 Отличный прием! ${receiver.name} поднял мяч.`;
            
            // Смена владения - стрик сбросится при следующей подаче (так как lastServerId сменится)
            room.gameState.phase = 'SET';
            room.gameState.turn = room.players.find(id => id !== socket.id);
        }

        io.to(roomId).emit('serve_result', {
            message,
            score: room.gameState.score,
            nextTurn: room.gameState.turn,
            phase: room.gameState.phase,
            serverId: socket.id
        });
    });

    // 4. ПАС
    socket.on('action_set', async ({ roomId, targetPos }) => {
        const room = games[roomId];
        if (!room) return;

        const setterId = socket.id;
        const isTeam1 = room.players[0] === socket.id;
        const myTeam = isTeam1 ? room.team1 : room.team2;
        
        const setterPlayer = myTeam.find(p => p.position === 3) || myTeam[0];
        const sStats = getEffectiveStats(setterPlayer, myTeam);
        
        // Бонус от качества паса
        const setterBonus = Math.floor(sStats.set / 4);
        room.gameState.setterBonus = setterBonus;

        room.gameState.ballPosition = targetPos;
        room.gameState.phase = 'BLOCK';
        
        const defenderId = room.players.find(id => id !== socket.id);
        room.gameState.turn = defenderId;

        let positionName = "";
        if (targetPos === 4) positionName = "ЛЕВЫЙ ФЛАНГ";
        if (targetPos === 3) positionName = "ПАЙП (Задняя линия)";
        if (targetPos === 2) positionName = "ПРАВЫЙ ФЛАНГ";

        await delay(1000);

        socket.emit('set_result', {
            message: `Передача на ${positionName} (Бонус +${setterBonus})`,
            phase: 'BLOCK',
            nextTurn: defenderId,
            targetPos: targetPos,
            setterId: socket.id
        });

        socket.to(roomId).emit('set_made', {
            message: `Передача совершена`,
            phase: 'BLOCK',
            nextTurn: defenderId,
            setterId: socket.id
        });
    });

    // 5. БЛОК
    socket.on('action_block', async ({ roomId, blockPos }) => {
        const room = games[roomId];
        if (!room) return;

        const ballPos = room.gameState.ballPosition;
        let attackPosition = ballPos;
        if (ballPos === 3) attackPosition = 6; 

        // --- ЛОГИКА БЛОКА ---
        let correctBlockPos = 3;
        if (ballPos === 4) correctBlockPos = 2;
        if (ballPos === 2) correctBlockPos = 4;
        if (ballPos === 3) correctBlockPos = 3; 
        
        const defenderId = socket.id;
        const isTeam1Defending = room.players[0] === defenderId;
        const defendingTeam = isTeam1Defending ? room.team1 : room.team2;
        const attackingTeam = isTeam1Defending ? room.team2 : room.team1;

        const spiker = attackingTeam.find(p => p.position === attackPosition) || attackingTeam[0];
        
        // Логика Сакусы
        if (spiker.id === 'sakusa' && ballPos === 4) {
            correctBlockPos = 3;
        }

        const isGuessCorrect = blockPos === correctBlockPos;

        let blockerPosToFind = isGuessCorrect ? correctBlockPos : 3;
        const blocker = defendingTeam.find(p => p.position === blockerPosToFind) || defendingTeam.find(p => p.position === 3);

        let targetDefPos = 6; 
        if (ballPos === 4) targetDefPos = 1; 
        if (ballPos === 2) targetDefPos = 5; 
        if (ballPos === 3) targetDefPos = 6; 
        
        const floorDefender = defendingTeam.find(p => p.position === targetDefPos) || defendingTeam.find(p => p.position === 6);

        const atkStats = getEffectiveStats(spiker, attackingTeam);
        const blkStats = getEffectiveStats(blocker, defendingTeam);
        const digStats = getEffectiveStats(floorDefender, defendingTeam);

        const spikeQuirk = applyQuirks('SPIKE', spiker, atkStats);
        const blockQuirk = applyQuirks('BLOCK', blocker, blkStats);
        const digQuirk = applyQuirks('DIG', floorDefender, digStats);

        const d20_atk = Math.floor(Math.random() * 20) + 1;
        const d20_blk = Math.floor(Math.random() * 20) + 1;
        const d20_dig = Math.floor(Math.random() * 20) + 1;

        const setterBonus = room.gameState.setterBonus || 0;

        let attackPower = atkStats.power + d20_atk + spikeQuirk.bonus + setterBonus;
        
        let blockPower = 0;
        if (isGuessCorrect) {
            blockPower = blkStats.block + d20_blk + 5 + blockQuirk.bonus;
        }

        let digPower = digStats.receive + d20_dig + digQuirk.bonus;

        let quirkLog = [...spikeQuirk.log];
        if (isGuessCorrect) quirkLog.push(...blockQuirk.log);
        quirkLog.push(...digQuirk.log);
        
        let message = quirkLog.length ? `[${quirkLog.join(' | ')}] ` : "";
        let winner = null;
        let details = '';
        let nextPhase = 'SERVE';
        let nextTurn = null;

        await delay(900);

        // --- БИТВА ---
        let isKillBlock = isGuessCorrect && blockPower > attackPower;
        
        // Хякузава иммунитет
        if (isKillBlock && spiker.id === 'hyakuzawa') {
            isKillBlock = false;
            message += ` (Хякузава пробил блок!) `;
            attackPower = Math.floor(attackPower * 0.7); 
        }

        if (isKillBlock) {
            winner = 'DEFENSE';
            message += `🧱 MONSTER BLOCK! ${blocker.name} заблокировал!`;
            details = `Блок ${blockPower} > Атака ${attackPower}`;
        } else {
            let remainingForce = attackPower;
            let preMsg = '';
            
            if (isGuessCorrect) {
                // Смягчение
                remainingForce = Math.floor(attackPower - (blockPower * 0.5));
                
                // Гарантируем, что сила не уйдет в минус, но и не будет копеечной
                if (remainingForce < 8) remainingForce = 8; 
                
                preMsg = `🛡️ Смягчение блоком!`;
            } else {
                // Чистая сетка (Без штрафов и бонусов, просто чистая сила)
                remainingForce = attackPower;
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

        // --- ОПРЕДЕЛЕНИЕ КРИТИЧЕСКОГО УДАРА (ДЛЯ ТРЯСКИ) ---
        let isCritical = false;

        // 1. Если это KILL BLOCK
        if (winner === 'DEFENSE' && isKillBlock) {
            isCritical = true;
        }
        
        // 2. Если это ГОЛ и разница сил огромная (> 10)
        // remainingForce - это сила атаки, которая дошла до защитника (или чистая)
        // digPower - сила приема
        if (winner === 'ATTACK') {
            // Если была чистая сетка или пробит блок
            // Считаем разницу
            let forceDifference = 0;
            if (isKillBlock) {
                // Блок выиграл, тут атака не при чем
            } else {
                let remainingForce = attackPower;
                if (isGuessCorrect) remainingForce = Math.floor(attackPower - (blockPower * 0.5));
                
                // Разница между ударом и приемом
                forceDifference = remainingForce - digPower;
                
                if (forceDifference > 10) {
                    isCritical = true;
                    message += " 💥 РАЗГРОМ!"; // Добавим пафоса в текст
                }
            }
        }
        
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
                team2: room.team2,
                isCritical: isCritical
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('[-] Игрок отключился');
    });
});

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
    console.log(`--- СЕРВЕР ЗАПУЩЕН (${PORT}) ---`);
});
