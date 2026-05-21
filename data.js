/**
 * data.js — Данные приложения «Арбат»
 *
 * Здесь хранятся все тестовые данные для MVP.
 * Когда подключим бэкенд (FastAPI + PostgreSQL),
 * эти данные заменятся реальными запросами к API.
 *
 * Чтобы изменить данные — редактируй этот файл.
 * Чтобы добавить событие — добавь объект в массив EVENTS.
 */

'use strict';

/* ─── Данные заведения ─── */
const VENUE = {
  name: 'Арбат',
  city: 'Микашевичи',
  address: 'ул. Первомайская, 1В',
  phone: '+375 29 930-10-01',
  supportUsername: 'arbat_support',

  club: {
    name: 'Клуб «Арбат»',
    workDays: [5, 6],       // 5 = пятница, 6 = суббота (getDay())
    openTime: '23:00',
    closeTime: '02:00',
    tablesCount: 10,
  },

  cafe: {
    name: 'Кафе «Арбат»',
    openTime: '09:00',
    closeTime: '22:00',
    comingSoon: true,       // заглушка в MVP
  }
};

/* ─── События афиши ─── */
/* Формат даты: YYYY-MM-DD */
const EVENTS = [
  {
    id: 1,
    title: 'DJ МАКСИМ — HOUSE NIGHT',
    subtitle: 'Лучший хаус и техно региона',
    date: '2026-05-29',     // ближайшая пятница от сегодня
    time: '23:00',
    price: 10,              // BYN, 0 = бесплатно
    emoji: '🎧',            // заглушка вместо фото
    description: 'Один из лучших диджеев Брестской области возвращается в «Арбат»! Ожидайте незабываемый вечер: house, tech-house и атмосфера настоящего клуба.',
    color: '#1a0533',       // цвет фона заглушки
  },
  {
    id: 2,
    title: 'LATINA NIGHT',
    subtitle: 'Сальса, бачата, reggaeton',
    date: '2026-05-30',
    time: '23:00',
    price: 10,
    emoji: '💃',
    description: 'Горячая латиноамериканская ночь! Сальса, бачата, реггетон и лучшие латинские хиты. Дресс-код: яркие цвета.',
    color: '#330011',
  },
  {
    id: 3,
    title: '90-Е ВЕЧЕРИНКА',
    subtitle: 'Хиты, которые мы помним',
    date: '2026-06-05',
    time: '23:00',
    price: 8,
    emoji: '🕺',
    description: 'Ностальгическая вечеринка по лучшим хитам 90-х! Руки Вверх, Технология, Ace of Base — всё это и многое другое.',
    color: '#003322',
  },
  {
    id: 4,
    title: 'ДЕНЬ ГОРОДА — SPECIAL',
    subtitle: 'Большой праздник',
    date: '2026-06-06',
    time: '22:00',
    price: 0,              // бесплатный вход
    emoji: '🎉',
    description: 'Специальное мероприятие в честь Дня города Микашевичи! Бесплатный вход, живая музыка, конкурсы и призы.',
    color: '#002244',
  },
];

/* ─── Столы клуба ─── */
const TABLES = [
  { id: 1, num: 1, capacity: 4,  zone: 'main',  status: 'free',  label: 'Основной зал' },
  { id: 2, num: 2, capacity: 4,  zone: 'main',  status: 'busy',  label: 'Основной зал' },
  { id: 3, num: 3, capacity: 6,  zone: 'main',  status: 'free',  label: 'У стены' },
  { id: 4, num: 4, capacity: 4,  zone: 'main',  status: 'free',  label: 'Основной зал' },
  { id: 5, num: 5, capacity: 2,  zone: 'bar',   status: 'busy',  label: 'Барная зона' },
  { id: 6, num: 6, capacity: 6,  zone: 'vip',   status: 'free',  label: 'VIP-зона' },
  { id: 7, num: 7, capacity: 4,  zone: 'main',  status: 'free',  label: 'Основной зал' },
  { id: 8, num: 8, capacity: 6,  zone: 'main',  status: 'free',  label: 'У сцены' },
  { id: 9, num: 9, capacity: 4,  zone: 'main',  status: 'free',  label: 'Основной зал' },
  { id: 10, num: 10, capacity: 8, zone: 'vip',  status: 'free',  label: 'VIP-зона' },
];

/* ─── Тестовые бронирования пользователя ─── */
const MOCK_BOOKINGS = [
  {
    id: 42,
    bookingCode: '#АРБ-0042',
    date: '2026-05-30',
    time: '23:00',
    tableNum: 3,
    guests: 4,
    phone: '+375 29 123 45 67',
    status: 'confirmed',   // pending | confirmed | cancelled
    isPast: false,
  },
];

/* ─── Тестовые штампы лояльности ─── */
const MOCK_LOYALTY = {
  stampsCount: 3,    // из 10
  totalStamps: 10,
  reward: 'Бесплатный вход',
};

/* ─── Вспомогательные функции для работы с данными ─── */

/**
 * Возвращает ближайшие N доступных дат (пт/сб) от сегодня
 */
function getAvailableDates(count = 8) {
  const dates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let current = new Date(today);
  let attempts = 0;

  while (dates.length < count && attempts < 60) {
    const dow = current.getDay(); // 0=вс, 5=пт, 6=сб
    if (VENUE.club.workDays.includes(dow)) {
      dates.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
    attempts++;
  }

  return dates;
}

/**
 * Форматирует дату в читаемый вид: «Пятница, 23 мая 2026»
 */
function formatDateFull(dateStr) {
  const date = typeof dateStr === 'string' ? new Date(dateStr + 'T00:00:00') : dateStr;
  const days = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Форматирует дату кратко: «Пт, 23 мая»
 */
function formatDateShort(date) {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  const daysShort = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
  const months = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
  return `${daysShort[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

/**
 * Возвращает день недели кратко: «Пт»
 */
function getDayShort(date) {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  return ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][d.getDay()];
}

/**
 * Возвращает название месяца кратко: «МАЙ»
 */
function getMonthShort(date) {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  return ['ЯНВ','ФЕВ','МАР','АПР','МАЙ','ИЮН','ИЮЛ','АВГ','СЕН','ОКТ','НОЯ','ДЕК'][d.getMonth()];
}

/**
 * Форматирует цену: 0 → «Бесплатно», 10 → «10 руб.»
 */
function formatPrice(price) {
  return price === 0 ? 'Вход свободный' : `${price} руб.`;
}

/**
 * Возвращает предстоящие события (от сегодня)
 */
function getUpcomingEvents(period = 'all') {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return EVENTS.filter(event => {
    const eventDate = new Date(event.date + 'T00:00:00');
    if (eventDate < today) return false;

    if (period === 'all') return true;

    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const thisMonthEnd   = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const nextMonthEnd   = new Date(today.getFullYear(), today.getMonth() + 2, 0);

    if (period === 'this_month') return eventDate >= thisMonthStart && eventDate <= thisMonthEnd;
    if (period === 'next_month') return eventDate >= nextMonthStart && eventDate <= nextMonthEnd;
    return true;
  }).sort((a, b) => new Date(a.date) - new Date(b.date));
}

/**
 * Генерирует уникальный код бронирования
 */
function generateBookingCode() {
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `#АРБ-${num}`;
}

/**
 * Возвращает ближайшее событие (в ближайшие 7 дней)
 */
function getNearestEvent() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekLater = new Date(today);
  weekLater.setDate(weekLater.getDate() + 7);

  return EVENTS.find(event => {
    const d = new Date(event.date + 'T00:00:00');
    return d >= today && d <= weekLater;
  }) || null;
}
