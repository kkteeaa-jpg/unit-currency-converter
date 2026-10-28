const rates = {
    USD: 1,
    EUR: 0.92,
    UAH: 41.5
}; // оголошую курс валют

const listContainer = document.querySelector('#rates-list'); // вибір контейнера списку та блоку підсумку в DOM
const countContainer = document.querySelector('#rates-count');

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

renderRates(rates); // виклик функції рендеру

// ==========================================
// Логіка Практикуму 8 (Варіант 6)
// ==========================================

const conversionHistory = []; // масив для збереження записів історії

const form = document.querySelector('#converter-form'); // отримує елементи форми та інтерфейсу DOM
const amountInput = document.querySelector('#input-value');
const sourceUnitSelect = document.querySelector('#source-unit');
const targetUnitSelect = document.querySelector('#target-unit');
const resultOutput = document.querySelector('#result-output');
const swapBtn = document.querySelector('#swap-btn');

const historyList = document.querySelector('#history-list'); // виправлено помилку в id (було #historu-list)
const historyCount = document.querySelector('#history-count');

function calculateConversion() {
    const amount = Number(amountInput.value); // приводить до числа
    const from = sourceUnitSelect.value;
    const to = targetUnitSelect.value;

    // Виправлено: додано фігурні дужки та пробіл
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

function renderHistory(items) { // функція рендеру історії
    historyList.innerHTML = '';

    items.forEach((item) => {
        const li = document.createElement('li');
        // Виправлено: додано закриваючу зворотну лапку перед крапкою з комою
        li.textContent = `${item.amount} ${item.from} → ${item.result} ${item.to}`;
        li.dataset.result = item.result;

        if (item.result > 1000) {
            li.classList.add('big-rate');
        }

        historyList.append(li);
    });

    historyCount.textContent = `Кількість збережених операцій: ${items.length}`;
}

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