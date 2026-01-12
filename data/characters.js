const characters = [
    // --- KARASUNO ---
    { id: 'hinata', name: 'Хината Шоё', team: 'Karasuno', stats: { power: 12, receive: 7, set: 5, block: 9, serve: 10 }, img: '/assets/hinata.png', quirk: { name: "Вжух!", desc: "+5 к Атаке за счет скорости." } },
    { id: 'kageyama', name: 'Кагеяма Тобио', team: 'Karasuno', stats: { power: 15, receive: 14, set: 20, block: 14, serve: 19 }, img: '/assets/kageyama.png', quirk: { name: "Король Площадки", desc: "Максимальный бонус к атаке спайкера (+5)." } },
    { id: 'nishinoya', name: 'Нишиноя Ю', team: 'Karasuno', stats: { power: 6, receive: 20, set: 9, block: 2, serve: 5 }, img: '/assets/nishinoya.png', quirk: { name: "Rolling Thunder", desc: "+5 к Приему." } },
    { id: 'tsukishima', name: 'Цукишима Кей', team: 'Karasuno', stats: { power: 11, receive: 12, set: 11, block: 17, serve: 13 }, img: '/assets/tsukishima.png', quirk: { name: "Чтение Блока", desc: "+4 к Блоку." } },
    { id: 'daichi', name: 'Савамура Дайчи', team: 'Karasuno', stats: { power: 13, receive: 19, set: 8, block: 10, serve: 13 }, img: '/assets/daichi.png', quirk: { name: "Капитан", desc: "+2 к Приему." } },
    { id: 'asahi', name: 'Адзумане Асахи', team: 'Karasuno', stats: { power: 19, receive: 11, set: 4, block: 12, serve: 17 }, img: '/assets/asahi.png', quirk: { name: "Ас", desc: "+3 к Атаке." } },
    { id: 'tanaka', name: 'Танака Рюноске', team: 'Karasuno', stats: { power: 16, receive: 10, set: 5, block: 8, serve: 15 }, img: '/assets/tanaka.png', quirk: null },
    { id: 'yamaguchi', name: 'Ямагучи Тадаши', team: 'Karasuno', stats: { power: 12, receive: 9, set: 6, block: 7, serve: 18 }, img: '/assets/yamaguchi.png', quirk: { name: "Планер", desc: "+4 к Подаче." } },
    { id: 'ennoshita', name: 'Энношита Чикара', team: 'Karasuno', stats: { power: 11, receive: 14, set: 8, block: 9, serve: 12 }, img: '/assets/ennoshita.png', quirk: { name: "Замена", desc: "Стабильность." } },

    // --- AOBA JOHSAI ---
    { id: 'oikawa', name: 'Ойкава Тоору', team: 'Seijoh', stats: { power: 15, receive: 13, set: 19, block: 11, serve: 20 }, img: '/assets/oikawa.png', quirk: { name: "Великий Король", desc: "+5 к Подаче, высокий бонус паса." } },
    { id: 'iwai', name: 'Иваизуми Хаджиме', team: 'Seijoh', stats: { power: 18, receive: 14, set: 7, block: 10, serve: 16 }, img: '/assets/iwai.png', quirk: { name: "Ас Сейджо", desc: "+2 к Атаке." } },
    { id: 'kyotani', name: 'Кётани (Пёс)', team: 'Seijoh', stats: { power: 21, receive: 8, set: 4, block: 10, serve: 16 }, img: '/assets/kyotani.png', quirk: { name: "Ёбнутый", desc: "+3 Атаки, но риск аута." } },
    { id: 'kunimi', name: 'Куними Акира', team: 'Seijoh', stats: { power: 12, receive: 15, set: 12, block: 9, serve: 14 }, img: '/assets/kunimi.png', quirk: null },
    { id: 'kindaichi', name: 'Киндаичи Ютаро', team: 'Seijoh', stats: { power: 14, receive: 10, set: 5, block: 13, serve: 13 }, img: '/assets/kindaichi.png', quirk: null },

    // --- NEKOMA ---
    { id: 'kuroo', name: 'Куроо Тецуро', team: 'Nekoma', stats: { power: 14, receive: 16, set: 8, block: 18, serve: 16 }, img: '/assets/kuroo.png', quirk: { name: "Килл-Блок", desc: "+4 к Блоку." } },
    { id: 'kenma', name: 'Козуме Кенма', team: 'Nekoma', stats: { power: 6, receive: 8, set: 19, block: 5, serve: 12 }, img: '/assets/kenma.png', quirk: { name: "Мозг Некомы", desc: "Если в команде, все игроки из Некомы получают +2 ко всем статам." } },
    { id: 'yaku', name: 'Яку Мориске', team: 'Nekoma', stats: { power: 8, receive: 20, set: 10, block: 2, serve: 5 }, img: '/assets/yaku.png', quirk: { name: "Страж", desc: "+4 к Приему." } },
    { id: 'yamamoto', name: 'Ямамото Такетора', team: 'Nekoma', stats: { power: 16, receive: 15, set: 5, block: 9, serve: 14 }, img: '/assets/yamamoto.png', quirk: null },
    { id: 'lev', name: 'Хайба Лев', team: 'Nekoma', stats: { power: 17, receive: 5, set: 3, block: 12, serve: 12 }, img: '/assets/lev.png', quirk: null },
    { id: 'fukunaga', name: 'Фукунага Шохей', team: 'Nekoma', stats: { power: 13, receive: 14, set: 6, block: 8, serve: 14 }, img: '/assets/fukunaga.png', quirk: null },
    { id: 'kai', name: 'Кай Нобуюки', team: 'Nekoma', stats: { power: 12, receive: 16, set: 10, block: 10, serve: 12 }, img: '/assets/kai.png', quirk: null },
    { id: 'inuoka', name: 'Инуока Со', team: 'Nekoma', stats: { power: 13, receive: 11, set: 4, block: 13, serve: 11 }, img: '/assets/inuoka.png', quirk: null },

    // --- SHIRATORIZAWA ---
    { id: 'ushijima', name: 'Ушиджима Вакатоши', team: 'Shiratorizawa', stats: { power: 20, receive: 13, set: 5, block: 14, serve: 19 }, img: '/assets/ushijima.png', quirk: { name: "Левша", desc: "+4 к Атаке и Подаче." } },
    { id: 'tendo', name: 'Тендо Сатори', team: 'Shiratorizawa', stats: { power: 12, receive: 8, set: 4, block: 18, serve: 12 }, img: '/assets/tendo.png', quirk: { name: "Guess Block", desc: "Если угадал, сила блока удваивается (+10)." } },
    { id: 'goshiki', name: 'Гошики Цутому', team: 'Shiratorizawa', stats: { power: 17, receive: 11, set: 5, block: 9, serve: 16 }, img: '/assets/goshiki.png', quirk: null },

    // --- INARIZAKI ---
    { id: 'atsumu', name: 'Мия Атсуму', team: 'Inarizaki', stats: { power: 16, receive: 13, set: 19, block: 10, serve: 19 }, img: '/assets/atsumu.png', quirk: { name: "Двойной вилд", desc: "Высокий бонус паса и сильная подача." } },
    { id: 'osamu', name: 'Мия Осаму', team: 'Inarizaki', stats: { power: 16, receive: 14, set: 16, block: 11, serve: 16 }, img: '/assets/osamu.png', quirk: null },
    { id: 'aran', name: 'Оджиро Аран', team: 'Inarizaki', stats: { power: 19, receive: 12, set: 5, block: 11, serve: 17 }, img: '/assets/aran.png', quirk: { name: "Топ-3 Ас", desc: "+3 к Атаке." } },
    { id: 'suna', name: 'Суна Ринтаро', team: 'Inarizaki', stats: { power: 15, receive: 9, set: 6, block: 16, serve: 14 }, img: '/assets/suna.png', quirk: { name: "Широкая атака", desc: "Сложнее заблокировать." } },

    // --- FUKURODANI ---
    { id: 'bokuto', name: 'Бокуто Котаро', team: 'Fukurodani', stats: { power: 19, receive: 12, set: 5, block: 11, serve: 16 }, img: '/assets/bokuto.png', quirk: { name: "Эмо-Мод", desc: "Рандом: либо +8 к Атаке, либо -5." } },
    { id: 'akaashi', name: 'Акааши Кейджи', team: 'Fukurodani', stats: { power: 11, receive: 13, set: 18, block: 10, serve: 14 }, img: '/assets/akaashi.png', quirk: { name: "Контроль", desc: "Стабильный бонус паса." } },

    // --- KAMOMEDAI ---
    { id: 'hoshiumi', name: 'Хошиуми Корай', team: 'Kamomedai', stats: { power: 17, receive: 17, set: 15, block: 14, serve: 18 }, img: '/assets/hoshiumi.png', quirk: { name: "Маленький Гигант", desc: "Универсал." } },
    { id: 'hirugami', name: 'Хиругами Сачиро', team: 'Kamomedai', stats: { power: 12, receive: 11, set: 8, block: 19, serve: 15 }, img: '/assets/hirugami.png', quirk: { name: "Неподвижный", desc: "+3 к Блоку." } },

    // --- DATEKO ---
    { id: 'aone', name: 'Аоне Таканобу', team: 'Dateko', stats: { power: 14, receive: 9, set: 4, block: 19, serve: 13 }, img: '/assets/aone.png', quirk: { name: "Железная стена", desc: "Мощный блок." } },
    { id: 'koganegawa', name: 'Коганегава Канджи', team: 'Dateko', stats: { power: 15, receive: 7, set: 12, block: 18, serve: 11 }, img: '/assets/koganegawa.png', quirk: null },

    // --- ITACHIYAMA ---
    { id: 'sakusa', name: 'Сакуса Киёми', team: 'Itachiyama', stats: { power: 18, receive: 17, set: 8, block: 12, serve: 18 }, img: '/assets/sakusa.png', quirk: { name: "Вращение", desc: "Бьет по диагонали. Принимать сложно." } },

    // --- MUJINAZAKA ---
    { id: 'kiryu', name: 'Кирью Вакацу', team: 'Mujinazaka', stats: { power: 19, receive: 13, set: 6, block: 11, serve: 17 }, img: '/assets/kiryu.png', quirk: { name: "Бэнкей", desc: "+3 к Атаке." } },

    // --- OTHERS ---
    { id: 'hyakuzawa', name: 'Хякузава Юдай', team: 'Kakugawa', stats: { power: 17, receive: 5, set: 3, block: 12, serve: 10 }, img: '/assets/hyakuzawa.png', quirk: { name: "2 Метра", desc: "Иммунитет к Килл-Блоку." } },
    { id: 'daishou', name: 'Дайшо Сугуру', team: 'Nohebi', stats: { power: 15, receive: 15, set: 7, block: 10, serve: 14 }, img: '/assets/daishou.png', quirk: { name: "Жыланбалык", desc: "Провоцирует связующего давая -2 к сету." } },
    { id: 'takeru', name: 'Накашима Такеру', team: 'Wakutani', stats: { power: 14, receive: 14, set: 8, block: 12, serve: 13 }, img: '/assets/takeru.png', quirk: { name: "Блок-аут", desc: "Отыгрыш." } },
    { id: 'gora', name: 'Гора Масаки', team: 'Ubugawa', stats: { power: 16, receive: 9, set: 5, block: 8, serve: 17 }, img: '/assets/gora.png', quirk: null },
    { id: 'hinata_ts', name: 'Ниндзя Хината', team: 'MSBY Black Jackals', stats: { power: 30, receive: 20, set: 15, block: 20, serve: 20 }, img: '/assets/hinata_ts.png', quirk: { name: "Ниндзя", desc: "50% шанс полностью обнулить успешный блок соперника." }, isSecret: true }
];

module.exports = characters;
