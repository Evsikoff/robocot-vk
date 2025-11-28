/**
 * Player Progress Saver
 * Automatically saves player progress when interacting with each new level
 * Logs all save attempts to VK Storage and localStorage
 */
(function() {
  'use strict';

  // Enhanced logging with timestamps and emojis
  function log(level, message, data) {
    const timestamp = new Date().toISOString();
    const prefix = `[Player Progress Saver][${timestamp}][${level.toUpperCase()}]`;

    if (level === 'error') {
      console.error(prefix, message, data || '');
    } else if (level === 'warn') {
      console.warn(prefix, message, data || '');
    } else {
      console.log(prefix, message, data || '');
    }
  }

  // Track last saved level to avoid duplicate saves
  let lastSavedLevel = null;
  let lastSavedLevelGroup = null;
  let saveInProgress = false;

  /**
   * Save player progress to both VK Storage and localStorage
   */
  async function savePlayerProgress(progressData) {
    if (saveInProgress) {
      log('info', '⏳ Сохранение уже в процессе, пропускаем');
      return;
    }

    saveInProgress = true;

    try {
      const {
        currentLevel,
        currentLevelGroup,
        completedLevels,
        timestamp
      } = progressData;

      log('info', '💾 ========== НАЧАЛО СОХРАНЕНИЯ ПРОГРЕССА ==========');
      log('info', '📊 Данные для сохранения:', {
        currentLevel,
        currentLevelGroup,
        completedLevelsCount: completedLevels ? Object.keys(completedLevels).length : 0,
        timestamp
      });

      // Prepare progress object
      const progress = {
        currentLevel,
        currentLevelGroup,
        completedLevels,
        lastUpdated: timestamp
      };

      const progressJSON = JSON.stringify(progress);

      // Save to localStorage first (synchronous)
      log('info', '🔄 Попытка сохранения в localStorage (браузер)...');
      try {
        localStorage.setItem('playerProgress', progressJSON);
        log('info', '✅ Прогресс успешно сохранен в localStorage', {
          size: progressJSON.length + ' bytes'
        });
      } catch (localStorageError) {
        log('error', '❌ Ошибка сохранения в localStorage', {
          error: localStorageError.message,
          stack: localStorageError.stack
        });
      }

      // Save to VK Storage (asynchronous)
      if (window.VKBridgeWrapper && window.VKBridgeWrapper.initialized) {
        log('info', '🔄 Попытка сохранения в VK Storage...');
        try {
          const success = await window.VKBridgeWrapper.storageSet('playerProgress', progressJSON);

          if (success) {
            log('info', '✅ Прогресс успешно сохранен в VK Storage', {
              size: progressJSON.length + ' bytes'
            });
          } else {
            log('warn', '⚠️ VK Storage вернул false при сохранении');
          }
        } catch (vkStorageError) {
          log('error', '❌ Ошибка сохранения в VK Storage', {
            error: vkStorageError.message,
            stack: vkStorageError.stack
          });
        }
      } else {
        log('warn', '⚠️ VK Bridge не инициализирован, сохранение только в localStorage');
      }

      // Also save individual level data for compatibility
      try {
        localStorage.setItem('currentLevel', String(currentLevel || 0));
        localStorage.setItem('currentLevelGroup', String(currentLevelGroup || 0));

        if (completedLevels) {
          localStorage.setItem('completedLevels', JSON.stringify(completedLevels));
        }

        log('info', '✅ Дополнительные ключи сохранены для совместимости');
      } catch (error) {
        log('warn', '⚠️ Ошибка при сохранении дополнительных ключей', {
          error: error.message
        });
      }

      log('info', '✅ ========== СОХРАНЕНИЕ ПРОГРЕССА ЗАВЕРШЕНО ==========');

    } catch (error) {
      log('error', '❌ Критическая ошибка при сохранении прогресса', {
        error: error.message,
        stack: error.stack
      });
    } finally {
      saveInProgress = false;
    }
  }

  /**
   * Extract progress data from Redux state in localStorage
   */
  function extractProgressFromState() {
    try {
      // Try to find Redux state in localStorage
      // Common keys: 'persist:root', 'reduxState', 'state'
      const possibleKeys = ['persist:root', 'reduxState', 'state', 'app'];

      for (const key of possibleKeys) {
        const stateJSON = localStorage.getItem(key);
        if (!stateJSON) continue;

        try {
          const state = JSON.parse(stateJSON);

          // Look for game state nested in different structures
          const gameState = state.game || state.app?.game || state;

          if (gameState && (gameState.currentLevel !== undefined || gameState.currentLevelGroup !== undefined)) {
            return {
              currentLevel: gameState.currentLevel,
              currentLevelGroup: gameState.currentLevelGroup,
              completedLevels: gameState.completedLevels || state.app?.completedLevels,
              timestamp: new Date().toISOString()
            };
          }
        } catch (parseError) {
          // Try parsing nested JSON
          try {
            const parsed = JSON.parse(stateJSON);
            if (parsed.game) {
              const nestedGame = JSON.parse(parsed.game);
              if (nestedGame.currentLevel !== undefined) {
                return {
                  currentLevel: nestedGame.currentLevel,
                  currentLevelGroup: nestedGame.currentLevelGroup,
                  completedLevels: nestedGame.completedLevels,
                  timestamp: new Date().toISOString()
                };
              }
            }
          } catch (e) {
            // Ignore
          }
        }
      }

      return null;
    } catch (error) {
      log('error', '❌ Ошибка при извлечении прогресса из состояния', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Monitor localStorage changes for level transitions
   */
  function monitorLevelChanges() {
    // Store original localStorage.setItem
    const originalSetItem = localStorage.setItem.bind(localStorage);

    // Override localStorage.setItem to detect level changes
    localStorage.setItem = function(key, value) {
      // Call original first
      originalSetItem(key, value);

      // Check if this is a state update that might contain level info
      if (key.includes('persist') || key.includes('redux') || key.includes('state') || key.includes('app') || key.includes('game')) {
        log('info', '🔍 Обнаружено обновление состояния', { key });

        // Delay extraction to ensure state is fully updated
        setTimeout(() => {
          const progress = extractProgressFromState();

          if (progress && progress.currentLevel !== undefined) {
            const { currentLevel, currentLevelGroup } = progress;

            // Check if this is a new level
            if (currentLevel !== lastSavedLevel || currentLevelGroup !== lastSavedLevelGroup) {
              log('info', '🎮 ========== ОБНАРУЖЕН ПЕРЕХОД НА НОВЫЙ УРОВЕНЬ ==========');
              log('info', '📍 Предыдущий уровень:', {
                level: lastSavedLevel,
                group: lastSavedLevelGroup
              });
              log('info', '📍 Новый уровень:', {
                level: currentLevel,
                group: currentLevelGroup
              });

              lastSavedLevel = currentLevel;
              lastSavedLevelGroup = currentLevelGroup;

              // Save progress
              savePlayerProgress(progress);
            }
          }
        }, 100);
      }
    };

    log('info', '✅ Мониторинг изменений localStorage настроен');
  }

  /**
   * Watch for DOM changes that indicate level loading
   */
  function watchForLevelScreen() {
    const observer = new MutationObserver(() => {
      // Check if we're on a game screen (not start screen)
      const gameStage = document.querySelector('canvas');
      const startScreen = document.querySelector('div._541cc');

      if (gameStage && !startScreen) {
        // We're in a level, check if we should save
        const progress = extractProgressFromState();

        if (progress && progress.currentLevel !== undefined) {
          const { currentLevel, currentLevelGroup } = progress;

          if (currentLevel !== lastSavedLevel || currentLevelGroup !== lastSavedLevelGroup) {
            log('info', '🎮 Обнаружен уровень через DOM', {
              level: currentLevel,
              group: currentLevelGroup
            });

            lastSavedLevel = currentLevel;
            lastSavedLevelGroup = currentLevelGroup;

            savePlayerProgress(progress);
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    log('info', '✅ Наблюдатель за экраном уровня настроен');
  }

  /**
   * Listen to storage events from other tabs/windows
   */
  function listenToStorageEvents() {
    window.addEventListener('storage', (event) => {
      if (event.key && (event.key.includes('level') || event.key.includes('Level') || event.key.includes('progress'))) {
        log('info', '🔄 Обнаружено изменение в storage из другой вкладки', {
          key: event.key,
          newValue: event.newValue ? event.newValue.substring(0, 100) : null
        });

        // Extract and potentially save progress
        setTimeout(() => {
          const progress = extractProgressFromState();
          if (progress) {
            const { currentLevel, currentLevelGroup } = progress;
            if (currentLevel !== lastSavedLevel || currentLevelGroup !== lastSavedLevelGroup) {
              lastSavedLevel = currentLevel;
              lastSavedLevelGroup = currentLevelGroup;
              savePlayerProgress(progress);
            }
          }
        }, 100);
      }
    });

    log('info', '✅ Слушатель событий storage настроен');
  }

  /**
   * Initialize the progress saver
   */
  async function initialize() {
    log('info', '🚀 ========== ИНИЦИАЛИЗАЦИЯ PLAYER PROGRESS SAVER ==========');
    log('info', '📋 Версия: Player Progress Saver v1.0');
    log('info', '🌐 User Agent: ' + navigator.userAgent);
    log('info', '📍 URL: ' + window.location.href);

    // Wait for VK Bridge to be ready
    if (window.VKBridgeWrapper) {
      log('info', '⏳ Ожидание инициализации VK Bridge...');

      let attempts = 0;
      const maxAttempts = 50;

      while (!window.VKBridgeWrapper.initialized && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (window.VKBridgeWrapper.initialized) {
        log('info', '✅ VK Bridge готов к работе');
      } else {
        log('warn', '⚠️ VK Bridge не инициализирован, продолжаем с localStorage');
      }
    }

    // Setup monitoring
    monitorLevelChanges();
    watchForLevelScreen();
    listenToStorageEvents();

    // Try to load initial progress
    const initialProgress = extractProgressFromState();
    if (initialProgress) {
      lastSavedLevel = initialProgress.currentLevel;
      lastSavedLevelGroup = initialProgress.currentLevelGroup;
      log('info', '📊 Начальный прогресс:', {
        level: lastSavedLevel,
        group: lastSavedLevelGroup
      });
    }

    log('info', '✅ Инициализация завершена, ожидание изменений уровня...');
  }

  // Expose save function globally for manual use
  window.savePlayerProgress = function() {
    const progress = extractProgressFromState();
    if (progress) {
      return savePlayerProgress(progress);
    } else {
      log('warn', '⚠️ Не удалось извлечь прогресс для сохранения');
      return Promise.resolve();
    }
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

  log('info', '📦 Player Progress Saver загружен');
})();
