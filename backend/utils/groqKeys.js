const MODEL_GROUPS = {
  kimi: {
    model: 'moonshotai/kimi-k2-instruct-0905',
    name: 'Kimi K2',
    description: '1T параметров MoE, лучший для глубокого анализа',
    keys: [
      process.env.GROQ_KEY_KIMI_1,
      process.env.GROQ_KEY_KIMI_2,
      process.env.GROQ_KEY_KIMI_3,
      process.env.GROQ_KEY_KIMI_4,
      process.env.GROQ_KEY_KIMI_5,
    ].filter(Boolean),
    config: {
      maxTokens: 8000,
      temperature: 0.6,
      useCase: 'Глубокий анализ, backtesting, длинный контекст'
    }
  },
  deepseek: {
    model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
    name: 'Llama 4 Maverick',
    description: '17B MoE (128 экспертов), 1M контекст, лучший для reasoning',
    keys: [
      process.env.GROQ_KEY_LLAMA_1,
      process.env.GROQ_KEY_LLAMA_2,
      process.env.GROQ_KEY_LLAMA_3,
      process.env.GROQ_KEY_LLAMA_4,
      process.env.GROQ_KEY_LLAMA_5,
    ].filter(Boolean),
    config: {
      maxTokens: 4000,
      temperature: 0.7,
      useCase: 'Reasoning, стратегии, самоанализ ботов'
    }
  },
  qwen: {
    model: 'qwen/qwen3-32b',
    name: 'Qwen 3 32B',
    description: '32B параметров, 128K контекст, очень быстрый',
    keys: [
      process.env.GROQ_KEY_QWEN_1,
      process.env.GROQ_KEY_QWEN_2,
      process.env.GROQ_KEY_QWEN_3,
      process.env.GROQ_KEY_QWEN_4,
      process.env.GROQ_KEY_QWEN_5,
    ].filter(Boolean),
    config: {
      maxTokens: 4000,
      temperature: 0.5,
      useCase: 'Быстрые сигналы, мульти-таймфрейм анализ'
    }
  }
};

const keyIndexes = {
  kimi: 0,
  deepseek: 0,
  qwen: 0
};

const stats = {
  totalRequests: 0,
  byModel: {
    kimi: { requests: 0, errors: 0, avgLatency: 0 },
    deepseek: { requests: 0, errors: 0, avgLatency: 0 },
    qwen: { requests: 0, errors: 0, avgLatency: 0 }
  },
  rateLimitsHit: 0,
  fallbacks: 0
};

const FALLBACK_ORDER = ['kimi', 'deepseek', 'qwen'];
let currentFallbackIndex = 0;

function getConfigForGroup(groupName) {
  const group = MODEL_GROUPS[groupName];
  if (!group || group.keys.length === 0) {
    return null;
  }

  const index = keyIndexes[groupName];
  const key = group.keys[index];

  keyIndexes[groupName] = (index + 1) % group.keys.length;

  return {
    key,
    model: group.model,
    group,
    groupName
  };
}

function getNextConfig() {

  for (const name of FALLBACK_ORDER) {
    const config = getConfigForGroup(name);
    if (config) return config;
  }

  for (const name of Object.keys(MODEL_GROUPS)) {
    const group = MODEL_GROUPS[name];
    if (group.keys.length > 0) {
      return getConfigForGroup(name);
    }
  }

  return {
    key: process.env.GROQ_API_KEY || '',
    model: 'llama-3.3-70b-versatile',
    group: null,
    groupName: 'fallback'
  };
}

function handleRateLimit(currentGroup) {
  stats.rateLimitsHit++;
  stats.byModel[currentGroup].errors++;

  const currentIndex = FALLBACK_ORDER.indexOf(currentGroup);
  for (let i = 1; i < FALLBACK_ORDER.length; i++) {
    const nextIndex = (currentIndex + i) % FALLBACK_ORDER.length;
    const nextGroup = FALLBACK_ORDER[nextIndex];
    if (MODEL_GROUPS[nextGroup].keys.length > 0) {
      currentFallbackIndex = nextIndex;
      stats.fallbacks++;
      console.warn(`[Groq] Rate limit on ${currentGroup}, switching to ${nextGroup}`);
      return nextGroup;
    }
  }

  return null;
}

