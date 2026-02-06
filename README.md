# KotvukAI

Крипто-аналитика с AI Графики, сигналы, paper trading, алерты — всё в одном месте.

## Стек

Frontend — React 18 + Vite 5, графики на Lightweight Charts (TradingView open-source), анимации Framer Motion.
Backend — Node.js + Express, база PostgreSQL через Neon.tech.
AI — Groq API, сейчас используются Kimi K2, DeepSeek R1 и Qwen 3 32B. 15 ключей с ротацией, чтобы не упираться в rate limits.
Реалтайм цены через WebSocket (Binance Stream).

Авторизация на JWT (access + refresh), пароли bcrypt, есть 2FA.

## Запуск

```
cd backend && npm i && node server.js
```

Фронт:
```
cd frontend && npm i && npm run dev
```

Нужен `.env` — скопируй `.env.example`, там всё расписано. Основное: DATABASE_URL для Neon, JWT_SECRET (подлиннее), ключи Groq.

Фронт будет на `http://localhost:5173`, бэк на `http://localhost:3000`.

> У меня локально работает с Node 20, на 18 не проверял. npm 9+.

## Что умеет

- **Dashboard** — live цены через вебсокет, Fear & Greed индекс, AI рекомендация дня
- **Графики** — свечи, 7 таймфреймов, можно рисовать линии и фибоначчи. Рисунки сохраняются в localStorage
- **AI анализ** — мультитаймфреймовый анализ по 40+ парам, парсит RSI/EMA/MACD по каждому TF и отправляет в Groq. Есть self-learning — система запоминает прошлые сигналы и их результаты
- **AI чат** — можно просто поболтать с AI про рынок
- **Paper trading** — виртуальные сделки long/short с TP/SL, считает PnL, есть статистика
- **Алерты** — ценовые уведомления со звуком (Web Audio API)
- **Скринер** — таблица 50+ пар с сортировкой и спарклайнами
- **Heatmap** — тепловая карта рынка
- **Whale panel** — стакан и крупные сделки (>$100k)
- **Новости** — лента CryptoCompare + AI саммари
- **Бэктестинг** — несколько стратегий, оптимизация параметров
- **Торговые боты** — paper trading боты с разными стратегиями

Ещё есть PWA (работает оффлайн, можно на домашний экран), экспорт в PDF, push-уведомления, sentiment анализ, admin панель.

## AI модели

Три группы по 5 ключей:
- Kimi K2 — для глубокого анализа и бэктестинга
- Llama 4 Maverick — reasoning, стратегии
- Qwen 3 32B — быстрые сигналы и чат

Ключи крутятся round-robin. Если один ключ словил 429 — переключается на следующий. В сумме ~450 запросов/мин хватает с запасом.

## Индикаторы

Все написаны с нуля (EMA, RSI по Wilder, MACD, Bollinger Bands) — без внешних библиотек. Работают и на бэке (для AI анализа) и на фронте (для отрисовки на графиках).

## Тесты

```
cd backend && npm test
cd frontend && npm test
```

Бэкенд на Jest + Supertest, фронт на Vitest. Подробнее в TEST_REPORT.md.

## Деплой

Есть конфиги для Kubernetes (`infra/k8s/`), CI/CD через GitHub Actions — lint, тесты, build, Snyk.

TODO: нормально настроить мониторинг (Prometheus + Grafana конфиги есть, но не до конца доделаны)

## Структура

Бэкенд разбит на routes/services/utils. `server.js` поднимает HTTP, `app.js` — конфигурация Express с миддлварами. Тесты импортируют `app.js` напрямую без поднятия сервера.

Фронт — React контексты (Theme, Lang, Auth), роутинг без react-router (самописный через state), 15+ панелей.

## Лицензия

Apache 2.0 — см. файл LICENSE
