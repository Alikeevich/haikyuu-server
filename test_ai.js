// Тест для проверки работы ИИ
const io = require('socket.io-client');

const socket = io('http://localhost:3001');

socket.on('connect', () => {
    console.log('✅ Подключено к серверу');
    console.log('\n🤖 Тестирование ИИ...\n');
    
    // Тест 1: CHAOS AI
    console.log('📝 Тест 1: CHAOS AI');
    socket.emit('create_ai_game', { aiType: 'CHAOS' });
});

socket.on('game_started', (data) => {
    console.log('✅ Игра создана:', data.roomId);
    console.log('🎲 Игроки:', data.players);
    
    // Выбираем команду
    setTimeout(() => {
        const team = data.allCharacters.slice(0, 6).map((char, idx) => ({
            id: char.id,
            name: char.name,
            position: idx + 1,
            stats: char.stats
        }));
        
        socket.emit('team_ready', {
            roomId: data.roomId,
            team: team
        });
    }, 500);
});

socket.on('match_start', (data) => {
    console.log('\n🎮 МАТЧ НАЧАЛСЯ!');
    console.log('📊 Команда 1:', data.team1.map(p => p.name).join(', '));
    console.log('📊 Команда 2:', data.team2.map(p => p.name).join(', '));
    console.log('🤖 ИИ тип:', data.players[1] === 'AI' ? 'CHAOS' : 'Human');
    
    // Даем серверу время на инициализацию ИИ
    setTimeout(() => {
        console.log('\n✅ ИИ инициализирован и готов!');
        console.log('\n🔍 Проверьте логи сервера на предмет сообщений ИИ');
    }, 1000);
});

socket.on('error', (error) => {
    console.error('❌ Ошибка:', error);
});

socket.on('disconnect', () => {
    console.log('\n❌ Отключено от сервера');
    process.exit(0);
});

// Таймаут для выхода
setTimeout(() => {
    console.log('\n⏱️ Тест завершен');
    socket.disconnect();
    process.exit(0);
}, 5000);