function updateStats(groupName, latency, success) {
  stats.totalRequests++;
  const modelStats = stats.byModel[groupName];
  if (modelStats) {
    modelStats.requests++;
    if (!success) modelStats.errors++;

    modelStats.avgLatency = modelStats.avgLatency
      ? (modelStats.avgLatency * 0.9 + latency * 0.1)
      : latency;
  }
}

async function makeGroqRequest(key, model, messages, options = {}) {
  const {
    temperature = 0.7,
    maxTokens = 2000,
    stream = false
  } = options;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream
    })
  });

  const data = await response.json();

  if (data.error) {
    var error = new Error(data.error.message);
    error.status = response.status;
    error.code = data.error.code;
    throw error;
  }

  return data;
}

async function groqRequestWithFallback(preferredGroup, messages, options = {}) {
  const tried = new Set();
  let currentGroup = preferredGroup;

  while (tried.size < FALLBACK_ORDER.length) {
    tried.add(currentGroup);

    const config = getConfigForGroup(currentGroup);
    if (!config) {
      currentGroup = handleRateLimit(currentGroup) || 'qwen';
      continue;
    }

    const startTime = Date.now();

    try {
      const result = await makeGroqRequest(
        config.key,
        config.model,
        messages,
        {
          temperature: options.temperature || config.group?.config?.temperature || 0.7,
          maxTokens: options.maxTokens || config.group?.config?.maxTokens || 2000,
          stream: options.stream || false
        }
      );

      updateStats(currentGroup, Date.now() - startTime, true);
      return {
        ...result,
        _meta: {
          model: config.model,
          group: currentGroup,
          latency: Date.now() - startTime
        }
      };

    } catch (error) {
      updateStats(currentGroup, Date.now() - startTime, false);

      if (error.status === 429 || error.code === 'rate_limit_exceeded') {
        const nextGroup = handleRateLimit(currentGroup);
        if (nextGroup) {
          currentGroup = nextGroup;
          continue;
        }
      }

      throw error;
    }
  }

  throw new Error('All Groq model groups exhausted (rate limits on all models)');
}

async function deepAnalysis(symbol, marketData, systemPrompt) {
  const messages = [
    {
      role: 'system',
      content: systemPrompt || 'Ты — профессиональный крипто-аналитик с системой самообучения. Проводи глубокий многогранный анализ. Отвечай подробно на русском языке с markdown форматированием.'
    },
    {
      role: 'user',
      content: `Проведи глубокий анализ ${symbol}.\n\nДанные рынка: ${JSON.stringify(marketData, null, 2)}`
    }
  ];

  return groqRequestWithFallback('kimi', messages, {
    maxTokens: 8000,
    temperature: 0.6
  });
}

async function reasoningAnalysis(prompt, context = {}) {
  const messages = [
    {
      role: 'system',
      content: 'Ты — AI аналитик торговых стратегий. Используй логическое мышление для анализа стратегий и принятия решений. Показывай ход мыслей. Отвечай на русском языке.'
    },
    {
      role: 'user',
      content: `${prompt}\n\nКонтекст: ${JSON.stringify(context, null, 2)}`
    }
  ];

  return groqRequestWithFallback('deepseek', messages, {
    maxTokens: 4000,
    temperature: 0.7
  });
}

async function quickAnalysis(symbol, indicators) {
  var messages = [
    {
      role: 'system',
      content: 'Ты — крипто-аналитик. Давай краткие точные сигналы на основе технических индикаторов. Формат: направление, точка входа, TP, SL, уверенность %. Отвечай на русском.'
    },
    {
      role: 'user',
      content: `Проанализируй ${symbol}.\n\nИндикаторы: ${JSON.stringify(indicators)}`
    }
  ];

  return groqRequestWithFallback('qwen', messages, {
    maxTokens: 2000,
    temperature: 0.5
  });
}

