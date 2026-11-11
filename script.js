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

        rates = {//оновлює курси даними з АРІ
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

if (refreshBtn) {//"слухач"події на кнопку оновлення
    refreshBtn.addEventListener('click', loadData);
}

const conversionHistory = []; // масив для збереження записів історії

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

function renderHistory(items) { // функція рендеру історії
    historyList.innerHTML = '';

    items.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = `${item.amount} ${item.from} → ${item.result} ${item.to}`;
        li.dataset.result = item.result;

        if (item.result > 1000) {
            li.classList.add('big-rate');
        }

        historyList.append(li);
    });

    historyCount.textContent = `Кількість збережених операцій: ${items.length}`;
}

// нове - отримує запис від Vue-компонента (подія 'conversion-saved' з js/app.js) і додає його в історію вже наявним кодом (conversionHistory + renderHistory)
document.addEventListener('conversion-saved', (event) => {
    conversionHistory.push(event.detail);
    renderHistory(conversionHistory);
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