// server/ai/AIStrategies.js

class BaseAI {
    constructor(team, enemyTeam) {
        this.team = team;
        this.enemyTeam = enemyTeam;
        this.actionHistory = [];
        this.score = { us: 0, them: 0 };
    }

    updateScore(ourScore, theirScore) {
        this.score = { us: ourScore, them: theirScore };
    }

    recordAction(action) {
        this.actionHistory.push({
            ...action,
            timestamp: Date.now()
        });
        // Храним только последние 20 действий
        if (this.actionHistory.length > 20) {
            this.actionHistory.shift();
        }
    }

    findWeakestDefender() {
        return this.enemyTeam.reduce((weakest, player) => 
            player.stats.receive < weakest.stats.receive ? player : weakest
        );
    }

    findStrongestBlocker() {
        return this.team.reduce((strongest, player) => 
            player.stats.block > strongest.stats.block ? player : strongest
        );
    }
}

// ==================== 1. PHANTOM STRIKERS (Kitsune Academy) ====================
class PhantomAI extends BaseAI {
    constructor(team, enemyTeam) {
        super(team, enemyTeam);
        this.playerSetHistory = []; // История передач игрока
        this.consecutivePoints = 0;
        this.lastTactic = null;
    }

    // 🎯 Выбор позиции для передачи
    chooseSetPosition() {
        const playerPatterns = this.analyzePlayerSetPattern();
        
        // Если игрок создал паттерн (3+ раза одна зона) → ломаем его
        if (playerPatterns.dominant && playerPatterns.dominantCount >= 3) {
            console.log(`🦊 PHANTOM: Ломаем паттерн игрока (${playerPatterns.dominant})`);
            const otherPositions = [2, 3, 4].filter(p => p !== playerPatterns.dominant);
            return otherPositions[Math.floor(Math.random() * otherPositions.length)];
        }

        // Блеф: 40% не бить самым сильным
        if (Math.random() < 0.4) {
            const positions = [2, 3, 4];
            const strongestPos = this.findStrongestAttacker().position;
            const bluffPositions = positions.filter(p => p !== strongestPos);
            console.log(`🦊 PHANTOM: Блеф - избегаем сильнейшего (pos ${strongestPos})`);
            return bluffPositions[Math.floor(Math.random() * bluffPositions.length)];
        }

        // Обычная атака сильнейшим
        return this.findStrongestAttacker().position;
    }

    // 🎲 УНИКАЛЬНАЯ МЕХАНИКА: Feint Shot (Сброс)
    shouldUseFeint() {
        return Math.random() < 0.3; // 30% шанс
    }

    // 🛡️ Выбор позиции блока (инвертированная логика)
    chooseBlockPosition() {
        const recentSets = this.playerSetHistory.slice(-3);
        
        if (recentSets.length >= 2) {
            // Подсчитываем частоту последних передач
            const frequency = {};
            recentSets.forEach(pos => {
                frequency[pos] = (frequency[pos] || 0) + 1;
            });

            const mostCommon = Object.keys(frequency).reduce((a, b) => 
                frequency[a] > frequency[b] ? a : b
            );

            // ИНВЕРСИЯ: блокируем ПРОТИВОПОЛОЖНУЮ зону
            if (frequency[mostCommon] >= 2) {
                const opposite = this.getOppositePosition(parseInt(mostCommon));
                console.log(`🦊 PHANTOM: Инверсия - игрок бил ${mostCommon}, блокируем ${opposite}`);
                return opposite;
            }
        }

        // По умолчанию: случайный блок
        return [2, 3, 4][Math.floor(Math.random() * 3)];
    }

    getOppositePosition(pos) {
        if (pos === 2) return 4;
        if (pos === 4) return 2;
        return [2, 4][Math.floor(Math.random() * 2)]; // Из центра - в края
    }

    analyzePlayerSetPattern() {
        const recent = this.playerSetHistory.slice(-5);
        if (recent.length < 3) return { dominant: null, dominantCount: 0 };

        const freq = {};
        recent.forEach(pos => {
            freq[pos] = (freq[pos] || 0) + 1;
        });

        const dominant = Object.keys(freq).reduce((a, b) => 
            freq[a] > freq[b] ? a : b
        );

        return { 
            dominant: parseInt(dominant), 
            dominantCount: freq[dominant] 
        };
    }