async function chat(message, history = []) {
  const messages = [
    {
      role: 'system',
      content: 'Ты — AI помощник на платформе KotvukAI. Отвечай на вопросы о криптовалютах, трейдинге, техническом анализе. Будь полезным и дружелюбным. Отвечай на том языке, на котором задан вопрос.'
    },
    ...history.filter(m => m.role && m.content).slice(-10),
    { role: 'user', content: message }
  ];

  return groqRequestWithFallback('qwen', messages, {
    maxTokens: 1500,
    temperature: 0.7
  });
}

async function analyzeBacktestResults(backtestResults) {
  const messages = [
    {
      role: 'system',
      content: `Ты — эксперт по анализу торговых стратегий. Анализируй результаты backtesting и давай рекомендации по улучшению.

Формат ответа:
## 📊 Общая оценка стратегии
## 📈 Сильные стороны
## ⚠️ Слабые стороны
## 🔧 Рекомендации по улучшению
## 🎯 Оптимизация параметров`
    },
    {
      role: 'user',
      content: `Проанализируй результаты backtesting:\n\n${JSON.stringify(backtestResults, null, 2)}`
    }
  ];

  return groqRequestWithFallback('kimi', messages, {
    maxTokens: 4000,
    temperature: 0.6
  });
}

async function selfAnalysis(pastSignals, performanceMetrics) {
  const messages = [
    {
      role: 'system',
      content: `Ты — AI торговый бот с возможностью самоанализа. Анализируй свои прошлые решения и учись на ошибках.

Формат ответа:
## 🧠 Анализ паттернов ошибок
## ✅ Успешные паттерны
## 📉 Паттерны убыточных сделок
## 🎯 Корректировки для будущих сигналов
## 📊 Обновлённые веса индикаторов`
    },
    {
      role: 'user',
      content: `Проведи самоанализ на основе истории:\n\nСигналы: ${JSON.stringify(pastSignals.slice(-20), null, 2)}\n\nМетрики: ${JSON.stringify(performanceMetrics)}`
    }
  ];

  return groqRequestWithFallback('deepseek', messages, {
    maxTokens: 3000,
    temperature: 0.7
  });
}

const GROQ_MODEL = MODEL_GROUPS.qwen.model;

function getGroqConfig() {
  const config = getConfigForGroup('qwen') || getNextConfig();
  return { key: config.key, model: config.model };
}

function getGroqKey() {
  return getGroqConfig().key;
}

async function groqRequest(fn) {
  const config = getNextConfig();
  return fn(config.key, config.model);
}

function fallbackToNextModel() {
  handleRateLimit('qwen');
}

function getStats() {
  return {
    ...stats,
    keyCounts: {
      kimi: MODEL_GROUPS.kimi.keys.length,
      deepseek: MODEL_GROUPS.deepseek.keys.length,
      qwen: MODEL_GROUPS.qwen.keys.length
    },
    totalKeys: Object.values(MODEL_GROUPS).reduce((sum, g) => sum + g.keys.length, 0)
  };
}

function resetStats() {
  stats.totalRequests = 0;
  stats.rateLimitsHit = 0;
  stats.fallbacks = 0;
  for (const key of Object.keys(stats.byModel)) {
    stats.byModel[key] = { requests: 0, errors: 0, avgLatency: 0 };
  }
}

module.exports = {
  MODEL_GROUPS,
  GROQ_MODEL,
  getConfigForGroup,
  getNextConfig,
  groqRequestWithFallback,
  deepAnalysis,
  reasoningAnalysis,
  quickAnalysis,
  chat,
  analyzeBacktestResults,
  selfAnalysis,
  getGroqConfig,
  getGroqKey,
  groqRequest,
  fallbackToNextModel,
  getStats,
  resetStats
};
