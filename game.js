// server/game.js - ИНТЕГРАЦИЯ ИИ СТРАТЕГИЙ

const { AIFactory } = require('./ai/AIStrategies');

// ==================== 1. ДОБАВИТЬ В СТРУКТУРУ ИГРЫ ====================

class Game {
    constructor(roomId, player1, player2, isAI = false, aiType = 'CHAOS') {
        this.roomId = roomId;
        this.players = [player1, player2];
        this.isAI = isAI;
        this.aiType = aiType;
        
        // ... остальные поля ...
        
        // НОВОЕ: Инстанс ИИ
        this.aiInstance = null;
    }

    // ==================== 2. ИНИЦИАЛИЗАЦИЯ ИИ ПРИ СТАРТЕ МАТЧА ====================
    
    startMatch() {
        // ... существующий код ...
        
        // Создаем инстанс ИИ если это AI игра
        if (this.isAI) {
            const aiPlayerIndex = this.players[0] === 'AI' ? 0 : 1;
            const humanPlayerIndex = aiPlayerIndex === 0 ? 1 : 0;
            
            const aiTeam = aiPlayerIndex === 0 ? this.team1 : this.team2;
            const humanTeam = aiPlayerIndex === 0 ? this.team2 : this.team1;
            
            this.aiInstance = AIFactory.createAI(this.aiType, aiTeam, humanTeam);
            
            console.log(`🤖 ИИ инициализирован: ${this.aiType}`);
        }
        
        // ... остальной код ...
    }

    // ==================== 3. ОБРАБОТКА ПОДАЧИ (action_serve) ====================
    
    handleServe(playerId) {
        // ... существующая логика подачи ...
        
        // НОВОЕ: Проверка на Wild Card (CHAOS AI)
        if (this.isAI && this.aiType === 'CHAOS' && this.turn === this.getAIPlayerId()) {
            if (this.aiInstance.hasCriticalServe()) {
                console.log('🎲 WILD CARD: Критическая подача!');
                // Игнорируем receive < 70
                if (receiverPlayer.stats.receive < 70) {
                    isAce = true;
                    result = `🎲 WILD CARD! Критическая подача пробила защиту ${receiverPlayer.name}!`;
                }
            }
        }
        
        // ... остальная логика ...
    }

    // ==================== 4. ИИ ВЫБОР ПЕРЕДАЧИ (action_set) ====================
    
    handleAISet() {
        if (!this.aiInstance) return;

        let targetPos = this.aiInstance.chooseSetPosition();
        
        // PHANTOM: Проверка на Feint Shot
        if (this.aiType === 'PHANTOM' && this.aiInstance.shouldUseFeint()) {
            console.log('👻 FEINT SHOT активирован!');
            return this.handleFeintShot(targetPos);
        }
        
        // Обычная передача
        const setter = this.getSetterPlayer();
        const targetPlayer = this.getPlayerByPosition(targetPos, /* aiTeam */ true);
        
        io.to(this.roomId).emit('set_made', {
            setterId: setter.id,
            targetPos: targetPos,
            nextTurn: this.getHumanPlayerId(), // Ход игроку
            phase: 'BLOCK',
            message: `${setter.name} делает передачу на позицию ${targetPos}`
        });
        
        this.phase = 'BLOCK';
        this.ballTargetPos = targetPos;
        this.turn = this.getHumanPlayerId();
    }

    // ==================== 5. УНИКАЛЬНАЯ МЕХАНИКА: FEINT SHOT (PHANTOM) ====================
    
    handleFeintShot(targetPos) {
        const setter = this.getSetterPlayer();
        const humanTeam = this.isPlayer1AI ? this.team2 : this.team1;
        
        // Случайная позиция на передней линии [2, 3, 4]
        const feintTarget = [2, 3, 4][Math.floor(Math.random() * 3)];
        const defenderPlayer = humanTeam.find(p => p.position === feintTarget);
        
        if (!defenderPlayer) {
            return this.handleNormalSpike(targetPos);
        }
        
        // Бросок receive
        const defenseRoll = Math.random() * 100;
        const defenseChance = defenderPlayer.stats.receive;
        
        if (defenseRoll < defenseChance) {
            // ЗАЩИТИЛИ
            this.updateScore(false); // AI не забил
            io.to(this.roomId).emit('spike_result', {
                message: `👻 СБРОС! Но ${defenderPlayer.name} успел принять!`,
                details: `Feint Shot защищен (receive: ${defenseChance})`,
                winSide: 'DEFENSE',
                score: this.score,
                nextTurn: this.getHumanPlayerId(),
                phase: 'SERVE',
                team1: this.team1,
                team2: this.team2
            });
        } else {
            // ГОЛ
            this.updateScore(true); // AI забил
            io.to(this.roomId).emit('spike_result', {
                message: `👻 FEINT SHOT! Сброс на переднюю линию - ГОЛ!`,
                details: `${defenderPlayer.name} не успел (receive: ${defenseChance})`,
                winSide: 'ATTACK',
                score: this.score,
                nextTurn: this.getAIPlayerId(),
                phase: 'SERVE',
                team1: this.team1,
                team2: this.team2,
                isCritical: true
            });
        }
        
        this.phase = 'SERVE';
        this.ballTargetPos = null;
    }

    // ==================== 6. ИИ ВЫБОР БЛОКА ====================
    
    handleAIBlock() {
        if (!this.aiInstance) return;

        const blockPos = this.aiInstance.chooseBlockPosition();
        
        console.log(`🤖 ИИ блокирует позицию: ${blockPos}`);
        
        return this.processBlock(blockPos);
    }

