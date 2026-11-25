const API_URL = 'https://api.frankfurter.dev/v1/latest?base=USD';

let rates = {//змінено на let, бо значення будуть оновлюватися
    USD: 1,
    EUR: 0.92,
    UAH: 41.5
}; // оголошую курс валют

const listContainer = document.querySelector('#rates-list'); // вибір контейнера списку та блоку підсумку в DOM
const countContainer = document.querySelector('#rates-count');

const loadingIndicator = document.querySelector('#loading-indicator');
const errorMessage = document.querySelector('#error-message');
const refreshBtn = document.querySelector('#refresh-btn');

function showLoading(isLoading) {
    if (loadingIndicator) {
        loadingIndicator.style.display = isLoading ? 'block' : 'none';
    }
    if (refreshBtn) {
        refreshBtn.disabled = isLoading; //блокує кнопку на час запиту
    }
}

function showError(message) {//повідомлення про помилку
    if (!errorMessage) return;
    if (message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    } else {
        errorMessage.textContent = '';
        errorMessage.style.display = 'none';
    }
}

function renderRates(ratesData) { // функція рендеру списку курсів
    listContainer.innerHTML = ''; // очищення перед додаванням

    const entries = Object.entries(ratesData); // отримує масив

    entries.forEach(([currency, rate]) => { // цикл обробки та створення елементів
        const li = document.createElement('li'); // створює li та заповнює текстом
        li.textContent = `${currency}: ${rate}`;

        li.dataset.rate = rate; // створює атрибут data-rate
        
        const threshold = 10; // поріг для валюти з великим курсом
        if (rate > threshold) {
            li.classList.add('big-rate');
        }

        listContainer.append(li); // додаємо li у список ul
    });

    countContainer.textContent = `Кількість валют у списку: ${entries.length}`; // оновлюємо кількість валют
}

async function loadUahRate() {//отримує актуальний курс гривні (скільки UAH за 1 USD) і підставляє у rates замість стартового значення
    try {
        const usdRates = await fetchDayRates('latest', 'USD');
        if (usdRates.uah) {
            rates.UAH = Number(usdRates.uah.toFixed(4));
        }
    } catch (error) {//якщо не вийшло - лишається стартовий курс із rates, застосунок працює далі
        console.error('Не вдалося отримати курс UAH, використано стартовий:', error);
    }
}

async function loadData() {//головна асинхронна функція запиту до АРІ
    showLoading(true);//Показує статус завантаження
    showError('');//скидає старі помилки

    try {
        const response = await fetch(API_URL);//відправляє запит до сервера
        
        if (response.status === 422) {//перевірка коду 422
            throw new Error('Перевірте код валюти');
        }

        if (!response.ok) {//перевірка на інші помилки
            throw new Error(`Код ${response.status}`);
        }

        const data = await response.json();//розбиває отримане тіло відповіді як JSON

        rates = {//оновлює курси даними з АРІ, але зберігає старі (UAH немає в API)
            ...rates,
            [data.base]: 1,
            ...data.rates
        };

         await loadUahRate();//Frankfurter не має гривні - беремо актуальний курс UAH з іншого API

         renderRates(rates);//передає нові дані у функцію рендеру списку

         // calculateConversion() замінено подією. Vue-компонент (js/app.js) чує 'rates-loaded' і сам перераховує результат за новими курсами
         // calculateConversion();//оновлює підсумок у формі конвертера за новим куросм
         document.dispatchEvent(new CustomEvent('rates-loaded', { detail: rates }));

    } catch (error) {//обробка помилок мережі та винятків throw
        if (error.message === 'Перевірте код валюти') {
            showError('Перевірте код валюти');
        } else {
            showError('Не вдалося завантажити дані. Спробуйте пізніше.');
        }
        console.error('Помилка запиту:', error);
    } finally {
        showLoading(false);//приховує статус завантаження
    }
}

loadData();//автоматичний запуск при відкритті сторінки

if (refreshBtn) {//"слухач" події на кнопку оновлення
    refreshBtn.addEventListener('click', loadData);
}

const LS_KEY = 'conversionHistory';
const LS_MIGRATED_KEY = 'migrated';
const dbErrorBox = document.querySelector('#db-error');

