const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

// Убедись, что файл ./data/characters.js существует!
const characters = require('./data/characters');

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
    // Пример синергии (Кенма + Некома)
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
        if (player.id === 'kuroo') { bonus += 4; log.push(`😼 Килл-блок!`); }
        if (player.id === 'tsukishima') { bonus += 4; log.push(`🌙 Чтение блока!`); }
        if (player.id === 'tendo') { bonus += 5; log.push(`👻 Guess Block!`); }
        if (player.id === 'aone') { bonus += 5; log.push(`🛡️ Железная стена!`); }
    }

    if (actionType === 'DIG') {
        if (player.id === 'nishinoya') { bonus += 5; log.push(`⚡ ROLLING THUNDER!`); }
        if (player.id === 'yaku') { bonus += 4; log.push(`🐈 Страж Яку!`); }
        if (player.id === 'daichi') { bonus += 2; log.push(`🛡️ Капитан тащит!`); }
    }

    return { bonus, log };
}

// 🤖 ========== ЛОГИКА ИИ ========== 🤖

function aiDraftTeam(bannedIds = []) {
    const available = characters.filter(c => !bannedIds.includes(c.id));
    const shuffled = [...available].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 6).map((char, index) => ({
        ...char,
        position: index + 1
    }));
}

function aiChooseSetPosition(room) {
    const positions = [2, 3, 4];
    return positions[Math.floor(Math.random() * positions.length)];
}

function aiChooseBlockPosition(room) {
    const ballPos = room.gameState.ballPosition;
    // 70% шанс угадать правильно
    if (Math.random() < 0.7) {
        let correctBlockPos = 3;
        if (ballPos === 4) correctBlockPos = 2;
        if (ballPos === 2) correctBlockPos = 4;
        if (ballPos === 3) correctBlockPos = 3;
        return correctBlockPos;
    }
    // 30% ошибается
    const positions = [2, 3, 4];
    return positions[Math.floor(Math.random() * positions.length)];
}

// ИИ делает действие
async function aiMakeMove(roomId, room, io) {
    // Длинная задержка для плавности
    await delay(2000 + Math.random() * 1000);
    
    if (!room.isAI || room.gameState.turn !== 'AI') return;
    
    const phase = room.gameState.phase;
    
    if (phase === 'SERVE') {
        handleServe(roomId, room, 'AI', io);
    } 
    else if (phase === 'SET') {
        const targetPos = aiChooseSetPosition(room);
        handleSet(roomId, room, 'AI', targetPos, io, null);
    }
    else if (phase === 'BLOCK') {
        const blockPos = aiChooseBlockPosition(room);
        handleBlock(roomId, room, 'AI', blockPos, io);
    }
}

// ========== ОБРАБОТЧИКИ ДЕЙСТВИЙ ========== 

async function handleServe(roomId, room, playerId, io) {
    console.log(`[SERVE] Игрок ${playerId} подает`);

    const isTeam1 = room.players[0] === playerId;
    const attackingTeam = isTeam1 ? room.team1 : room.team2;
    const defendingTeam = isTeam1 ? room.team2 : room.team1;

    const serverPlayer = attackingTeam.find(p => p.position === 1);
    
    // Определяем жертву (принимающего)
    const backRow = defendingTeam.filter(p => [1, 5, 6].includes(p.position));
    const receiver = backRow[Math.floor(Math.random() * backRow.length)] || defendingTeam[0];

    // Пенальти за серию подач
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
    
    // ВЫЧИТАЕМ PENALTY ИЗ АТАКИ
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

    // Задержка анимации подачи
    await delay(1000);
    
    if (diff < -5) {
        if (diff < -10) {
            isCritical = true;
            message += `💥 РАЗРЫВНОЙ ЭЙС! ${serverPlayer.name} сносит ${receiver.name}!`;
        } else {
            message += `🔥 ЭЙС! ${serverPlayer.name} пробил ${receiver.name}!`;
        }

        if (isTeam1) room.gameState.score.team1++;
        else room.gameState.score.team2++;
        
        room.gameState.phase = 'SERVE';
        room.gameState.turn = playerId;
    } else {
        // Мяч поднят
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
        serverId: serverPlayer.id, // Character ID
        attackerId: serverPlayer.id,
        receiverId: receiver.id, // ID для полета мяча
        valAtk: totalAttack,
        valDef: totalDefense,
        isBadReception: isBadReception,
        isCritical: isCritical,
        winSide: diff < -5 ? 'ATTACK' : 'DEFENSE'
    });

    if (room.isAI && room.gameState.turn === 'AI') {
        aiMakeMove(roomId, room, io);
    }
}

