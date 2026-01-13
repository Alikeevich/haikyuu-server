const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

// Убедись, что файл ./data/characters.js существует!
const characters = require('./data/characters');
const { AIFactory } = require('./ai/AIStrategies');

const app = express();
app.use(cors());

const server = http.createServer(app);

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
let aiMoveTimeouts = {}; // 🛡️ Отслеживаем таймауты ИИ ходов для предотвращения зависаний

// Утилита задержки
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

function applyQuirks(actionType, player, effectiveStats) {
    let bonus = 0;
    let log = [];

    if (!player.quirk) return { bonus, log };

    if (actionType === 'SERVE') {
        if (player.id === 'oikawa') { bonus += 5; log.push(`Убийственная подача!`); }
        if (player.id === 'ushijima') { bonus += 4; log.push(`Пушечная подача!`); }
        if (player.id === 'kageyama') { bonus += 3; log.push(`Подача Короля!`); }
        if (player.id === 'atsumu') { bonus += 4; log.push(`Гибридка!`); }
        if (player.id === 'yamaguchi') { bonus += 4; log.push(`Планер!`); }
    }

    if (actionType === 'SPIKE') {
        if (player.id === 'hinata') { bonus += 5; log.push(`ВЖУХ!`); }
        if (player.id === 'ushijima') { bonus += 4; log.push(`Мощь Ушиваки!`); }
        if (player.id === 'asahi') { bonus += 3; log.push(`Пробой Аса!`); }
        if (player.id === 'bokuto') {
            if (Math.random() > 0.4) {
                bonus += 8; log.push(`🦉 ХЕЙ ХЕЙ ХЕЙ!`);
            } else {
                bonus -= 5; log.push(`🦉 Бокуто приуныл...`);
            }
        }
        if (player.id === 'hinata_ts') {
            bonus += 2;
            log.push(`🇧🇷 Ninja Shoyo`);
        }
    }

    if (actionType === 'BLOCK') {
        if (player.id === 'kuroo') { bonus += 4; log.push(`Проблемный!`); }
        if (player.id === 'tsukishima') { bonus += 4; log.push(`🌙 Чтение блока!`); }
        if (player.id === 'tendo') { bonus += 5; log.push(`👻 Guess Block!`); }
        if (player.id === 'aone') { bonus += 5; log.push(`Железная стена!`); }
    }

    if (actionType === 'DIG') {
        if (player.id === 'nishinoya') { bonus += 5; log.push(`Раскаты грома!`); }
        if (player.id === 'yaku') { bonus += 4; log.push(`Страж Яку`); }
        if (player.id === 'daichi') { bonus += 2; log.push(`СУГАВАРАА!`); }
    }

    return { bonus, log };
}

// --- УНИВЕРСАЛЬНАЯ ФУНКЦИЯ ПРОВЕРКИ ПОБЕДЫ ---
function checkGameOver(room, io, roomId) {
    const s1 = room.gameState.score.team1;
    const s2 = room.gameState.score.team2;
    
    // Условие: >= 25 очков И разница >= 2
    if ((s1 >= 25 || s2 >= 25) && Math.abs(s1 - s2) >= 2) {
        // Поиск MVP
        const allPlayers = [...room.team1, ...room.team2];
        let mvp = allPlayers[0];
        let maxScore = -1;

        allPlayers.forEach(p => {
            const pts = p.matchStats ? p.matchStats.points : 0;
            const blks = p.matchStats ? p.matchStats.blocks : 0;
            const total = pts + (blks * 0.5); 
            if (total > maxScore) {
                maxScore = total;
                mvp = p;
            }
        });

        const winnerTeamName = s1 > s2 ? 'КОМАНДА 1' : 'КОМАНДА 2';
        const playerWon = s1 > s2;

        // 🏆 ОБРАБОТКА ТУРНИРА
        if (room.isTournament && room.tournamentRoomId) {
            const tournamentRoom = games[room.tournamentRoomId];
            if (tournamentRoom && tournamentRoom.tournament) {
                const match = tournamentRoom.tournament.matches.find(m => m.id === room.matchId);
                
                if (match) {
                    match.playerScore = s1;
                    match.aiScore = s2;
                    match.result = playerWon ? 'WIN' : 'LOSS';
                    match.status = 'COMPLETED';
                    
                    if (playerWon) {
                        tournamentRoom.tournament.wins++;
                    } else {
                        tournamentRoom.tournament.losses++;
                    }

                    io.to(room.tournamentRoomId).emit('match_result', {
                        matchId: room.matchId,
                        playerWon: playerWon,
                        score: { team1: s1, team2: s2 },
                        mvp: mvp,
                        tournament: getTournamentState(tournamentRoom.tournament)
                    });

                    // Проверяем окончание турнира
                    if (room.matchId >= 4) {
                        io.to(room.tournamentRoomId).emit('tournament_finished', {
                            wins: tournamentRoom.tournament.wins,
                            losses: tournamentRoom.tournament.losses,
                            totalMatches: 4
                        });
                    } else {
                        // Переходим на следующий матч
                        setTimeout(() => {
                            const nextMatch = tournamentRoom.tournament.matches[room.matchId];
                            if (nextMatch) {
                                io.to(room.tournamentRoomId).emit('next_tournament_match', {
                                    matchId: room.matchId + 1,
                                    aiType: nextMatch.aiType
                                });
                            }
                        }, 3000);
                    }
                }
            }
        } else {
            // Обычная игра
            io.to(roomId).emit('game_over', {
                message: `🏆 ПОБЕДА! Счет ${s1} : ${s2}`,
                winner: winnerTeamName,
                score: { team1: s1, team2: s2 },
                mvp: mvp
            });
        }
        return true; // Игра закончена
    }
    return false; // Игра продолжается
}

