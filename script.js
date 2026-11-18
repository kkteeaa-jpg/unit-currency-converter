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

document.addEventListener('conversion-saved', async (event) => {// отримує запис від Vue-компонента (подія 'conversion-saved' з js/app.js) і тепер зберігає його в IndexedDB
    const record = { ...event.detail, timestamp: Date.now() }; // додаємо час для сортування
    try {
        await addItem(record);
        await refreshHistory();// перемальовуємо список із бази
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