    findStrongestAttacker() {
        const frontLine = this.team.filter(p => [2, 3, 4].includes(p.position));
        return frontLine.reduce((strongest, player) => 
            player.stats.power > strongest.stats.power ? player : strongest
        );
    }

    recordPlayerSet(position) {
        this.playerSetHistory.push(position);
        if (this.playerSetHistory.length > 10) {
            this.playerSetHistory.shift();
        }
    }
}

// ==================== 2. TACTICAL TITANS (Shogi Masters) ====================
class TacticalAI extends BaseAI {
    constructor(team, enemyTeam) {
        super(team, enemyTeam);
        this.weaknessMap = { 2: 0, 3: 0, 4: 0 }; // Карта слабостей противника
        this.currentPhase = 1;
    }

    // 🎯 Зональная тактика по фазам
    chooseSetPosition() {
        const totalPoints = this.score.us + this.score.them;
        
        // Определяем фазу
        if (totalPoints < 5) this.currentPhase = 1;
        else if (totalPoints < 10) this.currentPhase = 2;
        else if (totalPoints < 15) this.currentPhase = 3;
        else this.currentPhase = 4;

        let targetPos;

        switch(this.currentPhase) {
            case 1: // Фаза 1: левый край
                targetPos = 4;
                console.log(`♟️ TACTICAL: Фаза 1 - атака слева (pos 4)`);
                break;
            case 2: // Фаза 2: центр
                targetPos = 3;
                console.log(`♟️ TACTICAL: Фаза 2 - атака центром (pos 3)`);
                break;
            case 3: // Фаза 3: правый край
                targetPos = 2;
                console.log(`♟️ TACTICAL: Фаза 3 - атака справа (pos 2)`);
                break;
            case 4: // Фаза 4: эксплуатация слабостей
                targetPos = this.findWeakestZone();
                console.log(`♟️ TACTICAL: Фаза 4 - атака слабой зоны (pos ${targetPos})`);
                break;
            default:
                targetPos = 4;
        }

        return targetPos;
    }

    // 🛡️ УНИКАЛЬНАЯ МЕХАНИКА: Synchronized Block
    chooseBlockPosition() {
        // Находим зону с самым слабым нападающим
        const frontLine = this.enemyTeam.filter(p => [2, 3, 4].includes(p.position));
        const weakest = frontLine.reduce((w, p) => 
            p.stats.power < w.stats.power ? p : w
        );

        console.log(`♟️ TACTICAL: Синхронный блок на pos ${weakest.position}`);
        return weakest.position;
    }

    // 🔧 Проверка синхронного блока (используется в game.js)
    hasSynchronizedBlock(blockPos) {
        const adjacentPositions = {
            2: [3],
            3: [2, 4],
            4: [3]
        };

        const neighbors = adjacentPositions[blockPos] || [];
        const blockersCount = this.team.filter(p => 
            neighbors.includes(p.position)
        ).length;

        return blockersCount >= 1; // Хотя бы один сосед
    }

    getSynchronizedBlockBonus() {
        return 15; // +15% к блоку
    }

    findWeakestZone() {
        // Находим зону где больше всего пропущено мячей
        const maxMisses = Math.max(...Object.values(this.weaknessMap));
        if (maxMisses === 0) return 4; // Если нет данных - бьем влево

        for (let pos in this.weaknessMap) {
            if (this.weaknessMap[pos] === maxMisses) {
                return parseInt(pos);
            }
        }
        return 4;
    }

    recordEnemyMiss(position) {
        this.weaknessMap[position]++;
    }
}

// ==================== 3. DATA HUNTERS (Neural Storm) ====================
class DataAI extends BaseAI {
    constructor(team, enemyTeam) {
        super(team, enemyTeam);
        this.playerSetFrequency = { 2: 0, 3: 0, 4: 0 };
        this.totalPlayerSets = 0;
        this.analysisPhase = 'EXPLORATION'; // EXPLORATION -> ANALYSIS -> EXPLOITATION
        this.receiveBonus = 0; // Бонус к receive (0, 10, 20, 30)
        this.lastBonusUpdate = 0;
    }