// 🤖 ========== ЛОГИКА ИИ ========== 🤖

function aiDraftTeam(bannedIds = []) {
    const available = characters.filter(c => !bannedIds.includes(c.id));
    const shuffled = [...available].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 6).map((char, index) => ({
        ...char,
        position: index + 1,
        matchStats: { points: 0, blocks: 0 }
    }));
}

function aiChooseSetPosition(room) {
    try {
        if (room.aiInstance && room.aiInstance.chooseSetPosition) {
            const pos = room.aiInstance.chooseSetPosition();
            if (pos && [2, 3, 4].includes(pos)) {
                return pos;
            }
        }
    } catch (error) {
        console.error(`[AI SET ERROR] ${error.message}`);
    }
    // 🛡️ FALLBACK: всегда вернуть корректную позицию
    const positions = [2, 3, 4];
    const fallback = positions[Math.floor(Math.random() * positions.length)];
    console.log(`[AI FALLBACK] Using set position: ${fallback}`);
    return fallback;
}

function aiChooseBlockPosition(room) {
    try {
        if (room.aiInstance && room.aiInstance.chooseBlockPosition) {
            const pos = room.aiInstance.chooseBlockPosition();
            if (pos && [2, 3, 4].includes(pos)) {
                return pos;
            }
        }
    } catch (error) {
        console.error(`[AI BLOCK ERROR] ${error.message}`);
    }
    
    // 🛡️ FALLBACK: сделаем умный выбор
    const ballPos = room.gameState?.ballPosition;
    if (ballPos && Math.random() < 0.7) {
        let correctBlockPos = 3;
        if (ballPos === 4) correctBlockPos = 2;
        if (ballPos === 2) correctBlockPos = 4;
        if (ballPos === 3) correctBlockPos = 3;
        console.log(`[AI FALLBACK] Using smart block position: ${correctBlockPos}`);
        return correctBlockPos;
    }
    const positions = [2, 3, 4];
    const fallback = positions[Math.floor(Math.random() * positions.length)];
    console.log(`[AI FALLBACK] Using random block position: ${fallback}`);
    return fallback;
}

async function aiMakeMove(roomId, room, io) {
    try {
        // 🛡️ ВАЛИДАЦИЯ
        if (!room) {
            console.error(`[AI ERROR] Room ${roomId} not found!`);
            return;
        }
        if (!room.gameState) {
            console.error(`[AI ERROR] GameState not initialized in room ${roomId}`);
            return;
        }
        if (!room.isAI) {
            console.error(`[AI ERROR] This is not an AI match in room ${roomId}`);
            return;
        }
        if (room.gameState.turn !== 'AI') {
            console.log(`[AI] Not AI turn yet, waiting... (Current turn: ${room.gameState.turn})`);
            return;
        }

        const phase = room.gameState.phase;
        if (!phase) {
            console.error(`[AI ERROR] No phase in gameState for room ${roomId}`);
            return;
        }

        console.log(`🤖 [AI MOVE] Room: ${roomId}, Phase: ${phase}`);
        
        // 🛡️ ОЧИЩАЕМ СТАРЫЙ ТАЙМАУТ ЕСЛИ БЫЛ
        if (aiMoveTimeouts[roomId]) {
            clearTimeout(aiMoveTimeouts[roomId]);
        }

        // 🛡️ УСТАНАВЛИВАЕМ ТАЙМАУТ НА 10 СЕКУНД
        const timeoutId = setTimeout(() => {
            console.warn(`[AI TIMEOUT] AI move took too long in room ${roomId}, forcing action...`);
            if (games[roomId] && games[roomId].gameState.turn === 'AI') {
                console.log(`[AI FORCE] Forcing move for phase ${games[roomId].gameState.phase}`);
                // Пытаемся принудительно сделать ход
                const currentRoom = games[roomId];
                const currentPhase = currentRoom.gameState.phase;
                try {
                    if (currentPhase === 'SERVE') {
                        handleServe(roomId, currentRoom, 'AI', io);
                    } else if (currentPhase === 'SET') {
                        const targetPos = aiChooseSetPosition(currentRoom);
                        handleSet(roomId, currentRoom, 'AI', targetPos, io, null);
                    } else if (currentPhase === 'BLOCK') {
                        const blockPos = aiChooseBlockPosition(currentRoom);
                        handleBlock(roomId, currentRoom, 'AI', blockPos, io);
                    }
                } catch (error) {
                    console.error(`[AI FORCE ERROR] ${error.message}`);
                }
            }
            delete aiMoveTimeouts[roomId];
        }, 10000); // 10 секунд таймаут

        aiMoveTimeouts[roomId] = timeoutId;
        
        await delay(2000 + Math.random() * 1000);

        // 🛡️ ПРОВЕРЯЕМ ЕЩЕ РАЗ ПОСЛЕ ЗАДЕРЖКИ
        if (!games[roomId] || games[roomId].gameState.turn !== 'AI') {
            clearTimeout(aiMoveTimeouts[roomId]);
            delete aiMoveTimeouts[roomId];
            console.warn(`[AI] Game state changed while waiting`);
            return;
        }

        if (phase === 'SERVE') {
            handleServe(roomId, room, 'AI', io);
        } 
        else if (phase === 'SET') {
            const targetPos = aiChooseSetPosition(room);
            if (!targetPos || ![2, 3, 4].includes(targetPos)) {
                console.error(`[AI ERROR] Invalid set position: ${targetPos}`);
                return;
            }
            handleSet(roomId, room, 'AI', targetPos, io, null);
        }
        else if (phase === 'BLOCK') {
            const blockPos = aiChooseBlockPosition(room);
            if (!blockPos || ![2, 3, 4].includes(blockPos)) {
                console.error(`[AI ERROR] Invalid block position: ${blockPos}`);
                return;
            }
            handleBlock(roomId, room, 'AI', blockPos, io);
        }
        else {
            console.error(`[AI ERROR] Unknown phase: ${phase}`);
        }

        // 🛡️ ОЧИЩАЕМ ТАЙМАУТ ПОСЛЕ УСПЕШНОГО ВЫПОЛНЕНИЯ
        clearTimeout(aiMoveTimeouts[roomId]);
        delete aiMoveTimeouts[roomId];
    } catch (error) {
        console.error(`[AI EXCEPTION] ${error.message}`, error);
        clearTimeout(aiMoveTimeouts[roomId]);
        delete aiMoveTimeouts[roomId];
    }
}

