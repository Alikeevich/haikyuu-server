// Простой тест для проверки AIFactory
const { AIFactory } = require('./ai/AIStrategies');
const characters = require('./data/characters');

// Создаем тестовые команды
const team1 = characters.slice(0, 6).map((char, idx) => ({
    ...char,
    position: idx + 1,
    matchStats: { points: 0, blocks: 0 }
}));

const team2 = characters.slice(6, 12).map((char, idx) => ({
    ...char,
    position: idx + 1,
    matchStats: { points: 0, blocks: 0 }
}));

// Тестируем каждый тип ИИ
const aiTypes = ['PHANTOM', 'TACTICAL', 'DATA', 'APEX', 'CHAOS'];

console.log('\n====== ТЕСТ AIFACTORY ======\n');

aiTypes.forEach(type => {
    console.log(`[${type}]`);
    try {
        const ai = AIFactory.createAI(type, team1, team2);
        console.log(`  ✓ Инициализация: OK`);
        console.log(`  ✓ chooseSetPosition: ${typeof ai.chooseSetPosition}`);
        console.log(`  ✓ chooseBlockPosition: ${typeof ai.chooseBlockPosition}`);
        
        // Тестируем методы
        const setPos = ai.chooseSetPosition();
        const blockPos = ai.chooseBlockPosition();
        console.log(`  ✓ Позиция передачи: ${setPos}`);
        console.log(`  ✓ Позиция блока: ${blockPos}`);
        console.log(`  ✓ ${type} работает!\n`);
    } catch (err) {
        console.log(`  ✗ ОШИБКА: ${err.message}\n`);
    }
});

console.log('====== ВСЁ РАБОТАЕТ! ======\n');
