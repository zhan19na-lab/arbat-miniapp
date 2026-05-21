/**
 * app.js — Главный модуль приложения «Арбат» Telegram Mini App
 *
 * Содержит:
 * - Инициализацию Telegram Web App SDK
 * - Систему навигации между экранами
 * - Логику всех экранов (бронирование, афиша, лояльность...)
 * - Toast-уведомления и Bottom Sheet
 * - Polling карты столов (каждые 20 сек)
 */

'use strict';

const App = (() => {

  /* ─── Состояние приложения ─── */
  let state = {
    currentScreen: null,
    previousScreen: null,
    user: null,              // данные пользователя из Telegram
    tgApp: null,             // объект Telegram.WebApp

    /* Бронирование — мастер из 4 шагов */
    booking: {
      step: 1,
      selectedDate: null,
      selectedTable: null,
      guests: null,
      phone: '',
      name: '',
      comment: '',
    },

    /* Текущий открытый ID события */
    currentEventId: null,

    /* Polling карты столов */
    mapPollingInterval: null,

    /* Фильтр афиши */
    eventsFilter: 'all',
  };

  /* ─── Инициализация при загрузке страницы ─── */
  function init() {
    /* Инициализируем Telegram Web App SDK */
    if (window.Telegram && window.Telegram.WebApp) {
      state.tgApp = window.Telegram.WebApp;
      state.tgApp.ready();                          // сообщаем Telegram что приложение готово
      state.tgApp.expand();                         // разворачиваем на весь экран
      state.tgApp.enableClosingConfirmation();      // запрашиваем подтверждение при закрытии

      /* Получаем данные пользователя */
      const initData = state.tgApp.initDataUnsafe;
      if (initData && initData.user) {
        state.user = initData.user;
      }
    } else {
      /* Режим разработки вне Telegram — используем тестовые данные */
      state.user = { id: 12345, first_name: 'Алексей', username: 'test_user' };
    }

    /* Проверяем принятие политики конфиденциальности */
    checkPrivacyAccepted();

    /* Навешиваем кнопку «Назад» в браузере */
    window.addEventListener('popstate', () => {
      if (state.previousScreen) navigate(state.previousScreen);
    });
  }

  /* ─── Проверка: принял ли пользователь политику ─── */
  function checkPrivacyAccepted() {
    if (state.tgApp && state.tgApp.CloudStorage) {
      /* Используем CloudStorage Telegram (сохраняется между сессиями) */
      state.tgApp.CloudStorage.getItem('privacy_accepted', (err, value) => {
        if (value === 'true') {
          navigate('home');
        } else {
          navigate('onboarding');
          setupOnboarding();
        }
      });
    } else {
      /* Fallback: localStorage для разработки в браузере */
      const accepted = localStorage.getItem('arbat_privacy_accepted');
      if (accepted === 'true') {
        navigate('home');
      } else {
        navigate('onboarding');
        setupOnboarding();
      }
    }
  }

  /* ─── Навигация между экранами ─── */
  function navigate(screenName) {
    const screens = document.querySelectorAll('.screen');

    /* Скрываем предыдущий экран */
    screens.forEach(s => {
      s.classList.remove('screen--active', 'screen--slide-out');
    });

    /* Показываем нужный экран */
    const target = document.getElementById(`screen-${screenName}`);
    if (!target) {
      console.warn(`Экран screen-${screenName} не найден`);
      return;
    }

    state.previousScreen = state.currentScreen;
    state.currentScreen = screenName;

    target.classList.add('screen--active');

    /* Останавливаем polling если уходим с карты столов */
    if (state.previousScreen === 'table-map' && screenName !== 'table-map') {
      stopMapPolling();
    }

    /* Инициализируем логику нужного экрана */
    switch(screenName) {
      case 'home':         renderHome();        break;
      case 'club-home':    renderClubHome();    break;
      case 'events':       renderEvents();      break;
      case 'booking':      initBooking();       break;
      case 'table-map':    initTableMap();      break;
      case 'profile':      renderProfile();     break;
      case 'my-bookings':  renderMyBookings();  break;
    }

    /* Haptic feedback при навигации */
    triggerHaptic('light');
  }

  /* ─── Haptic feedback ─── */
  function triggerHaptic(style = 'light') {
    if (state.tgApp && state.tgApp.HapticFeedback) {
      state.tgApp.HapticFeedback.impactOccurred(style);
    }
  }

  /* ═══════════════════════════════════════════════════════
     ЭКРАН ОНБОРДИНГА
     ═══════════════════════════════════════════════════════ */
  function setupOnboarding() {
    const btn = document.getElementById('btn-accept-privacy');
    if (!btn) return;

    /* Кнопка неактивна первые 2 секунды */
    btn.disabled = true;
    setTimeout(() => { btn.disabled = false; }, 2000);

    btn.addEventListener('click', acceptPrivacy);

    /* Ссылка на политику */
    const privacyLink = document.getElementById('privacy-link');
    if (privacyLink) {
      privacyLink.addEventListener('click', (e) => {
        e.preventDefault();
        showPrivacyPolicy();
      });
    }
  }

  function acceptPrivacy() {
    const timestamp = new Date().toISOString();

    /* Сохраняем в CloudStorage Telegram */
    if (state.tgApp && state.tgApp.CloudStorage) {
      state.tgApp.CloudStorage.setItem('privacy_accepted', 'true');
      state.tgApp.CloudStorage.setItem('privacy_accepted_at', timestamp);
    } else {
      localStorage.setItem('arbat_privacy_accepted', 'true');
    }

    navigate('home');
  }

  /* ═══════════════════════════════════════════════════════
     ГЛАВНЫЙ ЭКРАН
     ═══════════════════════════════════════════════════════ */
  function renderHome() {
    /* Персонализированное приветствие */
    const greetingEl = document.getElementById('user-greeting');
    if (greetingEl && state.user) {
      greetingEl.textContent = `Привет, ${state.user.first_name}! 👋`;
    }
  }

  /* ═══════════════════════════════════════════════════════
     ГЛАВНЫЙ ЭКРАН КЛУБА
     ═══════════════════════════════════════════════════════ */
  function renderClubHome() {
    /* Баннер ближайшего события */
    const nearest = getNearestEvent();
    const banner = document.getElementById('club-event-banner');

    if (nearest && banner) {
      banner.style.display = 'block';
      const bannerImg = document.getElementById('banner-img');
      const bannerDate = document.getElementById('banner-date');
      const bannerTitle = document.getElementById('banner-title');

      if (bannerImg)  bannerImg.style.background = `linear-gradient(135deg, ${nearest.color}, #4a1280)`;
      if (bannerImg)  bannerImg.textContent = nearest.emoji;
      if (bannerDate) bannerDate.textContent = formatDateShort(nearest.date).toUpperCase();
      if (bannerTitle) bannerTitle.textContent = nearest.title;

      /* Сохраняем ID для открытия */
      banner.dataset.eventId = nearest.id;
    } else if (banner) {
      banner.style.display = 'none';
    }

    /* Горизонтальная мини-афиша */
    const scrollEl = document.getElementById('club-events-scroll');
    if (!scrollEl) return;

    const events = getUpcomingEvents('all').slice(0, 6);
    scrollEl.innerHTML = '';

    events.forEach(event => {
      const card = document.createElement('div');
      card.className = 'event-mini-card';
      card.onclick = () => openEvent(event.id);
      card.innerHTML = `
        <div class="event-mini-card__img" style="background:linear-gradient(135deg,${event.color},#4a1280)">
          ${event.emoji}
        </div>
        <div class="event-mini-card__body">
          <div class="event-mini-card__date">${formatDateShort(event.date)}</div>
          <div class="event-mini-card__title">${event.title}</div>
        </div>
      `;
      scrollEl.appendChild(card);
    });
  }

  /* Открываем событие из баннера */
  function openBannerEvent() {
    const banner = document.getElementById('club-event-banner');
    if (banner && banner.dataset.eventId) {
      openEvent(parseInt(banner.dataset.eventId));
    }
  }

  /* ═══════════════════════════════════════════════════════
     АФИША
     ═══════════════════════════════════════════════════════ */
  function renderEvents(period = null) {
    const filter = period || state.eventsFilter;
    state.eventsFilter = filter;

    const listEl = document.getElementById('events-list');
    const emptyEl = document.getElementById('events-empty');
    if (!listEl) return;

    const events = getUpcomingEvents(filter);
    listEl.innerHTML = '';

    if (events.length === 0) {
      listEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'flex';
      return;
    }

    listEl.style.display = 'flex';
    if (emptyEl) emptyEl.style.display = 'none';

    events.forEach(event => {
      const card = document.createElement('div');
      card.className = 'event-card';
      card.onclick = () => openEvent(event.id);
      card.innerHTML = `
        <div class="event-card__img" style="background:linear-gradient(135deg,${event.color},#4a1280)">
          ${event.emoji}
        </div>
        <div class="event-card__body">
          <div class="event-card__date">${formatDateFull(event.date)}</div>
          <div class="event-card__title">${event.title}</div>
          <div class="event-card__subtitle">${event.subtitle}</div>
          <div class="event-card__price">🕙 ${event.time} &nbsp;•&nbsp; 💰 ${formatPrice(event.price)}</div>
        </div>
      `;
      listEl.appendChild(card);
    });
  }

  /* Переключение фильтра афиши */
  function filterEvents(period, btn) {
    state.eventsFilter = period;

    /* Обновляем активную вкладку */
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('filter-tab--active'));
    if (btn) btn.classList.add('filter-tab--active');

    renderEvents(period);
  }

  /* Открываем карточку события */
  function openEvent(eventId) {
    const event = EVENTS.find(e => e.id === eventId);
    if (!event) return;

    state.currentEventId = eventId;

    /* Заполняем детали события */
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const setStyle = (id, prop, val) => { const el = document.getElementById(id); if (el) el.style[prop] = val; };

    setEl('detail-title', event.title);
    setEl('detail-date', formatDateFull(event.date));
    setEl('detail-time', `Начало: ${event.time}`);
    setEl('detail-price', formatPrice(event.price));
    setEl('detail-desc', event.description);

    const imgEl = document.getElementById('detail-img');
    if (imgEl) {
      imgEl.style.background = `linear-gradient(135deg, ${event.color}, #4a1280)`;
      imgEl.textContent = event.emoji;
    }

    navigate('event-detail');
  }

  /* Заглушка покупки билета (ЕРИП в v2) */
  function showTicketStub() {
    const event = EVENTS.find(e => e.id === state.currentEventId);
    const price = event ? formatPrice(event.price) : '';

    showBottomSheet(`
      <h3 style="margin-bottom:12px">🎟️ Купить билет</h3>
      <p style="color:var(--tg-theme-hint-color);line-height:1.6;margin-bottom:16px">
        Онлайн-оплата появится в следующей версии.<br>
        Купите билет на входе.<br>
        <strong>Цена: ${price}</strong>
      </p>
      <button class="btn btn--primary btn--full" onclick="App.closeBottomSheet();App.navigate('booking')">
        📅 Забронировать столик
      </button>
      <button class="btn btn--ghost btn--full" style="margin-top:8px" onclick="App.closeBottomSheet()">
        Закрыть
      </button>
    `);
  }

  /* ═══════════════════════════════════════════════════════
     БРОНИРОВАНИЕ — мастер из 4 шагов
     ═══════════════════════════════════════════════════════ */
  function initBooking() {
    /* Сбрасываем состояние или восстанавливаем черновик */
    const draft = loadBookingDraft();
    if (draft) {
      showBottomSheet(`
        <h3 style="margin-bottom:12px">Продолжить?</h3>
        <p style="color:var(--tg-theme-hint-color);margin-bottom:16px;line-height:1.5">
          У вас есть незавершённое бронирование.<br>Продолжить с того места?
        </p>
        <button class="btn btn--primary btn--full" onclick="App.restoreBookingDraft();App.closeBottomSheet()">
          Продолжить
        </button>
        <button class="btn btn--ghost btn--full" style="margin-top:8px" onclick="App.resetBooking();App.closeBottomSheet()">
          Начать заново
        </button>
      `);
    } else {
      resetBooking();
    }
  }

  function resetBooking() {
    state.booking = { step: 1, selectedDate: null, selectedTable: null, guests: null, phone: '', name: '', comment: '' };
    bookingGoToStep(1);
    renderDatePicker();
    /* Предзаполняем имя из Telegram */
    const nameInput = document.getElementById('booking-name');
    if (nameInput && state.user) nameInput.value = state.user.first_name || '';
  }

  function restoreBookingDraft() {
    const draft = loadBookingDraft();
    if (!draft) return;
    state.booking = { ...state.booking, ...draft };
    bookingGoToStep(state.booking.step || 1);
    renderDatePicker();
    renderTablePicker();
  }

  /* Рендер выбора даты (шаг 1) */
  function renderDatePicker() {
    const container = document.getElementById('date-scroll');
    if (!container) return;

    container.innerHTML = '';
    const dates = getAvailableDates(10);

    dates.forEach(date => {
      const chip = document.createElement('button');
      chip.className = 'date-chip';
      chip.innerHTML = `
        <span class="date-chip__day">${getDayShort(date)}</span>
        <span class="date-chip__date">${date.getDate()}</span>
        <span class="date-chip__month">${getMonthShort(date)}</span>
      `;

      /* Выделяем если уже выбрано */
      if (state.booking.selectedDate && date.toDateString() === state.booking.selectedDate.toDateString()) {
        chip.classList.add('date-chip--selected');
      }

      chip.addEventListener('click', () => {
        document.querySelectorAll('.date-chip').forEach(c => c.classList.remove('date-chip--selected'));
        chip.classList.add('date-chip--selected');
        state.booking.selectedDate = date;
        document.getElementById('btn-step1-next').disabled = false;
        saveBookingDraft();
        triggerHaptic('light');
      });

      container.appendChild(chip);
    });
  }

  /* Рендер выбора стола (шаг 2) */
  function renderTablePicker() {
    const container = document.getElementById('tables-grid');
    if (!container) return;

    container.innerHTML = '';

    /* Обновляем заголовок шага */
    const dateLabel = document.getElementById('step2-selected-date');
    if (dateLabel && state.booking.selectedDate) {
      dateLabel.textContent = `${formatDateFull(state.booking.selectedDate)} • 23:00–02:00`;
    }

    TABLES.forEach(table => {
      const chip = document.createElement('div');
      chip.className = `table-chip table-chip--${table.status}`;

      const isBusy = table.status === 'busy';
      const isSelected = state.booking.selectedTable && state.booking.selectedTable.id === table.id;

      if (isSelected) chip.classList.add('table-chip--selected');
      if (isBusy) chip.style.pointerEvents = 'none';

      chip.innerHTML = `
        <span class="table-chip__num">Стол ${table.num}</span>
        <span class="table-chip__label">${isBusy ? 'Занят' : '🟢'}</span>
        <span class="table-chip__cap">до ${table.capacity} чел.</span>
      `;

      if (!isBusy) {
        chip.addEventListener('click', () => {
          document.querySelectorAll('.table-chip').forEach(c => c.classList.remove('table-chip--selected'));
          chip.classList.add('table-chip--selected');
          state.booking.selectedTable = table;
          document.getElementById('btn-step2-next').disabled = false;
          saveBookingDraft();
          triggerHaptic('light');
        });
      }

      container.appendChild(chip);
    });
  }

  /* Переход к следующему шагу */
  function bookingNextStep() {
    /* Валидация шага 3 */
    if (state.booking.step === 3) {
      const phone = document.getElementById('booking-phone').value.trim();
      const name = document.getElementById('booking-name').value.trim();

      if (!phone || phone.length < 10) {
        showToast('Введите корректный номер телефона');
        return;
      }
      if (!state.booking.guests) {
        showToast('Выберите количество гостей');
        return;
      }

      state.booking.phone = phone;
      state.booking.name = name;
      state.booking.comment = document.getElementById('booking-comment').value.trim();
    }

    const nextStep = state.booking.step + 1;
    bookingGoToStep(nextStep);
  }

  /* Переход к конкретному шагу */
  function bookingGoToStep(step) {
    state.booking.step = step;

    /* Скрываем все шаги */
    [1,2,3,4].forEach(s => {
      const el = document.getElementById(`booking-step-${s}`);
      if (el) el.style.display = 'none';
    });
    const success = document.getElementById('booking-success');
    if (success) success.style.display = 'none';

    /* Показываем нужный */
    const stepEl = document.getElementById(`booking-step-${step}`);
    if (stepEl) stepEl.style.display = 'flex';
    if (stepEl) stepEl.style.flexDirection = 'column';

    /* Обновляем индикатор шага */
    const label = document.getElementById('booking-step-label');
    if (label) label.textContent = `Шаг ${step} из 4`;

    /* Кнопка Назад */
    const backBtn = document.getElementById('booking-back-btn');
    if (backBtn) {
      backBtn.onclick = step === 1 ? () => navigate('club-home') : () => bookingGoToStep(step - 1);
    }

    /* Рендер шага 2 при переходе */
    if (step === 2) {
      renderTablePicker();
    }

    /* Заполняем данные шага 4 */
    if (step === 4) {
      renderBookingConfirmation();
    }

    saveBookingDraft();
  }

  /* Рендер экрана подтверждения (шаг 4) */
  function renderBookingConfirmation() {
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl('confirm-date', state.booking.selectedDate ? formatDateFull(state.booking.selectedDate) : '—');
    setEl('confirm-table', state.booking.selectedTable ? `Стол №${state.booking.selectedTable.num}` : '—');
    setEl('confirm-guests', state.booking.guests ? `${state.booking.guests} гост${state.booking.guests === 1 ? 'ь' : state.booking.guests < 5 ? 'я' : 'ей'}` : '—');
    setEl('confirm-phone', state.booking.phone || '—');
  }

  /* Отправка бронирования */
  function confirmBooking() {
    /* В MVP просто показываем экран успеха */
    /* В v2 здесь будет POST /api/v1/bookings/ */

    const code = generateBookingCode();
    const table = state.booking.selectedTable;

    /* Скрываем шаг 4, показываем успех */
    const step4 = document.getElementById('booking-step-4');
    if (step4) step4.style.display = 'none';

    const success = document.getElementById('booking-success');
    if (success) success.style.display = 'flex';

    const idEl = document.getElementById('success-booking-id');
    if (idEl) idEl.textContent = `${code} • Стол №${table ? table.num : '?'} • ${state.booking.selectedDate ? formatDateShort(state.booking.selectedDate) : ''}`;

    /* Скрываем индикатор шага */
    const label = document.getElementById('booking-step-label');
    if (label) label.textContent = '';

    /* Очищаем черновик */
    clearBookingDraft();

    triggerHaptic('success');
  }

  /* Выбор количества гостей */
  function selectGuests(count, btn) {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('chip--selected'));
    btn.classList.add('chip--selected');
    state.booking.guests = count;
    saveBookingDraft();
    triggerHaptic('light');
  }

  /* ─── Черновик бронирования в CloudStorage ─── */
  function saveBookingDraft() {
    const draft = {
      step: state.booking.step,
      selectedDate: state.booking.selectedDate ? state.booking.selectedDate.toISOString() : null,
      selectedTable: state.booking.selectedTable ? state.booking.selectedTable.id : null,
      guests: state.booking.guests,
      phone: state.booking.phone,
      name: state.booking.name,
    };
    const val = JSON.stringify(draft);

    if (state.tgApp && state.tgApp.CloudStorage) {
      state.tgApp.CloudStorage.setItem('booking_draft', val);
    } else {
      localStorage.setItem('arbat_booking_draft', val);
    }
  }

  function loadBookingDraft() {
    try {
      const raw = localStorage.getItem('arbat_booking_draft');
      if (!raw) return null;
      const draft = JSON.parse(raw);
      if (!draft || !draft.selectedDate) return null;
      /* Восстанавливаем объект даты */
      draft.selectedDate = new Date(draft.selectedDate);
      draft.selectedTable = draft.selectedTable ? TABLES.find(t => t.id === draft.selectedTable) : null;
      return draft;
    } catch { return null; }
  }

  function clearBookingDraft() {
    if (state.tgApp && state.tgApp.CloudStorage) {
      state.tgApp.CloudStorage.removeItem('booking_draft');
    }
    localStorage.removeItem('arbat_booking_draft');
  }

  /* ═══════════════════════════════════════════════════════
     КАРТА СТОЛОВ — polling каждые 20 сек
     ═══════════════════════════════════════════════════════ */
  function initTableMap() {
    renderTableMap();
    startMapPolling();
  }

  function renderTableMap() {
    const grid = document.getElementById('tables-map-grid');
    if (!grid) return;

    grid.innerHTML = '';

    TABLES.forEach(table => {
      const cell = document.createElement('div');
      cell.className = `map-table map-table--${table.status}`;
      cell.innerHTML = `
        <span class="map-table__icon">${table.status === 'free' ? '🟢' : '🔴'}</span>
        <span class="map-table__num">${table.num}</span>
      `;

      cell.addEventListener('click', () => {
        triggerHaptic('light');
        if (table.status === 'free') {
          showBottomSheet(`
            <h3 style="margin-bottom:10px">Стол №${table.num}</h3>
            <p style="color:var(--tg-theme-hint-color);margin-bottom:4px">${table.label} • до ${table.capacity} человек</p>
            <p style="color:var(--color-success);margin-bottom:16px;font-weight:600">🟢 Свободен</p>
            <button class="btn btn--primary btn--full" onclick="App.closeBottomSheet();App.navigate('booking')">
              📅 Забронировать этот стол
            </button>
          `);
        } else {
          showBottomSheet(`
            <h3 style="margin-bottom:10px">Стол №${table.num}</h3>
            <p style="color:var(--color-danger);font-weight:600">🔴 Занят до 02:00</p>
          `);
        }
      });

      grid.appendChild(cell);
    });

    /* Обновляем время последнего обновления */
    const timeEl = document.getElementById('map-update-time');
    if (timeEl) {
      const now = new Date();
      timeEl.textContent = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
    }
  }

  function startMapPolling() {
    /* Остановить предыдущий интервал если был */
    stopMapPolling();
    /* Polling каждые 20 секунд */
    state.mapPollingInterval = setInterval(() => {
      if (state.currentScreen === 'table-map') {
        /* В v2 здесь будет GET /api/v1/tables/status/ */
        renderTableMap();
      }
    }, 20000);
  }

  function stopMapPolling() {
    if (state.mapPollingInterval) {
      clearInterval(state.mapPollingInterval);
      state.mapPollingInterval = null;
    }
  }

  /* ═══════════════════════════════════════════════════════
     АРЕНДА ЗАЛА
     ═══════════════════════════════════════════════════════ */
  function submitHallRental() {
    const phone = document.getElementById('rental-phone').value.trim();
    const date = document.getElementById('rental-date').value;
    const guests = document.getElementById('rental-guests').value;
    const eventType = document.querySelector('input[name="event-type"]:checked');

    if (!phone || phone.length < 10) { showToast('Введите номер телефона'); return; }
    if (!date) { showToast('Выберите дату'); return; }
    if (!guests) { showToast('Укажите количество гостей'); return; }
    if (!eventType) { showToast('Выберите тип мероприятия'); return; }

    /* В v2 здесь POST /api/v1/bookings/hall-rental/ */
    const formWrap = document.getElementById('hall-rental-form-wrap');
    const successEl = document.getElementById('hall-rental-success');
    if (formWrap) formWrap.style.display = 'none';
    if (successEl) successEl.style.display = 'flex';

    triggerHaptic('success');
  }

  /* ═══════════════════════════════════════════════════════
     ПРОФИЛЬ + ЛОЯЛЬНОСТЬ
     ═══════════════════════════════════════════════════════ */
  function renderProfile() {
    /* Имя пользователя */
    const nameEl = document.getElementById('profile-name');
    if (nameEl && state.user) nameEl.textContent = state.user.first_name || 'Гость';

    /* Штампы лояльности */
    renderStamps();
  }

  function renderStamps() {
    const grid = document.getElementById('stamps-grid');
    const progress = document.getElementById('loyalty-progress');
    if (!grid) return;

    const { stampsCount, totalStamps } = MOCK_LOYALTY;
    grid.innerHTML = '';

    for (let i = 1; i <= totalStamps; i++) {
      const cell = document.createElement('div');
      cell.className = `stamp-cell ${i <= stampsCount ? 'stamp-cell--filled' : ''}`;
      cell.textContent = i <= stampsCount ? '✓' : '';
      grid.appendChild(cell);
    }

    if (progress) {
      progress.textContent = `${stampsCount} из ${totalStamps} штампов`;
    }
  }

  /* ═══════════════════════════════════════════════════════
     МОИ БРОНИРОВАНИЯ
     ═══════════════════════════════════════════════════════ */
  function renderMyBookings(tab = 'upcoming') {
    const listEl = document.getElementById('bookings-list');
    const emptyEl = document.getElementById('bookings-empty');
    if (!listEl) return;

    const isUpcoming = tab === 'upcoming';
    const bookings = MOCK_BOOKINGS.filter(b => isUpcoming ? !b.isPast : b.isPast);

    listEl.innerHTML = '';

    if (bookings.length === 0) {
      listEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'flex';
      return;
    }

    listEl.style.display = 'flex';
    if (emptyEl) emptyEl.style.display = 'none';

    bookings.forEach(b => {
      const statusMap = { confirmed: '✅ Подтверждено', pending: '⏳ Ожидает', cancelled: '❌ Отменено' };
      const item = document.createElement('div');
      item.className = 'booking-item';
      item.innerHTML = `
        <div class="booking-item__id">${b.bookingCode}</div>
        <div class="booking-item__row">📅 <span>${formatDateFull(b.date)} • ${b.time}</span></div>
        <div class="booking-item__row">🪑 <span>Стол №${b.tableNum} &nbsp;•&nbsp; 👥 ${b.guests} гостя</span></div>
        <div class="booking-item__status">${statusMap[b.status] || ''}</div>
        ${isUpcoming && b.status !== 'cancelled' ? `<button class="booking-item__cancel" onclick="App.cancelBooking(${b.id})">Отменить бронирование</button>` : ''}
      `;
      listEl.appendChild(item);
    });
  }

  function switchBookingsTab(tab, btn) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('tab--active'));
    if (btn) btn.classList.add('tab--active');
    renderMyBookings(tab);
  }

  function cancelBooking(id) {
    showBottomSheet(`
      <h3 style="margin-bottom:12px">Отменить бронирование?</h3>
      <p style="color:var(--tg-theme-hint-color);margin-bottom:16px">Это действие нельзя отменить.</p>
      <button class="btn btn--full" style="background:var(--color-danger);color:#fff;margin-bottom:8px" onclick="App._doCancelBooking(${id});App.closeBottomSheet()">
        Да, отменить
      </button>
      <button class="btn btn--ghost btn--full" onclick="App.closeBottomSheet()">
        Назад
      </button>
    `);
  }

  function _doCancelBooking(id) {
    const booking = MOCK_BOOKINGS.find(b => b.id === id);
    if (booking) booking.status = 'cancelled';
    renderMyBookings('upcoming');
    showToast('Бронирование отменено');
  }

  /* ═══════════════════════════════════════════════════════
     ГЛОБАЛЬНЫЕ КОМПОНЕНТЫ
     ═══════════════════════════════════════════════════════ */

  /* ─── Toast-уведомление ─── */
  let toastTimeout = null;
  function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add('toast--visible');

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove('toast--visible');
    }, 3000);
  }

  /* ─── Bottom Sheet ─── */
  function showBottomSheet(html) {
    const overlay = document.getElementById('bottom-sheet-overlay');
    const sheet = document.getElementById('bottom-sheet');
    const content = document.getElementById('bottom-sheet-content');

    if (!overlay || !sheet || !content) return;

    content.innerHTML = html;
    overlay.classList.add('bottom-sheet-overlay--visible');
    sheet.classList.add('bottom-sheet--visible');
    triggerHaptic('light');
  }

  function closeBottomSheet() {
    const overlay = document.getElementById('bottom-sheet-overlay');
    const sheet = document.getElementById('bottom-sheet');
    if (overlay) overlay.classList.remove('bottom-sheet-overlay--visible');
    if (sheet) sheet.classList.remove('bottom-sheet--visible');
  }

  /* ─── Политика конфиденциальности ─── */
  function showPrivacyPolicy() {
    showBottomSheet(`
      <h3 style="margin-bottom:12px">🔒 Политика конфиденциальности</h3>
      <div style="font-size:13px;color:var(--tg-theme-hint-color);line-height:1.7;max-height:300px;overflow-y:auto">
        <p><strong>Кто мы:</strong> ООО «Арбат» и ИП «Арбат», г. Микашевичи, Беларусь.</p>
        <br>
        <p><strong>Какие данные собираем:</strong> Telegram ID, имя, номер телефона (если указан), история бронирований.</p>
        <br>
        <p><strong>Зачем:</strong> Для обработки бронирований и программы лояльности.</p>
        <br>
        <p><strong>Ваши права:</strong> Вы можете запросить удаление данных, написав <strong>@arbat_support</strong>.</p>
        <br>
        <p>Обработка данных осуществляется в соответствии с Законом Республики Беларусь № 99-З «О защите персональных данных».</p>
      </div>
      <button class="btn btn--secondary btn--full" style="margin-top:16px" onclick="App.closeBottomSheet()">Закрыть</button>
    `);
  }

  /* ─── Контакт поддержки ─── */
  function openSupport() {
    if (state.tgApp) {
      state.tgApp.openTelegramLink(`https://t.me/${VENUE.supportUsername}`);
    } else {
      showToast('Напишите нам: @arbat_support');
    }
  }

  /* ─── Запуск при загрузке DOM ─── */
  document.addEventListener('DOMContentLoaded', init);

  /* ─── Публичный API — методы доступны из HTML через onclick ─── */
  return {
    navigate,
    showToast,
    showBottomSheet,
    closeBottomSheet,
    showPrivacyPolicy,
    openSupport,
    openBannerEvent,
    openEvent,
    showTicketStub,
    filterEvents,
    bookingNextStep,
    bookingGoToStep,
    restoreBookingDraft,
    resetBooking,
    confirmBooking,
    selectGuests,
    submitHallRental,
    cancelBooking,
    _doCancelBooking,
    switchBookingsTab,
  };

})();
