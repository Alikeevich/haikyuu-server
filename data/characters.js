const characters = [
    // --- KARASUNO ---
    { 
        id: 'hinata', name: 'Хината Шоё', team: 'Karasuno', 
        stats: { power: 12, receive: 7, set: 5, block: 9, speed: 20 }, 
        img: '/assets/hinata.png',
        quirk: { name: "Вжух!", desc: "+5 к Атаке за счет скорости." } 
    },
    { 
        id: 'kageyama', name: 'Кагеяма Тобио', team: 'Karasuno', 
        stats: { power: 15, receive: 14, set: 20, block: 14, speed: 16 }, 
        img: '/assets/kageyama.png',
        quirk: { name: "Король Площадки", desc: "+3 к Подаче и Блоку." } 
    },
    { 
        id: 'nishinoya', name: 'Нишиноя Ю', team: 'Karasuno', 
        stats: { power: 6, receive: 20, set: 9, block: 3, speed: 19 }, 
        img: '/assets/nishinoya.png',
        quirk: { name: "Rolling Thunder", desc: "+5 к Приему (Dig)." }
    },
    { 
        id: 'tsukishima', name: 'Цукишима Кей', team: 'Karasuno', 
        stats: { power: 11, receive: 12, set: 11, block: 17, speed: 10 }, 
        img: '/assets/tsukishima.png',
        quirk: { name: "Чтение Блока", desc: "+4 к Блоку." }
    },
    { 
        id: 'daichi', name: 'Савамура Дайчи', team: 'Karasuno', 
        stats: { power: 13, receive: 19, set: 8, block: 10, speed: 11 }, 
        img: '/assets/daichi.png', 
        quirk: { name: "Капитан", desc: "+2 к Приему." } 
    },
    { 
        id: 'asahi', name: 'Адзумане Асахи', team: 'Karasuno', 
        stats: { power: 19, receive: 11, set: 4, block: 12, speed: 9 }, 
        img: '/assets/asahi.png', 
        quirk: { name: "Ас", desc: "+3 к Атаке." } 
    },
    { 
        id: 'tanaka', name: 'Танака Рюноске', team: 'Karasuno', 
        stats: { power: 16, receive: 10, set: 5, block: 8, speed: 14 }, 
        img: '/assets/tanaka.png', 
        quirk: null 
    },

    // --- AOBA JOHSAI ---
    { 
        id: 'oikawa', name: 'Ойкава Тоору', team: 'Seijoh', 
        stats: { power: 17, receive: 13, set: 19, block: 11, speed: 13 }, 
        img: '/assets/oikawa.png',
        quirk: { name: "Убийственная Подача", desc: "+5 к Подаче." }
    },
    { 
        id: 'iwai', name: 'Иваизуми Хаджиме', team: 'Seijoh', 
        stats: { power: 18, receive: 14, set: 7, block: 10, speed: 14 }, 
        img: '/assets/iwai.png', 
        quirk: { name: "Ас Сейджо", desc: "+2 к Атаке." } 
    },

    // --- NEKOMA ---
    { 
        id: 'kuroo', name: 'Куроо Тецуро', team: 'Nekoma', 
        stats: { power: 14, receive: 16, set: 8, block: 19, speed: 13 }, 
        img: '/assets/kuroo.png',
        quirk: { name: "Килл-Блок", desc: "+4 к Блоку." }
    },
    { 
        id: 'kenma', name: 'Козуме Кенма', team: 'Nekoma', 
        stats: { power: 6, receive: 8, set: 19, block: 5, speed: 7 }, 
        img: '/assets/kenma.png',
        quirk: { name: "Мозг", desc: "Увеличивает шанс удачи команды." }
    },
    { 
        id: 'yaku', name: 'Яку Мориске', team: 'Nekoma', 
        stats: { power: 8, receive: 20, set: 10, block: 4, speed: 16 }, 
        img: '/assets/yaku.png', 
        quirk: { name: "Страж Некомы", desc: "+4 к Приему." } 
    },

    // --- SHIRATORIZAWA ---
    { 
        id: 'ushijima', name: 'Ушиджима Вакатоши', team: 'Shiratorizawa', 
        stats: { power: 20, receive: 13, set: 5, block: 14, speed: 12 }, 
        img: '/assets/ushijima.png',
        quirk: { name: "Левша", desc: "+4 к Атаке и Подаче." }
    },
    { 
        id: 'tendo', name: 'Тендо Сатори', team: 'Shiratorizawa', 
        stats: { power: 12, receive: 8, set: 4, block: 18, speed: 15 }, 
        img: '/assets/tendo.png',
        quirk: { name: "Интуиция", desc: "+5 к Блоку." }
    },

    // --- FUKURODANI ---
    { 
        id: 'bokuto', name: 'Бокуто Котаро', team: 'Fukurodani', 
        stats: { power: 19, receive: 12, set: 5, block: 11, speed: 15 }, 
        img: '/assets/bokuto.png',
        quirk: { name: "Эмо-Мод", desc: "Рандом: либо +8 к Атаке, либо -5." }
    },
    { 
        id: 'akaashi', name: 'Акааши Кейджи', team: 'Fukurodani', 
        stats: { power: 11, receive: 13, set: 18, block: 10, speed: 13 }, 
        img: '/assets/akaashi.png', 
        quirk: null 
    }
];

module.exports = characters;