    // 🎯 Адаптивная стратегия передач
    chooseSetPosition() {
        const totalPoints = this.score.us + this.score.them;

        // Определяем фазу
        if (totalPoints < 5) {
            this.analysisPhase = 'EXPLORATION';
        } else if (totalPoints < 10) {
            this.analysisPhase = 'ANALYSIS';
        } else {
            this.analysisPhase = 'EXPLOITATION';
        }

        switch(this.analysisPhase) {
            case 'EXPLORATION':
                // Рандом для сбора данных
                const pos = [2, 3, 4][Math.floor(Math.random() * 3)];
                console.log(`🧠 DATA: Разведка - случайная атака (pos ${pos})`);
                return pos;

            case 'ANALYSIS':
                // Вычисляем паттерн
                this.analyzePlayerPatterns();
                const randomPos = [2, 3, 4][Math.floor(Math.random() * 3)];
                console.log(`🧠 DATA: Анализ - сбор данных (pos ${randomPos})`);
                return randomPos;

            case 'EXPLOITATION':
                // Атакуем непопулярную зону
                const leastPopular = this.findLeastPopularZone();
                console.log(`🧠 DATA: Эксплуатация - избегаем любимой зоны игрока (pos ${leastPopular})`);
                return leastPopular;

            default:
                return 4;
        }
    }

    // 🛡️ Вероятностный блок
    chooseBlockPosition() {
        if (this.totalPlayerSets < 3) {
            // Нет данных - стандартный блок
            return 4;
        }

        // Блокируем самую популярную зону игрока
        const mostPopular = this.findMostPopularZone();
        console.log(`🧠 DATA: Вероятностный блок - популярная зона ${mostPopular}`);
        return mostPopular;
    }

    // 🌟 УНИКАЛЬНАЯ МЕХАНИКА: Analysis Mode
    updateAnalysisBonus() {
        const pointsScored = this.score.us;
        const newBonus = Math.min(30, Math.floor(pointsScored / 5) * 10);
        
        if (newBonus > this.receiveBonus) {
            this.receiveBonus = newBonus;
            return { updated: true, bonus: newBonus };
        }
        return { updated: false, bonus: this.receiveBonus };
    }

    resetAnalysisBonus() {
        this.receiveBonus = 0;
    }

    getReceiveBonus() {
        return this.receiveBonus;
    }

    recordPlayerSet(position) {
        this.playerSetFrequency[position]++;
        this.totalPlayerSets++;
    }

    analyzePlayerPatterns() {
        if (this.totalPlayerSets === 0) return;

        console.log(`🧠 DATA: Паттерн игрока - pos2: ${this.playerSetFrequency[2]}, pos3: ${this.playerSetFrequency[3]}, pos4: ${this.playerSetFrequency[4]}`);
    }

    findMostPopularZone() {
        return Object.keys(this.playerSetFrequency).reduce((a, b) => 
            this.playerSetFrequency[a] > this.playerSetFrequency[b] ? a : b
        );
    }

    findLeastPopularZone() {
        // Если все зоны одинаковы - рандом
        const values = Object.values(this.playerSetFrequency);
        if (values.every(v => v === values[0])) {
            return [2, 3, 4][Math.floor(Math.random() * 3)];
        }

        return parseInt(Object.keys(this.playerSetFrequency).reduce((a, b) => 
            this.playerSetFrequency[a] < this.playerSetFrequency[b] ? a : b
        ));
    }
}

// ==================== 4. APEX PREDATORS (Ryujin Killers) ====================
class ApexAI extends BaseAI {
    constructor(team, enemyTeam) {
        super(team, enemyTeam);
        this.targetPlayer = null;
        this.targetHits = 0;
        this.huntMode = false;
    }

    // 🎯 Hunt Mode - таргетинг слабейшего
    chooseSetPosition() {
        // Находим слабейшего защитника
        const weakest = this.findWeakestDefender();
        
        // Если это новая цель
        if (!this.targetPlayer || this.targetPlayer.id !== weakest.id) {
            this.targetPlayer = weakest;
            this.targetHits = 0;
            this.huntMode = true;
            console.log(`🦅 APEX: HUNT MODE - целимся в ${weakest.name} (receive: ${weakest.stats.receive})`);
        }

        // Геометрия: выбираем позицию нападающего напротив слабого защитника
        const attackPos = this.getAttackPositionAgainst(weakest.position);
        this.targetHits++;

        // Если 2 раза подряд защитил - меняем цель
        if (this.targetHits >= 3) {
            console.log(`🦅 APEX: Цель выдержала 3 атаки, ищем новую`);
            this.targetPlayer = null;
        }

        return attackPos;
    }

