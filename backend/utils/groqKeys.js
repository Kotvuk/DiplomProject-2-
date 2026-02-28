var MODEL_GROUPS = {
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

var FALLBACK_ORDER = ['kimi', 'deepseek', 'qwen'];
let currentFallbackIndex = 0;

function getConfigForGroup(groupName) {
  const group = MODEL_GROUPS[groupName];
  if (!group || group.keys.length === 0) {
    return null;
  }

  var idx = keyIndexes[groupName];
  const key = group.keys[idx];

  keyIndexes[groupName] = (idx + 1) % group.keys.length;

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
    var g = MODEL_GROUPS[name];
    if (g.keys.length > 0) {
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
  const currentIndex = FALLBACK_ORDER.indexOf(currentGroup);
  for (let i = 1; i < FALLBACK_ORDER.length; i++) {
    var nextIndex = (currentIndex + i) % FALLBACK_ORDER.length;
    const nextGroup = FALLBACK_ORDER[nextIndex];
    if (MODEL_GROUPS[nextGroup].keys.length > 0) {
      currentFallbackIndex = nextIndex;
      console.warn(`[Groq] Rate limit on ${currentGroup}, switching to ${nextGroup}`);
      return nextGroup;
    }
  }

  return null;
}

async function makeGroqRequest(key, model, messages, options = {}) {
  const {
    temperature = 0.7,
    maxTokens = 2000,
    stream = false
  } = options;

  var resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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

  const data = await resp.json();

  if (data.error) {
    var error = new Error(data.error.message);
    error.status = resp.status;
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

    var t0 = Date.now();

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

      return {
        ...result,
        _meta: {
          model: config.model,
          group: currentGroup,
          latency: Date.now() - t0
        }
      };

    } catch (error) {
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

// глубокий разбор одного тикера — кидаем в kimi, там контекст побольше
async function deepAnalysis(ticker, mktData, customPrompt) {
  var sysMsg = customPrompt || 'Ты крипто-аналитик. Разбирай монету подробно, смотри на все таймфреймы и объёмы. Пиши на русском, можно с форматированием.';
  const messages = [
    { role: 'system', content: sysMsg },
    {
      role: 'user',
      content: `Разбери ${ticker} подробно.\n\nДанные рынка: ${JSON.stringify(mktData, null, 2)}`
    }
  ];

  return groqRequestWithFallback('kimi', messages, {
    maxTokens: 8000,
    temperature: 0.6
  });
}

// reasoning — когда нужно подумать над стратегией, тут deepseek лучше справляется
async function reasoningAnalysis(question, ctx) {
  const messages = [
    {
      role: 'system',
      content: 'Ты аналитик торговых стратегий. Думай вслух — показывай ход рассуждений, потом делай вывод. Отвечай на русском.'
    },
    {
      role: 'user',
      content: `${question}\n\nКонтекст: ${JSON.stringify(ctx || {}, null, 2)}`
    }
  ];

  return groqRequestWithFallback('deepseek', messages, { maxTokens: 4000, temperature: 0.7 });
}

// быстрые сигналы — qwen шустрый, ответ за секунду обычно
async function quickAnalysis(sym, indicatorData) {
  var msgs = [
    {
      role: 'system',
      content: 'Крипто-аналитик. Коротко и по делу: направление, вход, TP, SL, уверенность в процентах. Русский язык.'
    },
    {
      role: 'user',
      content: `Сигнал по ${sym}.\n\nИндикаторы: ${JSON.stringify(indicatorData)}`
    }
  ];

  return groqRequestWithFallback('qwen', msgs, { maxTokens: 2000, temperature: 0.5 });
}

async function analyzeBacktestResults(backtestResults) {
  const messages = [
    {
      role: 'system',
      content: 'Ты эксперт по торговым стратегиям. Посмотри на результаты бэктеста и скажи что хорошо, что плохо, и что подкрутить. Структурируй ответ по разделам: общая оценка, сильные стороны, слабые стороны, что улучшить, какие параметры поменять.'
    },
    {
      role: 'user',
      content: `Вот результаты backtesting:\n\n${JSON.stringify(backtestResults, null, 2)}`
    }
  ];

  return groqRequestWithFallback('kimi', messages, {
    maxTokens: 4000,
    temperature: 0.6
  });
}

async function chat(message, history = []) {
  const messages = [
    {
      role: 'system',
      content: 'Ты AI помощник на платформе KotvukAI. Помогаешь с криптой, трейдингом, теханализом. Будь полезным, отвечай на языке вопроса.'
    },
    ...history.filter(m => m.role && m.content).slice(-10),
    { role: 'user', content: message }
  ];

  return groqRequestWithFallback('qwen', messages, {
    maxTokens: 1500,
    temperature: 0.7
  });
}

async function selfAnalysis(pastSignals, performanceMetrics) {
  var messages = [
    {
      role: 'system',
      content: 'Ты торговый бот который умеет анализировать свои ошибки. Посмотри на историю сигналов, найди паттерны — где ошибался, где угадывал. Дай конкретные советы что поменять в следующих сигналах. Раздели ответ на: паттерны ошибок, успешные паттерны, убыточные паттерны, что исправить, веса индикаторов.'
    },
    {
      role: 'user',
      content: `Самоанализ по истории:\n\nСигналы: ${JSON.stringify(pastSignals.slice(-20), null, 2)}\n\nМетрики: ${JSON.stringify(performanceMetrics)}`
    }
  ];

  return groqRequestWithFallback('deepseek', messages, {
    maxTokens: 3000,
    temperature: 0.7
  });
}

const GROQ_MODEL = MODEL_GROUPS.qwen.model;

function getGroqKey() {
  var cfg = getConfigForGroup('qwen') || getNextConfig();
  return cfg.key;
}

function getGroqConfig() {
  const config = getConfigForGroup('qwen') || getNextConfig();
  return { key: config.key, model: config.model };
}

async function groqRequest(fn) {
  const config = getNextConfig();
  return fn(config.key, config.model);
}

function fallbackToNextModel() {
  handleRateLimit('qwen');
}

module.exports = {
  groqRequestWithFallback,
  deepAnalysis,
  MODEL_GROUPS,
  quickAnalysis,
  getGroqConfig,
  chat,
  reasoningAnalysis,
  GROQ_MODEL,
  analyzeBacktestResults,
  getGroqKey,
  selfAnalysis,
  getConfigForGroup,
  groqRequest,
  getNextConfig,
  fallbackToNextModel,
};