// ========== ОБРАБОТЧИКИ ДЕЙСТВИЙ ========== 

async function handleServe(roomId, room, playerId, io) {
    console.log(`[SERVE] Игрок ${playerId} подает`);
    console.log(`[ACTION] Player: ${playerId}, Current turn: ${room.gameState.turn}`);

    const isTeam1 = room.players[0] === playerId;
    const attackingTeam = isTeam1 ? room.team1 : room.team2;
    const defendingTeam = isTeam1 ? room.team2 : room.team1;

    const serverPlayer = attackingTeam.find(p => p.position === 1);
    const backRow = defendingTeam.filter(p => [1, 5, 6].includes(p.position));
    const receiver = backRow[Math.floor(Math.random() * backRow.length)] || defendingTeam[0];

    if (room.gameState.lastServerId === serverPlayer.id) {
        room.gameState.serveStreak++;
    } else {
        room.gameState.lastServerId = serverPlayer.id;
        room.gameState.serveStreak = 0;
    }
    const adaptationPenalty = room.gameState.serveStreak * 3;

    const sStats = getEffectiveStats(serverPlayer, attackingTeam);
    const rStats = getEffectiveStats(receiver, defendingTeam);

    const serveQuirk = applyQuirks('SERVE', serverPlayer, sStats);
    const digQuirk = applyQuirks('DIG', receiver, rStats);

    const attackRoll = Math.floor(Math.random() * 20) + 1;
    const defenseRoll = Math.floor(Math.random() * 20) + 1;
    
    let totalAttack = sStats.serve + attackRoll + serveQuirk.bonus - adaptationPenalty;
    if (totalAttack < 1) totalAttack = 1;

    const totalDefense = rStats.receive + defenseRoll + digQuirk.bonus;
    const diff = totalDefense - totalAttack;

    let message = '';
    let quirkMsg = [...serveQuirk.log, ...digQuirk.log];
    if (adaptationPenalty > 0) quirkMsg.push(`📉 Привыкание: -${adaptationPenalty}`);
    if (quirkMsg.length > 0) message = `[${quirkMsg.join(' | ')}] `;
    
    let isCritical = false;
    let isBadReception = false;

    await delay(1000);
    
    if (diff < -5) {
        // --- ЭЙС ---
        if (diff < -10) {
            isCritical = true;
            message += `💥 РАЗРЫВНОЙ ЭЙС! ${serverPlayer.name} сносит ${receiver.name}!`;
        } else {
            message += `🔥 ЭЙС! ${serverPlayer.name} пробил ${receiver.name}!`;
        }
        
        // Очки и статистика
        if (serverPlayer.matchStats) serverPlayer.matchStats.points++;
        if (isTeam1) room.gameState.score.team1++;
        else room.gameState.score.team2++;
        
        // 🧠 ОБНОВЛЯЕМ СЧЕТ В ИИ
        if (room.isAI && room.aiInstance && room.aiInstance.updateScore) {
            room.aiInstance.updateScore(room.gameState.score.team1, room.gameState.score.team2);
        }
        
        room.gameState.phase = 'SERVE';
        room.gameState.turn = playerId;

        // ПРОВЕРКА ПОБЕДЫ (ЭЙСОМ)
        if (checkGameOver(room, io, roomId)) return; // Выход, если игра кончилась

    } else {
        // --- ПРИЕМ ---
        if (diff < 0) {
            message += `⚠️ Тяжелый прием от ${receiver.name}...`;
            isBadReception = true; 
        } else {
            message += `🏐 Отличный довод! ${receiver.name} -> Связующий.`;
            isBadReception = false;
        }
        
        room.gameState.phase = 'SET';
        room.gameState.turn = room.players.find(id => id !== playerId);
    }

    io.to(roomId).emit('serve_result', {
        message,
        score: room.gameState.score,
        nextTurn: room.gameState.turn,
        phase: room.gameState.phase,
        serverId: serverPlayer.id, 
        attackerId: serverPlayer.id,
        receiverId: receiver.id, 
        valAtk: totalAttack,
        valDef: totalDefense,
        isBadReception: isBadReception,
        isCritical: isCritical,
        winSide: diff < -5 ? 'ATTACK' : 'DEFENSE'
    });
    
    console.log(`✅ [SERVE] Next turn: ${room.gameState.turn}, Phase: ${room.gameState.phase}`);

    if (room.isAI && room.gameState.turn === 'AI') {
        aiMakeMove(roomId, room, io);
    }
}

