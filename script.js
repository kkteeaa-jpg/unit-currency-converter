const rates = {
    USD: 1,
    EUR: 0.92,
    UAH: 41.5
}; //оголошую курс валют

const listContainer = document.querySelector('#rates-list');//вибір контейнера списку та блоку підсумку в DOM
const countContainer = document.querySelector('#rates-count');

function renderRates(ratesData) {//функція рендеру списку курсів
    listContainer.innerHTML = '';//очищення перед додаванням

    const entries = Object.entries(ratesData);//отримує масив

    entries.forEach (([currency, rate]) => {//цикл обробки та створення елементів
        const li = document.createElement('li');//створює li та заповнює текстом
        li.textContent = `${currency}: ${rate}`;

        li.dataset.rate = rate;//створює атрибут data-rate
        
        const threshold = 10; //поріг для валюти з великим курсом
        if (rate > threshold) {
            li.classList.add('big-rate');
        }

        listContainer.append(li);//додаємо li у список ul
    });

    countContainer.textContent = `Кількість валют у списку: ${entries.length}`;//оновлюємо кількість валют
}

renderRates(rates);//виклик функції рендеру

console.log('Список курсів валют');
for (const key of Object.keys(rates)) {
    console.log(`Валюта: ${key}, курс: ${rates[key]}`);
}//цикл для виведення всіх курсів у консоль

const convert = (amount, rate) => amount * rate; //приймаю суму та курс і повертаю пораховане значення

const result = convert(100, rates.UAH); //виклик із реальними даними, конвертую 100$ в грн
console.log(`Результат конвертації: ${result} UAH`);

if (result > 1000) { //перевірка if ... else чи велика сума вийшла чи нормальна
    console.log('Велика сума');
} else {
    console.log('Нормальна сума');
}