    // ==================== 7. ОБРАБОТКА АТАКИ С УЧЕТОМ УНИКАЛЬНЫХ МЕХАНИК ====================
    
    processSpike(attackerPlayer, blockPos) {
        // ... существующая логика ...
        
        // TACTICAL: Synchronized Block
        if (this.isAI && this.aiType === 'TACTICAL' && blockPos) {
            if (this.aiInstance.hasSynchronizedBlock(blockPos)) {
                const bonus = this.aiInstance.getSynchronizedBlockBonus();
                blockerPlayer.stats.block += bonus;
                console.log(`♟️ SYNCHRONIZED BLOCK! +${bonus}% к блоку`);
                blockMessage = `♟️ СИНХРОННЫЙ БЛОК! ${blockerPlayer.name} (+${bonus}%)`;
            }
        }
        
        // APEX: Hunt Mode Bonus
        if (this.isAI && this.aiType === 'APEX') {
            if (this.aiInstance.isTargetingPlayer(attackerPlayer.id)) {
                const bonus = this.aiInstance.getHuntBonus();
                attackerPlayer.stats.power += bonus; // Временно
                console.log(`🦅 HUNT MODE! +${bonus}% к атаке против ${attackerPlayer.name}`);
            }
        }
        
        // DATA: Analysis Bonus
        if (this.isAI && this.aiType === 'DATA') {
            const bonusInfo = this.aiInstance.updateAnalysisBonus();
            if (bonusInfo.updated) {
                const aiTeam = this.isPlayer1AI ? this.team1 : this.team2;
                aiTeam.forEach(player => {
                    player.stats.receive += bonusInfo.bonus;
                });
                io.to(this.roomId).emit('game_log', {
                    message: `🧠 SYSTEM CALIBRATED +${bonusInfo.bonus}%`
                });
            }
        }
        
        // ... остальная логика spike ...
    }

    // ==================== 8. ЗАПИСЬ ДЕЙСТВИЙ ИГРОКА ====================
    
    handlePlayerSet(playerId, targetPos) {
        // ... существующая логика ...
        
        // Записываем действие игрока для анализа ИИ
        if (this.aiInstance) {
            if (this.aiType === 'PHANTOM') {
                this.aiInstance.recordPlayerSet(targetPos);
            }
            if (this.aiType === 'DATA') {
                this.aiInstance.recordPlayerSet(targetPos);
            }
        }
        
        // ... остальной код ...
    }

    // ==================== 9. ОБНОВЛЕНИЕ СЧЕТА ====================
    
    updateScore(aiScored) {
        if (aiScored) {
            if (this.isPlayer1AI) this.score.team1++;
            else this.score.team2++;
        } else {
            if (this.isPlayer1AI) this.score.team2++;
            else this.score.team1++;
        }
        
        // Обновляем счет в ИИ
        if (this.aiInstance) {
            const aiScore = this.isPlayer1AI ? this.score.team1 : this.score.team2;
            const humanScore = this.isPlayer1AI ? this.score.team2 : this.score.team1;
            this.aiInstance.updateScore(aiScore, humanScore);
        }
        
        // DATA: Сброс бонуса при проигрыше 3+ подряд
        if (this.aiType === 'DATA' && !aiScored) {
            // Проверяем серию
            if (this.checkLosingStreak(3)) {
                this.aiInstance.resetAnalysisBonus();
                console.log('🧠 DATA: Сброс бонуса (проигрыш серии)');
            }
        }
        
        // TACTICAL: Записываем пропущенный мяч
        if (this.aiType === 'TACTICAL' && !aiScored && this.ballTargetPos) {
            this.aiInstance.recordEnemyMiss(this.ballTargetPos);
        }
    }

    // ==================== 10. ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ====================
    
    getAIPlayerId() {
        return this.players.find(p => p === 'AI');
    }
    
    getHumanPlayerId() {
        return this.players.find(p => p !== 'AI');
    }
    
    checkLosingStreak(length) {
        // Проверяем последние N очков
        // Упрощенная логика - можно расширить
        return false; // TODO: реализовать
    }
}

// ==================== 11. СОЗДАНИЕ AI ИГРЫ (В io.on('create_ai_game')) ====================

socket.on('create_ai_game', ({ aiType = 'CHAOS' }) => {
    const roomId = `AI-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const game = new Game(roomId, socket.id, 'AI', true, aiType);
    
    games.set(roomId, game);
    socket.join(roomId);
    
    socket.emit('game_created', roomId);
    
    // Сразу стартуем драфт
    setTimeout(() => {
        game.startDraft();
    }, 500);
});

// ==================== 12. ПРИМЕР ПОЛНОГО ЦИКЛА АТАКИ ====================

/*
ПРИМЕР ХОДА ИИ:

1. Игрок делает подачу
2. ИИ принимает
3. ИИ делает передачу (handleAISet):
   - PHANTOM: может сделать Feint Shot
   - TACTICAL: выбирает зону по фазе
   - DATA: анализирует частоту
   - APEX: бьет в слабого
   
4. Игрок ставит блок
5. Обработка атаки (processSpike):
   - TACTICAL: +15% если синхронный блок
   - APEX: +20% power если Hunt Mode
   - DATA: применяет бонус к receive
   
6. Результат:
   - Обновление счета
   - Запись действий для анализа
   - Переход к следующему ходу
*/

module.exports = Game;