    // 🛡️ Умный блок - ставим сильнейшего блокера
    chooseBlockPosition() {
        const strongestBlocker = this.findStrongestBlocker();
        
        // Противоположная геометрия от нашего блокера
        const blockPos = strongestBlocker.position;
        console.log(`🦅 APEX: Блок сильнейшим (${strongestBlocker.name}, block: ${strongestBlocker.stats.block}) на pos ${blockPos}`);
        
        return blockPos;
    }

    // 🌟 УНИКАЛЬНАЯ МЕХАНИКА: Hunt Mode Bonus
    getHuntBonus() {
        return this.huntMode ? 20 : 0; // +20% к power против цели
    }

    isTargetingPlayer(playerId) {
        return this.targetPlayer && this.targetPlayer.id === playerId;
    }

    resetTarget() {
        this.targetPlayer = null;
        this.targetHits = 0;
        this.huntMode = false;
    }

    getAttackPositionAgainst(defenderPos) {
        // Умная геометрия
        const mapping = {
            5: 4, // Защитник слева сзади -> нападающий слева
            6: 3, // Защитник центр сзади -> нападающий центр
            1: 2, // Защитник справа сзади -> нападающий справа
            4: 4, // Защитник слева -> атака слева
            3: 3, // Защитник центр -> атака центром
            2: 2  // Защитник справа -> атака справа
        };
        return mapping[defenderPos] || 4;
    }
}

// ==================== 5. CHAOS CROWS (Karasu Ranbu) ====================
class ChaosAI extends BaseAI {
    chooseSetPosition() {
        return [2, 3, 4][Math.floor(Math.random() * 3)];
    }

    chooseBlockPosition() {
        return [2, 3, 4][Math.floor(Math.random() * 3)];
    }

    // 🌟 УНИКАЛЬНАЯ МЕХАНИКА: Wild Card
    hasCriticalServe() {
        return Math.random() < 0.15; // 15% шанс
    }
}

// ==================== FACTORY ====================
class AIFactory {
    static createAI(type, team, enemyTeam) {
        switch(type) {
            case 'PHANTOM':
                return new PhantomAI(team, enemyTeam);
            case 'TACTICAL':
                return new TacticalAI(team, enemyTeam);
            case 'DATA':
                return new DataAI(team, enemyTeam);
            case 'APEX':
                return new ApexAI(team, enemyTeam);
            case 'CHAOS':
            default:
                return new ChaosAI(team, enemyTeam);
        }
    }

    static getAIInfo() {
        return {
            PHANTOM: {
                name: 'Kitsune Academy',
                subtitle: '👻 Обманщики',
                description: 'Мастера блефа и психологических атак',
                difficulty: '⭐⭐⭐',
                special: 'Feint Shot - сброс на переднюю линию'
            },
            TACTICAL: {
                name: 'Shogi Masters',
                subtitle: '♟️ Тактики',
                description: 'Позиционная игра и зональные атаки',
                difficulty: '⭐⭐⭐⭐',
                special: 'Synchronized Block - двойной блок +15%'
            },
            DATA: {
                name: 'Neural Storm',
                subtitle: '🧠 Адаптивные',
                description: 'Анализируют вашу игру и адаптируются',
                difficulty: '⭐⭐⭐⭐',
                special: 'Analysis Mode - +30% receive со временем'
            },
            APEX: {
                name: 'Ryujin Killers',
                subtitle: '🦅 Хищники',
                description: 'Находят слабое звено и атакуют его',
                difficulty: '⭐⭐⭐⭐⭐',
                special: 'Hunt Mode - +20% power против цели'
            },
            CHAOS: {
                name: 'Karasu Ranbu',
                subtitle: '🎲 Хаос',
                description: 'Непредсказуемая и дикая игра',
                difficulty: '⭐⭐',
                special: 'Wild Card - 15% критическая подача'
            }
        };
    }
}

module.exports = {
    AIFactory,
    PhantomAI,
    TacticalAI,
    DataAI,
    ApexAI,
    ChaosAI
};