function showDbError(message) {//повідомлення про недоступність бази
    if (!dbErrorBox) return;
    dbErrorBox.textContent = message;
    dbErrorBox.style.display = message ? 'block' : 'none';
}

function saveToLocalStorage(items) {//localStorage (синхронне сховище "ключ - рядок")
    localStorage.setItem(LS_KEY, JSON.stringify(items));// масив у JSON-рядок 
}

function loadFromLocalStorage() {// JSON-рядок у масив
    try {
        const raw = localStorage.getItem(LS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (error) {// пошкоджені дані не повинні ламати застосунок
        console.error('Пошкоджені дані в localStorage:', error);
        return [];
    }
}

const DB_NAME = 'ConverterDB';//IndexedDB (асинхронна база, працює через транзакції)
const DB_VERSION = 1;
const STORE_NAME = 'history';
let dbPromise = null;

function openDB() {// відкриває базу; object store створюється лише в onupgradeneeded
    if (dbPromise) return dbPromise;// повторно базу не відкриваємо
    dbPromise = new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) {
            reject(new Error('IndexedDB не підтримується'));
            return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    }).catch((error) => {
        dbPromise = null;// дозволяє спробувати відкрити базу ще раз
        throw error;
    });
    return dbPromise;
}

async function addItem(item) {// додає запис (або оновлює, якщо id вже існує), повертає id
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const request = tx.objectStore(STORE_NAME).put(item);
        let newId;
        request.onsuccess = () => { newId = request.result; };
        tx.oncomplete = () => resolve(newId);
        tx.onerror = () => reject(tx.error);
    });
}