async function handleSet(roomId, room, playerId, targetPos, io, socket) {
    const isTeam1 = room.players[0] === playerId;
    const myTeam = isTeam1 ? room.team1 : room.team2;
    
    // Находим персонажа-связующего (Тот, кто на позиции 3)
    const setterPlayer = myTeam.find(p => p.position === 3) || myTeam[0];
    const sStats = getEffectiveStats(setterPlayer, myTeam);
    
    const setterBonus = Math.floor(sStats.set / 4);
    room.gameState.setterBonus = setterBonus;

    room.gameState.ballPosition = targetPos; 
    room.gameState.phase = 'BLOCK';
    
    const defenderId = room.players.find(id => id !== playerId);
    room.gameState.turn = defenderId;

    let positionName = "";
    if (targetPos === 4) positionName = "ЛЕВЫЙ ФЛАНГ";
    if (targetPos === 3) positionName = "ПАЙП (Задняя линия)";
    if (targetPos === 2) positionName = "ПРАВЫЙ ФЛАНГ";

    // Задержка анимации паса
    await delay(1200);

    // ОТПРАВЛЯЕМ ID ПЕРСОНАЖА (setterPlayer.id), А НЕ СОКЕТА (playerId)
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
            setterId: setterPlayer.id 
        });
    } else if (playerId === 'AI') {
        io.to(roomId).emit('set_made', {
            message: `Компьютер сделал передачу!`,
            phase: 'BLOCK',
            nextTurn: defenderId,
            setterId: 'AI'
        });
    }

    if (room.isAI && room.gameState.turn === 'AI') {
        aiMakeMove(roomId, room, io);
    }
}