async function handleSet(roomId, room, playerId, targetPos, io, socket) {
    console.log(`[ACTION] Player: ${playerId}, Current turn: ${room.gameState.turn}`);
    const isTeam1 = room.players[0] === playerId;
    const myTeam = isTeam1 ? room.team1 : room.team2;
    const enemyTeam = isTeam1 ? room.team2 : room.team1;
    
    const setterPlayer = myTeam.find(p => p.position === 3) || myTeam[0];
    const sStats = getEffectiveStats(setterPlayer, myTeam);
    
    const setterBonus = Math.floor(sStats.set / 4);
    const hasDaisho = enemyTeam.some(p => p.id === 'daisho');
    if (hasDaisho) {
        setterBonus -= 2;
        console.log(`КВИРК ДАЙШО: Сеттер ${setterPlayer.name} получает -2 (итого: ${setterBonus})`);
    }
    room.gameState.setterBonus = setterBonus;

    room.gameState.ballPosition = targetPos; 
    room.gameState.phase = 'BLOCK';
    
    const defenderId = room.players.find(id => id !== playerId);
    if (!defenderId) {
        console.error(`[SET ERROR] Cannot find defender. Players: ${room.players}`);
        return;
    }
    room.gameState.turn = defenderId;

    let positionName = "";
    if (targetPos === 4) positionName = "ЛЕВЫЙ ФЛАНГ";
    if (targetPos === 3) positionName = "ПАЙП (Задняя линия)";
    if (targetPos === 2) positionName = "ПРАВЫЙ ФЛАНГ";

    await delay(1200);
    let bonusText = `Бонус +${setterBonus}`;
    if (hasDaisho && setterBonus < Math.floor(sStats.set / 4)) {
        bonusText = `Бонус ${setterBonus} [Дайшо: -2]`;
    }

    if (playerId !== 'AI' && socket) {
        socket.emit('set_result', {
            message: `Вы отдали пас на ${positionName} (Бонус +${setterBonus})`,
            phase: 'BLOCK',
            nextTurn: defenderId,
            targetPos: targetPos, 
            setterId: setterPlayer.id 
        });

        socket.to(roomId).emit('set_made', {
            message: `Связующий соперника сделал передачу!`,
            phase: 'BLOCK',
            nextTurn: defenderId,
            setterId: setterPlayer.id,
            targetPos: targetPos 
        });
    } else if (playerId === 'AI') {
        io.to(roomId).emit('set_made', {
            message: `Компьютер сделал передачу!`,
            phase: 'BLOCK',
            nextTurn: defenderId,
            setterId: 'AI',
            targetPos: targetPos
        });
    }

    console.log(`✅ [SET] Next turn: ${defenderId}, Phase: BLOCK`);

    if (room.isAI && room.gameState.turn === 'AI') {
        aiMakeMove(roomId, room, io);
    }
}