async function getAllItems() {// повертає всі записи зі сховища
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function deleteItem(id) {// видаляє запис за id
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function migrateFromLocalStorage() {// одноразова міграція: якщо база порожня, а в localStorage є дані - переносимо їх
    if (localStorage.getItem(LS_MIGRATED_KEY) === 'true') return; // вже переносили

    const existing = await getAllItems();
    const oldItems = loadFromLocalStorage();

    if (existing.length === 0 && oldItems.length > 0) {
        for (const old of oldItems) {
            const { id, ...rest } = old;// новий id видасть autoIncrement
            await addItem({ ...rest, timestamp: rest.timestamp ?? Date.now() });
        }
        console.log(`Міграція: перенесено записів - ${oldItems.length}`);
    }
    localStorage.setItem(LS_MIGRATED_KEY, 'true');// прапорець проти повторної міграції
}

async function refreshHistory() {// читає всю історію з бази, сортує за timestamp і малює останні 10
    try {
        const all = await getAllItems();
        const last10 = all.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
        renderHistory(last10, all.length);
        drawHistoryChart(last10);//графік результатів тих самих 10 записів з IndexedDB
    } catch (error) {
        console.error('Помилка читання історії:', error);
        showDbError('Не вдалося прочитати історію з бази даних.');
    }
}

/* ручний код форми конвертера (пошук елементів, calculateConversion, слухачі input/change/click)
   замінено Vue-компонентом ConverterForm у js/app.js. Тепер стан зберігає Vue, а результат - computed-значення
   код залишено закоментованим, щоб він не дублювався з компонентом

const form = document.querySelector('#converter-form'); // отримує елементи форми та інтерфейсу DOM
const amountInput = document.querySelector('#input-value');
const sourceUnitSelect = document.querySelector('#source-unit');
const targetUnitSelect = document.querySelector('#target-unit');
const resultOutput = document.querySelector('#result-output');
const swapBtn = document.querySelector('#swap-btn');
*/

const historyList = document.querySelector('#history-list');
const historyCount = document.querySelector('#history-count');

/* замінено на computed result() у компоненті ConverterForm (js/app.js).
function calculateConversion() {
    const amount = Number(amountInput.value); // приводить до числа
    const from = sourceUnitSelect.value;
    const to = targetUnitSelect.value;

    if (!amount || amount <= 0) {
        resultOutput.textContent = '0.00 ' + to;
        return 0;
    }

    const amountInUSD = amount / rates[from]; // спочатку приводимо у долар, потім у цільову валюту
    const convertedAmount = amountInUSD * rates[to];
    const finalResult = Number(convertedAmount.toFixed(2));

    resultOutput.textContent = `${finalResult} ${to}`; // оновлення результату
    return finalResult;
}

amountInput.addEventListener('input', () => { // додаткова валідація на подію 'input'
    const value = Number(amountInput.value);

    if (amountInput.value !== '' && value <= 0) { // якщо введено 0 або від'ємне число - підказка браузера
        amountInput.setCustomValidity('Сума має бути додатною');
    } else {
        amountInput.setCustomValidity(''); // очищення стану помилки
    }

    calculateConversion();
});

sourceUnitSelect.addEventListener('change', calculateConversion); // 'change' на селектах одиниць (миттєвий перерахунок)
targetUnitSelect.addEventListener('change', calculateConversion);

if (swapBtn) { // обробник кнопки швидкого обміну валют місцями
    swapBtn.addEventListener('click', () => {
        const temp = sourceUnitSelect.value;
        sourceUnitSelect.value = targetUnitSelect.value;
        targetUnitSelect.value = temp;
        calculateConversion();
    });
}
*/

function renderHistory(items, total = items.length) { // функція рендеру історії (total - усього записів у базі)
    historyList.innerHTML = '';

    items.forEach((item) => {
        const li = document.createElement('li');
        const time = new Date(item.timestamp).toLocaleString('uk-UA');// час конвертації
        li.textContent = `${item.amount} ${item.from} → ${item.result} ${item.to} (${time})`;
        li.dataset.result = item.result;

        if (item.result > 1000) {
            li.classList.add('big-rate');
        }

        historyList.append(li);
    });

    historyCount.textContent = `Кількість збережених операцій: ${total} (показано останні ${items.length})`;
}

//два графіки на Canvas - 1-ий  результати останніх конвертацій з IndexedDB, 2-ий курс вибраної пари валют за останні дні (API)
function createChart(selector) {//обгортка над полотном: окремі контекст і id анімації, щоб два графіки не заважали один одному
    const canvas = document.querySelector(selector);
    return { canvas, ctx: canvas ? canvas.getContext('2d') : null, animationId: null };
}

const historyChart = createChart('#history-chart');//графік 1: історія конвертацій (практикум 11)
const rateChart = createChart('#rate-chart');//графік 2: курс пари за останні дні (практикум 9)
const chartTitle = document.querySelector('#chart-title');//підпис над графіком курсу
const CHART_PAD = { top: 20, right: 20, bottom: 30, left: 65 };//відступи для осей і підписів
const CHART_ANIMATION_MS = 800;//тривалість «домальовування» лінії
const CHART_COLOR = '#0369a1';
const CHART_DAYS = 10;//скільки останніх днів показувати на графіку курсу
const RATE_SOURCES = [//основне джерело (jsDelivr) і запасне (Cloudflare Pages): ті самі дані, різні сервери
    (date, code) => `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/${code}.json`,
    (date, code) => `https://${date}.currency-api.pages.dev/v1/currencies/${code}.json`
];
let chartRequestId = 0;//номер запиту: відкидає застарілі відповіді, якщо пару змінили під час завантаження
const ratesCache = new Map();//кеш: 'дата/валюта' -> курси, щоб не робити повторних запитів

function chartPoints(chart, values) {//переводить значення у координати на полотні
    const w = chart.canvas.width - CHART_PAD.left - CHART_PAD.right;
    const h = chart.canvas.height - CHART_PAD.top - CHART_PAD.bottom;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;//якщо всі значення однакові - уникаємо ділення на 0
    return values.map((v, i) => ({
        x: CHART_PAD.left + (values.length === 1 ? w / 2 : (i / (values.length - 1)) * w),
        y: CHART_PAD.top + h - ((v - min) / range) * h
    }));
}

function drawChartFrame(chart, values, labels, progress, options) {//малює один кадр; progress 0..1 - яка частина лінії вже видима
    const { ctx } = chart;
    const { width, height } = chart.canvas;
    ctx.clearRect(0, 0, width, height);//обов'язково очищаємо попередній кадр

    ctx.strokeStyle = '#999';//осі
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(CHART_PAD.left, CHART_PAD.top);
    ctx.lineTo(CHART_PAD.left, height - CHART_PAD.bottom);
    ctx.lineTo(width - CHART_PAD.right, height - CHART_PAD.bottom);
    ctx.stroke();

    const pts = chartPoints(chart, values);

    ctx.fillStyle = '#555';//підписи мінімуму і максимуму (вісь Y)
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.max(...values).toFixed(options.decimals), CHART_PAD.left - 6, CHART_PAD.top + 4);
    ctx.fillText(Math.min(...values).toFixed(options.decimals), CHART_PAD.left - 6, height - CHART_PAD.bottom);

    if (options.allLabels) {//підпис під кожною точкою (графік історії: валюта результату)
        ctx.textAlign = 'center';
        pts.forEach((p, i) => ctx.fillText(labels[i], p.x, height - 8));
    } else {//лише перша й остання дата (графік курсу)
        ctx.textAlign = 'left';
        ctx.fillText(labels[0], CHART_PAD.left, height - 8);
        ctx.textAlign = 'right';
        ctx.fillText(labels[labels.length - 1], width - CHART_PAD.right, height - 8);
    }

    const drawn = progress * (pts.length - 1);//скільки сегментів лінії вже показано

    ctx.strokeStyle = CHART_COLOR;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
        if (i <= drawn) {
            ctx.lineTo(pts[i].x, pts[i].y);
        } else {
            const t = drawn - (i - 1);//частина останнього, ще не добудованого сегмента
            if (t > 0) {
                ctx.lineTo(
                    pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
                    pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t
                );
            }
            break;
        }
    }
    ctx.stroke();

    ctx.fillStyle = CHART_COLOR;//точки з'являються разом із лінією
    pts.forEach((p, i) => {
        if (i <= drawn) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    });
}

