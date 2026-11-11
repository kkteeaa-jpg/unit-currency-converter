//обрано фреймворк Vue 3 (підключений через CDN), Vue працює зі звичайним HTML-шаблоном без JSX і без Babel, тому його найпростіше додати до вже готового проєкту на чистому HTML/JS
//компонент ConverterForm: форма конвертера з власним реактивним станом
const ConverterForm = {
    props: ['rates'],//курси валют приходять ЗВЕРХУ через props - компонент не звертається до глобальних змінних

    emits: ['save'],//подія, яку компонент повідомляє батьківському застосунку

    data() {//власний реактивний стан компонента (замість querySelector і .value)
        return {
            amount: '',
            fromUnit: 'USD',
            toUnit: 'UAH',
            units: [//список валют для <select>, рендериться циклом v-for
                { code: 'USD', title: 'USD (Долар США)' },
                { code: 'EUR', title: 'EUR (Євро)' },
                { code: 'UAH', title: 'UAH (Гривня)' }
            ]
        };
    },

    computed: {//похідне значення: Vue САМ перераховує його, коли змінюється amount, fromUnit, toUnit або rates
        result() {
            const amount = Number(this.amount);//приводить до числа
            if (!amount || amount <= 0) {//та сама перевірка, що була в calculateConversion()
                return 0;
            }
            const amountInUSD = amount / this.rates[this.fromUnit];//спочатку у долар, потім у цільову валюту
            const converted = amountInUSD * this.rates[this.toUnit];
            return Number(converted.toFixed(2));
        }
    },

    methods: {
        swap() {//обмін валют місцями: достатньо змінити стан, інтерфейс оновиться сам
            const temp = this.fromUnit;
            this.fromUnit = this.toUnit;
            this.toUnit = temp;
        },
        save() {//повідомляє батьківському застосунку, що запис треба додати в історію
            this.$emit('save', {
                amount: Number(this.amount),
                from: this.fromUnit,
                to: this.toUnit,
                result: this.result
            });
            this.amount = '';//очищення поля (раніше це робив form.reset())
        }
    },

    //розмітка форми перенесена з index.html. v-model зв'язує поле зі станом, {{ }} виводить значення, @click і @submit - обробники подій. Кнопки «Порахувати» нема
    template: `
        <form id="converter-form" @submit.prevent="save">
            <div>
                <label for="input-value">Значення для конвертації:</label>
                <input type="number" id="input-value" name="inputValue" placeholder="Введіть число"
                       min="0.01" step="any" required v-model.number="amount">
            </div>

            <div class="units-wrapper">
                <div class="unit-field">
                    <label for="source-unit">Початкова одиниця:</label>
                    <select id="source-unit" name="sourceUnit" v-model="fromUnit">
                        <option v-for="unit in units" :key="unit.code" :value="unit.code">{{ unit.title }}</option>
                    </select>
                </div>

                <button type="button" id="swap-btn" title="Поміняти місцями"
                        aria-label="Поміняти одиниці місцями" @click="swap">&#8646;</button>

                <div class="unit-field">
                    <label for="target-unit">Кінцева одиниця:</label>
                    <select id="target-unit" name="targetUnit" v-model="toUnit">
                        <option v-for="unit in units" :key="unit.code" :value="unit.code">{{ unit.title }}</option>
                    </select>
                </div>
            </div>

            <button type="submit" id="convert-btn">Зберегти в історію</button>

            <div>
                <label for="result-output">Результат конвертації:</label>
                <output id="result-output" for="input-value source-unit target-unit">{{ result.toFixed(2) }} {{ toUnit }}</output>
            </div>
        </form>`
};

//кореневий застосунок зберігає курси валют і передає їх у компонент
Vue.createApp({
    components: { ConverterForm },

    data() {
        return {
            rates: { USD: 1, EUR: 0.92, UAH: 41.5 }//стартові курси, поки не завантажились дані з API
        };
    },

    methods: {
        onSave(record) {//отримує запис від компонента й передає його коду історії у script.js
            document.dispatchEvent(new CustomEvent('conversion-saved', { detail: record }));
        }
    },

    mounted() {//script.js завантажує курси з API й повідомляє про це подією 'rates-loaded'
        document.addEventListener('rates-loaded', (event) => {
            this.rates = event.detail;//нове значення стану - результат у формі перерахується сам
        });
    }
}).mount('#app');