async function handleBlock(roomId, room, playerId, blockPos, io) {
    const ballPos = room.gameState.ballPosition; 
    
    let attackPosition = ballPos;
    if (ballPos === 3) attackPosition = 6; 

    // Где должен быть блок
    let correctBlockPos = 3;
    if (ballPos === 4) correctBlockPos = 2;
    if (ballPos === 2) correctBlockPos = 4;
    if (ballPos === 3) correctBlockPos = 3; 
    
    const defenderId = playerId;
    const isTeam1Defending = room.players[0] === defenderId;
    const defendingTeam = isTeam1Defending ? room.team1 : room.team2;
    const attackingTeam = isTeam1Defending ? room.team2 : room.team1;

    // Участники
    const spiker = attackingTeam.find(p => p.position === attackPosition) 
                    || attackingTeam.find(p => p.position === 4) 
                    || attackingTeam.find(p => p.position === 2) 
                    || attackingTeam[0];
    
    const isGuessCorrect = blockPos === correctBlockPos;
    const blockerPosToFind = isGuessCorrect ? correctBlockPos : 3;
    const blocker = defendingTeam.find(p => p.position === blockerPosToFind) || defendingTeam.find(p => p.position === 3);

    let targetDefPos = 6; 
    if (ballPos === 4) targetDefPos = 1; 
    if (ballPos === 2) targetDefPos = 5; 
    if (ballPos === 3) targetDefPos = 6; 
    const floorDefender = defendingTeam.find(p => p.position === targetDefPos) || defendingTeam.find(p => p.position === 6);

    // Статы и квирки
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
    
    // --- ПРАВИЛЬНАЯ ЛОГИКА НИНДЗЯ ---
    let ninjaMsg = "";
    if (spiker.id === 'hinata_ts' && isGuessCorrect) {
        const ninjaRoll = Math.random();
        if (ninjaRoll > 0.5) { // 50% шанс
            blockPower = 0; // Блок аннигилирован
            ninjaMsg = ` 💨 НИНДЗЯ! Хината отыграл от рук в аут!`;
        }
    }
    // -----------------------------------------------------

    // Результат раунда
    let winner = null;
    let details = '';
    let nextPhase = 'SERVE';
    let nextTurn = null;

    // Траектория для анимации
    let trajectoryType = 'NORMAL'; 
    let startActorId = spiker.id;
    let endActorId = floorDefender.id;

    await delay(1200);

    let isKillBlock = isGuessCorrect && blockPower > attackPower;
    if (isKillBlock && spiker.id === 'hyakuzawa') {
        isKillBlock = false;
        message += ` (Хякузава пробил блок!) `;
        attackPower = Math.floor(attackPower * 0.7); 
    }

    if (isKillBlock) {
        // MONSTER BLOCK
        winner = 'DEFENSE';
        message += `🧱 MONSTER BLOCK! ${blocker.name} заблокировал!`;
        details = `Блок ${blockPower} > Атака ${attackPower}`;
        
        trajectoryType = 'BOUNCE'; 
        startActorId = blocker.id;
        endActorId = spiker.id; 
    } else {
        let remainingForce = attackPower;
        let preMsg = '';
        if (ninjaMsg) message += ninjaMsg; // Добавляем сообщение ниндзя
        
        if (isGuessCorrect && blockPower > 0) { // Проверяем, что блок не обнулен ниндзей
            // SOFT BLOCK
            remainingForce = Math.floor(attackPower - (blockPower * 0.5));
            if (remainingForce < 5) remainingForce = 5; 
            preMsg = `🛡️ Смягчение блоком!`;
            
            trajectoryType = 'SOFT'; 
            startActorId = blocker.id;
            endActorId = floorDefender.id;
        } else {
            // NORMAL ATTACK (Чистая сетка или Ниндзя обнулил блок)
            remainingForce = attackPower;
            preMsg = `💥 ЧИСТАЯ СЕТКА!`;
            
            trajectoryType = 'NORMAL'; 
            startActorId = spiker.id;
            endActorId = floorDefender.id;
        }

        if (digPower >= remainingForce) {
            // Мяч поднят
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
            // Гол
            winner = 'ATTACK';
            message += `🏐 ГОЛ! ${spiker.name} пробил защиту!`;
            details = `Удар ${remainingForce} > Прием ${digPower}`;
        }
    }

    let rotMessage = '';
    // Обновление счета и ротация
    if (winner) {
        nextPhase = 'SERVE';
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

    const s1 = room.gameState.score.team1;
    const s2 = room.gameState.score.team2;
    
    // --- ОПРЕДЕЛЕНИЕ ЭФФЕКТОВ (FIX) ---
    let isCritical = false;
    let isLegendary = false; // Объявляем переменную здесь!

    if (winner === 'DEFENSE' && isKillBlock) isCritical = true;
    if (winner === 'ATTACK') {
         let rf = (isGuessCorrect && blockPower > 0) ? Math.floor(attackPower - (blockPower * 0.5)) : attackPower;
         if (rf - digPower > 10) isCritical = true;
         
         // Проверяем на легендарность
         if (spiker.id === 'hinata_ts' || (ninjaMsg && ninjaMsg.length > 0)) {
             isLegendary = true;
             isCritical = true;
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

// ========== СОКЕТЫ ========== 

io.on('connection', (socket) => {
    console.log(`[+] Игрок подключился: ${socket.id}`);

    // AI MODE
    socket.on('create_ai_game', () => {
        const roomId = 'AI-' + Math.random().toString(36).substring(2, 7).toUpperCase();
        games[roomId] = {
            players: [socket.id, 'AI'],
            team1: [],
            team2: [],
            state: 'draft',
            bannedCharacters: [],
            isAI: true,
            aiTeamReady: false
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
        if (!room) return;
        
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
        if (!room) return;

        if (socket.id === room.players[0]) room.team1 = team;
        else room.team2 = team;

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
        else if (!room.isAI && room.team1.length === 6 && room.team2.length === 6) {
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
        if (!room || room.gameState.turn !== socket.id) return;
        handleServe(roomId, room, socket.id, io);
    });

    socket.on('action_set', ({ roomId, targetPos }) => {
        const room = games[roomId];
        if (!room) return;
        handleSet(roomId, room, socket.id, targetPos, io, socket);
    });

    socket.on('action_block', ({ roomId, blockPos }) => {
        const room = games[roomId];
        if (!room) return;
        handleBlock(roomId, room, socket.id, blockPos, io);
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