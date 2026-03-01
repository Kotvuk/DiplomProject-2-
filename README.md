# KotvukAI

Делал для себя чтобы не переключаться между 10 вкладками когда торгую. Постепенно оброс фичами.

## Стек

Frontend — React 18 + Vite, графики через Lightweight Charts от TradingView.
Backend — Node.js + Express, PostgreSQL на Neon.tech.
AI — Groq API: Kimi K2, Llama 4 Maverick, Qwen 3 32B. 15 ключей с round-robin ротацией.
Цены в реалтайме через WebSocket от Binance.

JWT авторизация (access + refresh), bcrypt, есть 2FA.

## Запуск

```
cd backend && npm i && node server.js
```

```
cd frontend && npm i && npm run dev
```

Нужен `.env` — скопируй `.env.example`. Главное: `DATABASE_URL`, `JWT_SECRET`, ключи Groq.

Фронт на `localhost:5173`, бэк на `localhost:3000`. Проверял на Node 20.

## Что внутри

- Dashboard — live цены, Fear & Greed, AI рекомендация дня
- Графики — свечи, 7 таймфреймов, рисование линий и фибоначчи (сохраняется в localStorage)
- AI анализ — мультитаймфреймовый по 40+ парам, RSI/EMA/MACD по каждому TF, self-learning на истории сигналов
- AI чат — просто поболтать про рынок
- Paper trading — виртуальные long/short с TP/SL, PnL, статистика
- Алерты — ценовые уведомления со звуком
- Скринер — 50+ пар с сортировкой и спарклайнами
- Whale panel — стакан и крупные сделки
- Новости + AI саммари
- Бэктестинг и торговые боты
- Admin панель, PWA, экспорт PDF

## AI модели 🤖

- Kimi K2 — глубокий анализ, бэктестинг
- Llama 4 Maverick — reasoning, стратегии
- Qwen 3 32B — быстрые сигналы, чат

Если ключ поймал 429 — автоматически переключается на следующий.

## Индикаторы

Написал сам — EMA, RSI (по Wilder), MACD, Bollinger Bands. Без внешних библиотек. Работают и на бэке (для AI) и на фронте (для графиков).

## Тесты

```
cd backend && npm test
cd frontend && npm test
```

Jest + Supertest на бэке, Vitest на фронте.

## Деплой

K8s конфиги в `infra/k8s/`, CI/CD через GitHub Actions.

## Структура

Бэк: routes / services / utils. `server.js` поднимает сервер, `app.js` — Express с миддлварами.
Фронт: контексты (Theme, Lang, Auth), самописный роутинг через state, 15+ панелей.

## Лицензия

Apache 2.0

---

TODO: нормально настроить мониторинг, пока руки не дошли. Prometheus + Grafana конфиги есть, но не до конца.
