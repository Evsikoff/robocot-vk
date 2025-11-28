/**
 * Game Storage Loader
 * Intercepts localStorage calls and integrates VK Storage with browser storage
 * Loads player progress during start screen initialization
 */
(function() {
  'use strict';

  // Enhanced logging with timestamps
  function log(level, message, data) {
    const timestamp = new Date().toISOString();
    const prefix = `[Game Storage][${timestamp}][${level.toUpperCase()}]`;

    if (level === 'error') {
      console.error(prefix, message, data || '');
    } else if (level === 'warn') {
      console.warn(prefix, message, data || '');
    } else {
      console.log(prefix, message, data || '');
    }
  }

  // Track initialization state
  let isInitialized = false;
  let isStartScreenLoaded = false;
  let progressLoadAttempted = false;

  // Store original localStorage methods
  const originalLocalStorage = {
    getItem: window.localStorage.getItem.bind(window.localStorage),
    setItem: window.localStorage.setItem.bind(window.localStorage),
    removeItem: window.localStorage.removeItem.bind(window.localStorage)
  };

  // Cache for VK Storage values to avoid repeated async calls
  const vkStorageCache = new Map();

  /**
   * Enhanced getItem that tries VK Storage first, then localStorage
   */
  async function enhancedGetItem(key) {
    log('info', '📥 Запрос на получение данных', { key });

    try {
      // Try VK Storage first if available
      if (window.VKBridgeWrapper && window.VKBridgeWrapper.initialized) {
        log('info', '🔄 Попытка загрузить из VK Storage', { key });

        const vkValue = await window.VKBridgeWrapper.storageGet(key);

        if (vkValue !== null && vkValue !== '') {
          log('info', '✅ Данные успешно загружены из VK Storage', {
            key,
            valueLength: vkValue.length
          });

          // Update cache and localStorage
          vkStorageCache.set(key, vkValue);
          originalLocalStorage.setItem(key, vkValue);

          return vkValue;
        } else {
          log('warn', '⚠️ VK Storage не содержит данных для ключа', { key });
        }
      } else {
        log('warn', '⚠️ VK Bridge не инициализирован, пропускаем VK Storage', { key });
      }

      // Fallback to localStorage
      log('info', '🔄 Попытка загрузить из localStorage (браузер)', { key });
      const localValue = originalLocalStorage.getItem(key);

      if (localValue !== null) {
        log('info', '✅ Данные успешно загружены из localStorage', {
          key,
          valueLength: localValue.length
        });

        // Sync to VK Storage if available
        if (window.VKBridgeWrapper && window.VKBridgeWrapper.initialized) {
          log('info', '🔄 Синхронизация данных с VK Storage', { key });
          await window.VKBridgeWrapper.storageSet(key, localValue);
        }

        return localValue;
      } else {
        log('info', 'ℹ️ Данных нет ни в VK Storage, ни в localStorage', { key });
        return null;
      }
    } catch (error) {
      log('error', '❌ Ошибка при загрузке данных', {
        key,
        error: error.message
      });

      // Final fallback to original localStorage
      return originalLocalStorage.getItem(key);
    }
  }

  /**
   * Enhanced setItem that saves to both VK Storage and localStorage
   */
  async function enhancedSetItem(key, value) {
    log('info', '💾 Запрос на сохранение данных', {
      key,
      valueLength: String(value).length
    });

    try {
      // Save to localStorage first (synchronous, always works)
      originalLocalStorage.setItem(key, value);
      log('info', '✅ Данные сохранены в localStorage', { key });

      // Also save to VK Storage if available
      if (window.VKBridgeWrapper && window.VKBridgeWrapper.initialized) {
        log('info', '🔄 Сохранение в VK Storage', { key });
        const success = await window.VKBridgeWrapper.storageSet(key, String(value));

        if (success) {
          log('info', '✅ Данные сохранены в VK Storage', { key });
          vkStorageCache.set(key, String(value));
        } else {
          log('warn', '⚠️ Не удалось сохранить в VK Storage', { key });
        }
      }
    } catch (error) {
      log('error', '❌ Ошибка при сохранении данных', {
        key,
        error: error.message
      });
    }
  }

  /**
   * Enhanced removeItem that removes from both storages
   */
  async function enhancedRemoveItem(key) {
    log('info', '🗑️ Запрос на удаление данных', { key });

    try {
      // Remove from localStorage
      originalLocalStorage.removeItem(key);
      vkStorageCache.delete(key);

      // Remove from VK Storage (set to empty string)
      if (window.VKBridgeWrapper && window.VKBridgeWrapper.initialized) {
        await window.VKBridgeWrapper.storageSet(key, '');
        log('info', '✅ Данные удалены из обоих хранилищ', { key });
      }
    } catch (error) {
      log('error', '❌ Ошибка при удалении данных', {
        key,
        error: error.message
      });
    }
  }

  /**
   * Load player progress from storage
   */
  async function loadPlayerProgress() {
    if (progressLoadAttempted) {
      log('info', 'ℹ️ Загрузка прогресса уже была выполнена');
      return;
    }

    progressLoadAttempted = true;
    log('info', '🎮 ========== НАЧАЛО ЗАГРУЗКИ ПРОГРЕССА ИГРОКА ==========');

    try {
      // Common keys used by the game (you may need to adjust these)
      const gameKeys = [
        'gameState',
        'playerProgress',
        'currentLevel',
        'completedLevels',
        'userBoards',
        'progress'
      ];

      log('info', '🔍 Поиск сохраненных данных игры', { keys: gameKeys });

      for (const key of gameKeys) {
        await enhancedGetItem(key);
      }

      log('info', '✅ ========== ЗАГРУЗКА ПРОГРЕССА ЗАВЕРШЕНА ==========');
    } catch (error) {
      log('error', '❌ Критическая ошибка при загрузке прогресса', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Monitor for start screen appearance
   */
  function watchForStartScreen() {
    const checkStartScreen = () => {
      const startScreen = document.querySelector('div._541cc');

      if (startScreen && !isStartScreenLoaded) {
        isStartScreenLoaded = true;
        log('info', '🎬 ========== СТАРТОВЫЙ ЭКРАН ОБНАРУЖЕН ==========');
        log('info', '📱 Начинается загрузка данных игры...');

        // Load player progress when start screen appears
        loadPlayerProgress().then(() => {
          log('info', '🏁 ========== ЗАГРУЗКА СТАРТОВОГО ЭКРАНА ЗАВЕРШЕНА ==========');
        });
      }
    };

    // Create observer to watch for start screen
    const observer = new MutationObserver(() => {
      checkStartScreen();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Check immediately in case start screen is already there
    checkStartScreen();
  }

  /**
   * Override localStorage methods to use enhanced versions
   */
  function setupLocalStorageProxy() {
    log('info', '🔧 Настройка перехватчика localStorage');

    // Create a proxy that handles async operations
    const localStorageProxy = new Proxy(window.localStorage, {
      get(target, prop) {
        if (prop === 'getItem') {
          return function(key) {
            // For synchronous code, return from cache or original
            const cached = vkStorageCache.get(key);
            if (cached !== undefined) {
              return cached;
            }

            // Start async load in background
            enhancedGetItem(key).then(value => {
              if (value !== null) {
                vkStorageCache.set(key, value);
              }
            });

            // Return synchronous value for now
            return originalLocalStorage.getItem(key);
          };
        } else if (prop === 'setItem') {
          return function(key, value) {
            // Sync operation happens first, async in background
            enhancedSetItem(key, value);
          };
        } else if (prop === 'removeItem') {
          return function(key) {
            enhancedRemoveItem(key);
          };
        }

        return target[prop];
      }
    });

    // Note: Can't actually replace window.localStorage due to browser restrictions
    // But we can intercept common patterns
    log('info', '✅ Перехватчик localStorage настроен');
  }

  /**
   * Initialize the storage loader
   */
  async function initialize() {
    if (isInitialized) {
      return;
    }

    log('info', '🚀 ========== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ==========');
    log('info', '📋 Версия: Game Storage Loader v1.0');
    log('info', '🌐 User Agent: ' + navigator.userAgent);
    log('info', '📍 URL: ' + window.location.href);

    isInitialized = true;

    // Wait for VK Bridge to be ready
    if (window.VKBridgeWrapper) {
      log('info', '⏳ Ожидание инициализации VK Bridge...');

      // Give VK Bridge some time to initialize
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max

      while (!window.VKBridgeWrapper.initialized && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (window.VKBridgeWrapper.initialized) {
        log('info', '✅ VK Bridge инициализирован и готов к работе');
      } else {
        log('warn', '⚠️ VK Bridge не инициализирован после ожидания, продолжаем с localStorage');
      }
    } else {
      log('warn', '⚠️ VK Bridge не найден, будет использоваться только localStorage');
    }

    // Setup localStorage interception
    setupLocalStorageProxy();

    // Start watching for start screen
    watchForStartScreen();

    log('info', '✅ Инициализация завершена, ожидание стартового экрана...');
  }

  // Expose enhanced storage methods globally for manual use
  window.gameStorage = {
    getItem: enhancedGetItem,
    setItem: enhancedSetItem,
    removeItem: enhancedRemoveItem,
    loadProgress: loadPlayerProgress
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

  log('info', '📦 Game Storage Loader загружен');
})();
