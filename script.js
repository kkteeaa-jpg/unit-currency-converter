const rates = {
    USD: 1,
    EUR: 0.92,
    UAH: 41.5
}; //оголошую курс валют

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