async function handleBlock(roomId, room, playerId, blockPos, io) {
    console.log(`[ACTION] Player: ${playerId}, Current turn: ${room.gameState.turn}`);
    const ballPos = room.gameState.ballPosition; 
    let attackPosition = ballPos;
    if (ballPos === 3) attackPosition = 6; 

    let correctBlockPos = 3;
    if (ballPos === 4) correctBlockPos = 2;
    if (ballPos === 2) correctBlockPos = 4;
    if (ballPos === 3) correctBlockPos = 3; 
    
    const defenderId = playerId;
    const isTeam1Defending = room.players[0] === defenderId;
    const defendingTeam = isTeam1Defending ? room.team1 : room.team2;
    const attackingTeam = isTeam1Defending ? room.team2 : room.team1;

    const spiker = attackingTeam.find(p => p.position === attackPosition) 
                    || attackingTeam.find(p => p.position === 4) 
                    || attackingTeam.find(p => p.position === 2) 
                    || attackingTeam[0];
    
    // ✨ КВИРК KYOTANI: 30% ШАНС АУТА
    if (spiker.id === 'kyotani' && Math.random() < 0.3) {
        await delay(1200);
        
        let message = `🐺 АУТ! Кётани промахнулся!`;
        const details = `Mad Dog бьёт мимо площадки`;
        let nextTurn = null;
        let nextPhase = 'SERVE';
        
        // Очки и ротация
        const updateScoreAndRotate = (isTeam1Winner) => {
            if (isTeam1Winner) {
                room.gameState.score.team1++;
                if (room.gameState.servingTeam === 'team2') {
                    rotateTeam(room.team1);
                    message += ' (Переход подачи!)';
                    room.gameState.servingTeam = 'team1';
                }
                nextTurn = room.players[0];
            } else {
                room.gameState.score.team2++;
                if (room.gameState.servingTeam === 'team1') {
                    rotateTeam(room.team2);
                    message += ' (Переход подачи!)';
                    room.gameState.servingTeam = 'team2';
                }
                nextTurn = room.players[1];
            }
        };
        
        updateScoreAndRotate(isTeam1Defending);
        
        room.gameState.turn = nextTurn;
        room.gameState.phase = nextPhase;
        
        if (checkGameOver(room, io, roomId)) {
            return;
        } else {
            io.to(roomId).emit('spike_result', {
                message: message,
                score: room.gameState.score,
                nextTurn: nextTurn,
                phase: nextPhase,
                details: details,
                team1: room.team1,
                team2: room.team2,
                isCritical: false,
                isLegendary: false,
                attackerId: spiker.id,
                trajectory: {
                    type: 'OUT',
                    startId: spiker.id,
                    endId: null
                },
                valAtk: 0,
                valDef: 0,
                winSide: 'DEFENSE'
            });

            if (room.isAI && room.gameState.turn === 'AI') {
                aiMakeMove(roomId, room, io);
            }
        }
        return; // Выход - обычная атака не выполняется
    }
    
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
    
    let ninjaMsg = "";
    if (spiker.id === 'hinata_ts' && isGuessCorrect) {
        const ninjaRoll = Math.random();
        if (ninjaRoll > 0.5) { 
            blockPower = 0; 
            ninjaMsg = ` НИНДЗЯ! Хината отыграл от рук в аут!`;
        }
    }

    let winner = null;
    let details = '';
    let nextPhase = 'SERVE';
    let nextTurn = null;
    let trajectoryType = 'NORMAL'; 
    let startActorId = spiker.id;
    let endActorId = floorDefender.id;

    await delay(1200);

    let isKillBlock = isGuessCorrect && blockPower > attackPower;
    if (isKillBlock && spiker.id === 'hyakuzawa') {
        isKillBlock = false;
        message += ` Хякузава над блоком! `;
        attackPower = Math.floor(attackPower * 0.7); 
    }

    if (isKillBlock) {
        winner = 'DEFENSE';
        message += `🧱 MONSTER BLOCK! ${blocker.name} заблокировал!`;
        details = `Блок ${blockPower} > Атака ${attackPower}`;
        trajectoryType = 'BOUNCE'; 
        startActorId = blocker.id;
        endActorId = spiker.id; 
    } else {
        let remainingForce = attackPower;
        let preMsg = '';
        if (ninjaMsg) message += ninjaMsg;
        
        if (isGuessCorrect && blockPower > 0) {
            remainingForce = Math.floor(attackPower - (blockPower * 0.5));
            if (remainingForce < 5) remainingForce = 5; 
            preMsg = `🛡️ Смягчение блоком!`;
            trajectoryType = 'SOFT'; 
            startActorId = blocker.id;
            endActorId = floorDefender.id;
        } else {
            remainingForce = attackPower;
            preMsg = `💥 ЧИСТАЯ СЕТКА!`;
            trajectoryType = 'NORMAL'; 
            startActorId = spiker.id;
            endActorId = floorDefender.id;
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
            if (spiker.matchStats) spiker.matchStats.points++;
        } else if (winner === 'DEFENSE') {
            if (isKillBlock) {
                if (blocker.matchStats) {
                    blocker.matchStats.blocks++;
                    blocker.matchStats.points++;
                }
            } else {
                if (floorDefender.matchStats) floorDefender.matchStats.points++;
            }
        }

        const updateScoreAndRotate = (isTeam1Winner) => {
            if (isTeam1Winner) {
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
        };

        if (winner === 'ATTACK') {
            updateScoreAndRotate(!isTeam1Defending);
        } else {
            updateScoreAndRotate(isTeam1Defending);
        }
    } 
    
    room.gameState.turn = nextTurn;
    room.gameState.phase = nextPhase;

    // Защита от null
    if (nextTurn === null) {
        console.error('❌ [CRITICAL] nextTurn is NULL!');
        nextTurn = defenderId; // Fallback
        room.gameState.turn = nextTurn;
    }

    let isCritical = false;
    let isLegendary = false; 

    if (winner === 'DEFENSE' && isKillBlock) isCritical = true;
    if (winner === 'ATTACK') {
         let rf = (isGuessCorrect && blockPower > 0) ? Math.floor(attackPower - (blockPower * 0.5)) : attackPower;
         if (rf - digPower > 10) isCritical = true;
         if (spiker.id === 'hinata_ts' || (ninjaMsg && ninjaMsg.length > 0)) {
             isLegendary = true;
             isCritical = true;
         }
    }
    
    // ПРОВЕРКА ПОБЕДЫ (С УЧЕТОМ MVP)
    if (winner && checkGameOver(room, io, roomId)) {
        return; // Игра закончена, больше ничего не отправляем
    } else {
        console.log(`✅ [BLOCK] Next turn: ${nextTurn}, Phase: ${nextPhase}`);
        io.to(roomId).emit('spike_result', {
            message: message + rotMessage,
            score: room.gameState.score,
            nextTurn: nextTurn,
            phase: nextPhase,
            details: details,
            team1: room.team1, 
            team2: room.team2,
            isCritical: isCritical,
            isLegendary: isLegendary,
            
            attackerId: spiker.id,
            trajectory: {
                type: trajectoryType,
                startId: startActorId,
                endId: endActorId
            },
            
            valAtk: attackPower,
            valDef: (isGuessCorrect && blockPower > attackPower) ? blockPower : digPower,
            winSide: winner
        });

        if (room.isAI && room.gameState.turn === 'AI') {
            aiMakeMove(roomId, room, io);
        }
    }
}

// ========== ТУРНИРНАЯ СИСТЕМА ========== 

const TOURNAMENT_AI_ORDER = ['PHANTOM', 'TACTICAL', 'DATA', 'APEX'];

function initializeTournament(playerTeam) {
    const shuffledOrder = [...TOURNAMENT_AI_ORDER].sort(() => 0.5 - Math.random());
    
    return {
        playerTeam: playerTeam,
        matches: [
            {
                id: 1,
                aiType: shuffledOrder[0],
                playerScore: 0,
                aiScore: 0,
                status: 'UPCOMING',
                result: null
            },
            {
                id: 2,
                aiType: shuffledOrder[1],
                playerScore: 0,
                aiScore: 0,
                status: 'UPCOMING',
                result: null
            },
            {
                id: 3,
                aiType: shuffledOrder[2],
                playerScore: 0,
                aiScore: 0,
                status: 'UPCOMING',
                result: null
            },
            {
                id: 4,
                aiType: shuffledOrder[3],
                playerScore: 0,
                aiScore: 0,
                status: 'UPCOMING',
                result: null
            }
        ],
        currentMatchId: 1,
        wins: 0,
        losses: 0,
        aiOrder: shuffledOrder
    };
}

function getTournamentState(tournament) {
    return {
        currentMatchId: tournament.currentMatchId,
        matches: tournament.matches,
        wins: tournament.wins,
        losses: tournament.losses,
        aiOrder: tournament.aiOrder
    };
}

// ========== СОКЕТЫ ========== 

io.on('connection', (socket) => {
    console.log(`[+] Игрок подключился: ${socket.id}`);

    // AI MODE
    socket.on('create_ai_game', ({ aiType = 'CHAOS' } = {}) => {
        const roomId = 'AI-' + Math.random().toString(36).substring(2, 7).toUpperCase();
        games[roomId] = {
            players: [socket.id, 'AI'],
            team1: [],
            team2: [],
            state: 'draft',
            bannedCharacters: [],
            isAI: true,
            aiTeamReady: false,
            aiType: aiType,
            aiInstance: null
        };
        socket.join(roomId);
        
        io.to(roomId).emit('game_started', { 
            start: true, 
            players: [socket.id, 'AI'],
            allCharacters: characters,
            roomId: roomId
        });
        
        games[roomId].draftTurn = socket.id;
        io.to(roomId).emit('draft_turn', { turn: socket.id });
    });

    // PVP MODE
    socket.on('create_game', () => {
        const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
        games[roomId] = {
            players: [socket.id],
            team1: [],
            team2: [],
            state: 'lobby',
            bannedCharacters: [],
            isAI: false
        };
        socket.join(roomId);
        socket.emit('game_created', roomId);
    });

    socket.on('join_game', (roomId) => {
        const room = games[roomId];
        if (room && room.players.length < 2 && !room.isAI) {
            room.players.push(socket.id);
            socket.join(roomId);
            io.to(roomId).emit('game_started', { 
                start: true, 
                players: room.players,
                allCharacters: characters,
                roomId: roomId 
            });
            room.draftTurn = room.players[Math.random() < 0.5 ? 0 : 1];
            io.to(roomId).emit('draft_turn', { turn: room.draftTurn });
        } else {
            socket.emit('error_message', 'Ошибка входа');
        }
    });

    socket.on('character_picked', ({ roomId, charId }) => {
        const room = games[roomId];
        if (!room || !room.players) return;
        
        if (room.isAI || room.draftTurn === socket.id) {
            if (!room.bannedCharacters.includes(charId)) {
                room.bannedCharacters.push(charId);
                io.to(roomId).emit('banned_characters', room.bannedCharacters);
                
                if (!room.isAI) {
                    const otherId = room.players.find(id => id !== socket.id);
                    room.draftTurn = otherId;
                    io.to(roomId).emit('draft_turn', { turn: room.draftTurn });
                } else {
                    io.to(roomId).emit('draft_turn', { turn: socket.id });
                }
            }
        }
    });

    socket.on('team_ready', ({ roomId, team }) => {
        const room = games[roomId];
        if (!room || !room.players) return;

        // ВАЖНО: Добавляем статы и восстанавливаем их из БД если нужно
        const teamWithStats = team.map(p => {
            const charFromDB = characters.find(c => c.id === p.id);
            return {
                ...p,
                stats: p.stats || (charFromDB ? charFromDB.stats : p.stats),
                quirk: p.quirk || (charFromDB ? charFromDB.quirk : p.quirk),
                img: p.img || (charFromDB ? charFromDB.img : p.img),
                matchStats: { points: 0, blocks: 0 }
            };
        });

        if (socket.id === room.players[0]) room.team1 = teamWithStats;
        else room.team2 = teamWithStats;

        if (room.isAI && room.team1.length === 6 && !room.aiTeamReady) {
            room.aiTeamReady = true;
            room.team2 = aiDraftTeam(room.bannedCharacters);
            
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

            // 🤖 ИНИЦИАЛИЗИРУЕМ ИИ
            const aiTeam = firstServerIndex === 0 ? room.team2 : room.team1;
            const humanTeam = firstServerIndex === 0 ? room.team1 : room.team2;
            room.aiInstance = AIFactory.createAI(room.aiType, aiTeam, humanTeam);
            console.log(`🤖 ИИ инициализирован: ${room.aiType}`);

            room.draftTurn = null;
            io.to(roomId).emit('draft_finished');

            io.to(roomId).emit('match_start', { 
                team1: room.team1, 
                team2: room.team2,
                players: room.players,
                turn: servingPlayerId,
                score: room.gameState.score
            });

            if (servingPlayerId === 'AI') {
                aiMakeMove(roomId, room, io);
            }
        }
        else if (!room.isAI && room.players && room.team1.length === 6 && room.team2.length === 6) {
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

socket.on('action_serve', ({ roomId }) => {
    const room = games[roomId];
    
    // ✅ УЛУЧШЕННАЯ ПРОВЕРКА
    if (!room) {
        console.error(`[SERVE ERROR] Room ${roomId} not found`);
        socket.emit('error_message', 'Комната не найдена');
        return;
    }
    
    if (!room.gameState) {
        console.error(`[SERVE ERROR] GameState not initialized in room ${roomId}`);
        socket.emit('error_message', 'Игра не инициализирована');
        return;
    }
    
    if (room.gameState.turn !== socket.id) {
        console.log(`[SERVE] Not your turn. Current: ${room.gameState.turn}, You: ${socket.id}`);
        return;
    }
    
    handleServe(roomId, room, socket.id, io);
});

    socket.on('action_set', ({ roomId, targetPos }) => {
        const room = games[roomId];
        
        // ✅ УЛУЧШЕННАЯ ПРОВЕРКА
        if (!room) {
            console.error(`[SET ERROR] Room ${roomId} not found`);
            socket.emit('error_message', 'Комната не найдена');
            return;
        }
        
        if (!room.gameState) {
            console.error(`[SET ERROR] GameState not initialized in room ${roomId}`);
            socket.emit('error_message', 'Игра не инициализирована');
            return;
        }
        
        if (room.gameState.turn !== socket.id) {
            console.log(`[SET] Not your turn. Current: ${room.gameState.turn}, You: ${socket.id}`);
            return;
        }
        
        // 🧠 ЗАПИСЬ ДЕЙСТВИЯ ИГРОКА ДЛЯ АНАЛИЗА ИИ
        if (room.isAI && room.aiInstance) {
            if (room.aiInstance.recordPlayerSet) {
                room.aiInstance.recordPlayerSet(targetPos);
            }
            if (room.aiInstance.recordAction) {
                room.aiInstance.recordAction({ type: 'SET', position: targetPos });
            }
        }
        
        handleSet(roomId, room, socket.id, targetPos, io, socket);
    });

    socket.on('action_block', ({ roomId, blockPos }) => {
        const room = games[roomId];
        
        // ✅ УЛУЧШЕННАЯ ПРОВЕРКА
        if (!room) {
            console.error(`[BLOCK ERROR] Room ${roomId} not found`);
            socket.emit('error_message', 'Комната не найдена');
            return;
        }
        
        if (!room.gameState) {
            console.error(`[BLOCK ERROR] GameState not initialized in room ${roomId}`);
            socket.emit('error_message', 'Игра не инициализирована');
            return;
        }
        
        if (room.gameState.turn !== socket.id) {
            console.log(`[BLOCK] Not your turn. Current: ${room.gameState.turn}, You: ${socket.id}`);
            return;
        }
        
        handleBlock(roomId, room, socket.id, blockPos, io);
    });

    // ========== TOURNAMENT HANDLERS ==========
    socket.on('create_tournament', () => {
        const roomId = 'TOUR-' + Math.random().toString(36).substring(2, 7).toUpperCase();
        games[roomId] = {
            roomId: roomId,
            playerId: socket.id,
            state: 'draft',
            isTournament: true,
            tournament: null,
            playerTeam: [],
            bannedCharacters: [],
            draftTurn: socket.id,
            isProcessingPick: false // Защита от гонок при автопиках ИИ
        };
        socket.join(roomId);
        
        io.to(roomId).emit('game_started', { 
            start: true, 
            players: [socket.id, 'AI'],
            allCharacters: characters,
            roomId: roomId,
            isTournament: true
        });
        
        io.to(roomId).emit('draft_turn', { turn: socket.id });
    });

    socket.on('tournament_character_picked', ({ roomId, charId }) => {
        const room = games[roomId];
        if (!room || !room.isTournament) return;

        console.log(`[TOURNAMENT PICK] Room ${roomId}, Player ${socket.id}, Char ${charId}`);
        console.log(`[TOURNAMENT PICK] room.draftTurn = ${room.draftTurn}`);
        console.log(`[TOURNAMENT PICK] room.playerId = ${room.playerId}`);
        console.log(`[TOURNAMENT PICK] bannedCharacters = ${room.bannedCharacters.join(', ')}`);

        // ❌ УБИРАЕМ ПРОВЕРКУ НА ХОД В ТУРНИРЕ - игрок всегда может пикать
        // if (room.draftTurn !== socket.id) {
        //     socket.emit('pick_result', { success: false, reason: 'not_your_turn', charId });
        //     return;
        // }

        // Проверяем, не выбран ли уже этот персонаж
        if (room.bannedCharacters.includes(charId)) {
            socket.emit('pick_result', { success: false, reason: 'already_picked', charId });
            console.log(`[PICK REJECT] Already picked ${charId}`);
            return;
        }

        // Применяем пик
        room.playerId = socket.id;
        room.bannedCharacters.push(charId);
        
        console.log(`[PICK SUCCESS] ${charId} banned, total: ${room.bannedCharacters.length}`);
        
        // Отправляем обновления
        io.to(roomId).emit('banned_characters', room.bannedCharacters);
        socket.emit('pick_result', { success: true, charId });
        
        // В турнире ход ВСЕГДА остаётся у игрока
        room.draftTurn = socket.id;
        io.to(roomId).emit('draft_turn', { turn: socket.id });
        
        console.log(`[PICK COMPLETE] Next turn: ${socket.id}`);
    });

    socket.on('tournament_team_ready', ({ roomId, team }) => {
        const room = games[roomId];
        if (!room || !room.isTournament) return;

        const teamWithStats = team.map(p => {
            const charFromDB = characters.find(c => c.id === p.id);
            return {
                ...p,
                stats: p.stats || (charFromDB ? charFromDB.stats : p.stats),
                quirk: p.quirk || (charFromDB ? charFromDB.quirk : p.quirk),
                img: p.img || (charFromDB ? charFromDB.img : p.img),
                matchStats: { points: 0, blocks: 0 }
            };
        });

        room.playerTeam = teamWithStats;
        room.tournament = initializeTournament(teamWithStats);
        room.state = 'tournament';

        io.to(roomId).emit('tournament_started', {
            tournament: getTournamentState(room.tournament)
        });
    });

    socket.on('start_tournament_match', ({ roomId, matchId }) => {
        const room = games[roomId];
        if (!room || !room.isTournament || !room.tournament) {
            console.error(`[TOURNAMENT ERROR] Invalid room ${roomId}`);
            return;
        }

        const match = room.tournament.matches.find(m => m.id === matchId);
        if (!match) {
            console.error(`[TOURNAMENT ERROR] Match ${matchId} not found`);
            return;
        }

        const gameRoomId = roomId + '-M' + matchId;
        
        console.log(`🏆 [TOURNAMENT] Creating match room: ${gameRoomId}`);
        console.log(`🏆 [TOURNAMENT] Player: ${socket.id}`);
        console.log(`🏆 [TOURNAMENT] AI Type: ${match.aiType}`);
        
        games[gameRoomId] = {
            players: [socket.id, 'AI'],
            team1: [],
            team2: [],
            state: 'match',
            bannedCharacters: [],
            isAI: true,
            aiTeamReady: true,
            aiType: match.aiType,
            aiInstance: null,
            isTournament: true,
            tournamentRoomId: roomId,
            matchId: matchId
        };
        socket.join(gameRoomId);

        games[gameRoomId].team1 = room.playerTeam.map(p => ({...p, matchStats: { points: 0, blocks: 0 }}));
        games[gameRoomId].team2 = aiDraftTeam(games[gameRoomId].team1.map(p => p.id));

        const servingPlayerId = socket.id;
        
        games[gameRoomId].gameState = {
            phase: 'SERVE', 
            turn: servingPlayerId, 
            score: { team1: 0, team2: 0 },
            servingTeam: 'team1',
            setterBonus: 0,
            lastServerId: null,
            serveStreak: 0
        };

        const aiTeam = games[gameRoomId].team2;
        const humanTeam = games[gameRoomId].team1;
        games[gameRoomId].aiInstance = AIFactory.createAI(match.aiType, aiTeam, humanTeam);
        
        console.log(`🤖 [TOURNAMENT] AI initialized: ${match.aiType}`);
        console.log(`🎮 [TOURNAMENT] Initial turn: ${servingPlayerId}`);

        io.to(gameRoomId).emit('match_start', { 
            team1: games[gameRoomId].team1, 
            team2: games[gameRoomId].team2,
            players: [socket.id, 'AI'],
            turn: servingPlayerId,
            score: games[gameRoomId].gameState.score,
            isTournament: true,
            matchId: matchId,
            aiType: match.aiType,
            gameRoomId: gameRoomId // ← ОТПРАВЛЯЕМ ПРАВИЛЬНЫЙ roomId
        });

        // ❌ УБИРАЕМ ЭТОТ ВЫЗОВ - он лишний, подача начинается с игрока
        // aiMakeMove(gameRoomId, games[gameRoomId], io);
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