function drawChartMessage(chart, text) {//текст на полотні замість графіка (завантаження, помилка, порожня історія)
    cancelAnimationFrame(chart.animationId);
    chart.ctx.clearRect(0, 0, chart.canvas.width, chart.canvas.height);
    chart.ctx.fillStyle = '#777';
    chart.ctx.font = '14px sans-serif';
    chart.ctx.textAlign = 'center';
    chart.ctx.fillText(text, chart.canvas.width / 2, chart.canvas.height / 2);
}

function animateChart(chart, values, labels, options) {//цикл анімації через requestAnimationFrame
    cancelAnimationFrame(chart.animationId);//зупиняємо попередню анімацію цього графіка, якщо вона ще йшла
    let start = null;
    function step(timestamp) {
        if (start === null) start = timestamp;
        const progress = Math.min((timestamp - start) / CHART_ANIMATION_MS, 1);
        drawChartFrame(chart, values, labels, progress, options);
        if (progress < 1) {
            chart.animationId = requestAnimationFrame(step);//цикл зупиняється сам, коли лінію добудовано
        }
    }
    chart.animationId = requestAnimationFrame(step);
}

function drawHistoryChart(items) {//графік 1: результати останніх конвертацій (items - новіші першими, як у refreshHistory)
    if (!historyChart.ctx) return;
    if (items.length === 0) {
        drawChartMessage(historyChart, 'Поки немає історії конвертацій');
        return;
    }
    const ordered = [...items].reverse();//від старих до нових, зліва направо
    animateChart(
        historyChart,
        ordered.map((item) => item.result),
        ordered.map((item) => item.to),//під точкою - валюта, у якій отримано результат
        { decimals: 2, allLabels: true }
    );
}

function formatIsoDate(date) {//Date -> 'рррр-мм-дд', як вимагає API
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${m}-${d}`;
}

async function fetchDayRates(date, from) {//усі курси однієї валюти за конкретну дату, наприклад { uah: 41.5, eur: 0.9, ... }
    const key = `${date}/${from}`;
    if (date !== 'latest' && ratesCache.has(key)) return ratesCache.get(key);//'latest' не кешуємо, щоб кнопка «Оновити курс» брала свіже значення

    for (const makeUrl of RATE_SOURCES) {//спочатку основне джерело, якщо не вийшло - запасне
        try {
            const response = await fetch(makeUrl(date, from.toLowerCase()));
            if (!response.ok) continue;
            const data = await response.json();
            const rates = data[from.toLowerCase()];//відповідь: { date: '...', usd: { eur: 0.9, uah: 41.5, ... } }
            if (date !== 'latest') ratesCache.set(key, rates);
            return rates;
        } catch (error) {
            //мережева помилка - пробуємо наступне джерело
        }
    }
    throw new Error(`Немає даних за ${date}`);
}

async function loadRateChart(from, to) {//графік 2: курс «з валюти» -> «в валюту» за останні дні
    if (!rateChart.ctx) return;
    const requestId = ++chartRequestId;
    if (chartTitle) chartTitle.textContent = `Курс ${from} → ${to} за останні ${CHART_DAYS} днів`;

    if (from === to) {
        drawChartMessage(rateChart, 'Оберіть різні валюти');
        return;
    }
    drawChartMessage(rateChart, 'Завантаження курсу...');

    try {
        const dates = [];//останні CHART_DAYS днів, закінчуючи вчорашнім (за сьогодні дані можуть ще не з'явитися)
        for (let i = CHART_DAYS; i >= 1; i--) {
            const day = new Date();
            day.setDate(day.getDate() - i);
            dates.push(formatIsoDate(day));
        }

        const results = await Promise.allSettled(dates.map((date) => fetchDayRates(date, from)));//окремий запит на кожен день
        if (requestId !== chartRequestId) return;//пару вже змінили - ця відповідь застаріла

        const points = [];
        results.forEach((result, i) => {
            const rate = result.status === 'fulfilled' ? result.value[to.toLowerCase()] : undefined;
            if (rate) {//дні без даних просто пропускаємо
                points.push({ date: dates[i], rate });
            }
        });

        if (points.length < 2) throw new Error('Замало даних за період');
        animateChart(
            rateChart,
            points.map((p) => p.rate),
            points.map((p) => `${p.date.slice(8)}.${p.date.slice(5, 7)}`),//підпис осі X: дд.мм
            { decimals: 4, allLabels: false }
        );
    } catch (error) {
        if (requestId !== chartRequestId) return;
        console.error('Помилка завантаження курсу для графіка:', error);
        drawChartMessage(rateChart, 'Не вдалося завантажити курс');
    }
}

document.addEventListener('pair-changed', (event) => {//користувач змінив пару валют у формі (подія з js/app.js)
    loadRateChart(event.detail.from, event.detail.to);
});

document.addEventListener('DOMContentLoaded', () => {//початковий графік курсу для пари, обраної у формі після завантаження
    const fromSelect = document.querySelector('#source-unit');
    const toSelect = document.querySelector('#target-unit');
    if (fromSelect && toSelect) {
        loadRateChart(fromSelect.value, toSelect.value);
    }
});

document.addEventListener('conversion-saved', async (event) => {// отримує запис від Vue-компонента (подія 'conversion-saved' з js/app.js) і тепер зберігає його в IndexedDB
    const record = { ...event.detail, timestamp: Date.now() }; // додаємо час для сортування
    try {
        await addItem(record);
        await refreshHistory();// перемальовуємо список із бази
        loadRateChart(record.from, record.to);//після збереження графік курсу цієї пари анімується заново
    } catch (error) {
        console.error('Помилка збереження:', error);
        showDbError('IndexedDB недоступна (можливо, приватний режим). Історія не зберігається.');
    }
});

document.addEventListener('DOMContentLoaded', async () => {// при завантаженні сторінки: відкриваємо базу, переносимо старі дані, показуємо історію
    try {
        await openDB();
        await migrateFromLocalStorage();
        await refreshHistory();
    } catch (error) {
        console.error('Не вдалося відкрити IndexedDB:', error);
        showDbError('IndexedDB недоступна (можливо, приватний режим). Історія не зберігається.');
    }
});

/* старий обробник submit замінено компонентом (форму, reset і підрахунок тепер веде Vue).
form.addEventListener('submit', (event) => { // обробник події submit форми
    event.preventDefault(); // скасовує перезавантаження сторінки

    const amount = Number(amountInput.value);
    const from = sourceUnitSelect.value;
    const to = targetUnitSelect.value;
    const result = calculateConversion();

    const record = { // створює об'єкт та додає в масив через push
        amount,
        from,
        to,
        result
    };
    conversionHistory.push(record);

    renderHistory(conversionHistory); // повторний виклик рендеру

    form.reset(); // очищення полів форми
    resultOutput.textContent = '0.00 ' + targetUnitSelect.value;
});
*/