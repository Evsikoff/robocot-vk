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

  // Keep a snapshot of the last successfully extracted progress
  let lastKnownProgress = null;

  // Track the last level start we logged to avoid duplicates
  let lastLoggedLevelStart = { level: null, group: null };

  function logLevelStartIfNew(level, group) {
    if (level === undefined || level === null) return;

    const isSameLevel = level === lastLoggedLevelStart.level && group === lastLoggedLevelStart.group;

    if (!isSameLevel) {
      log('info', '🎯 Игрок начал уровень', { level, group });
      lastLoggedLevelStart = { level, group };
    }
  }

  /**
   * Save player progress to both VK Storage and localStorage
   */
  async function savePlayerProgress(progressData) {
    if (saveInProgress) {
      log('info', '⏳ Сохранение уже в процессе, пропускаем');
      return;
    }

    saveInProgress = true;

    // Cache snapshot for future fallbacks
    lastKnownProgress = { ...progressData };

    try {
      const {
        currentLevel,
        currentLevelGroup,
        completedLevels,
        levelGroups,
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
        levelGroups,
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

        if (levelGroups) {
          localStorage.setItem('levelGroups', JSON.stringify(levelGroups));
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
      const possibleKeys = ['persist:root', 'reduxState', 'state', 'app', 'progress', 'gameState'];

      for (const key of possibleKeys) {
        const stateJSON = localStorage.getItem(key);
        if (!stateJSON) continue;

        try {
          const state = JSON.parse(stateJSON);

          // Look for game state nested in different structures
          const gameState = state.game || state.app?.game || state;

          if (gameState && (gameState.currentLevel !== undefined || gameState.currentLevelGroup !== undefined)) {
            lastKnownProgress = {
              currentLevel: gameState.currentLevel,
              currentLevelGroup: gameState.currentLevelGroup,
              completedLevels: gameState.completedLevels || state.app?.completedLevels,
              levelGroups: gameState.levelGroups,
              timestamp: new Date().toISOString()
            };
            return lastKnownProgress;
          }
        } catch (parseError) {
          // Try parsing nested JSON
          try {
            const parsed = JSON.parse(stateJSON);
            if (parsed.game) {
              const nestedGame = JSON.parse(parsed.game);
              if (nestedGame.currentLevel !== undefined) {
                lastKnownProgress = {
                  currentLevel: nestedGame.currentLevel,
                  currentLevelGroup: nestedGame.currentLevelGroup,
                  completedLevels: nestedGame.completedLevels,
                  levelGroups: nestedGame.levelGroups,
                  timestamp: new Date().toISOString()
                };
                return lastKnownProgress;
              }
            }
          } catch (e) {
            // Ignore
          }
        }
      }

      // Fall back to previously saved progress in localStorage
      const savedProgress = localStorage.getItem('playerProgress');
      if (savedProgress) {
        try {
          const parsedProgress = JSON.parse(savedProgress);
          if (parsedProgress.currentLevel !== undefined) {
            log('info', 'ℹ️ Используем сохраненный в localStorage прогресс как резервный источник');
            lastKnownProgress = {
              currentLevel: parsedProgress.currentLevel,
              currentLevelGroup: parsedProgress.currentLevelGroup,
              completedLevels: parsedProgress.completedLevels,
              levelGroups: parsedProgress.levelGroups,
              timestamp: new Date().toISOString()
            };
            return lastKnownProgress;
          }
        } catch (e) {
          log('warn', '⚠️ Не удалось разобрать playerProgress из localStorage', { error: e.message });
        }
      }

      // Final fallback to individual keys
      const fallbackLevel = localStorage.getItem('currentLevel');
      const fallbackGroup = localStorage.getItem('currentLevelGroup');

      if (fallbackLevel !== null || fallbackGroup !== null) {
        log('info', 'ℹ️ Используем раздельные ключи прогресса из localStorage');
        lastKnownProgress = {
          currentLevel: fallbackLevel !== null ? Number(fallbackLevel) : undefined,
          currentLevelGroup: fallbackGroup !== null ? Number(fallbackGroup) : undefined,
          completedLevels: (() => {
            const raw = localStorage.getItem('completedLevels');
            if (!raw) return undefined;
            try {
              return JSON.parse(raw);
            } catch (e) {
              return undefined;
            }
          })(),
          timestamp: new Date().toISOString()
        };
        return lastKnownProgress;
      }

      // Try to read from known global stores
      const globalProgress = extractProgressFromGlobals();
      if (globalProgress) {
        return globalProgress;
      }

      // Use last known snapshot if available
      if (lastKnownProgress) {
        log('info', 'ℹ️ Используем последний успешный снимок прогресса');
        return lastKnownProgress;
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
   * Try to read progress from known global stores
   */
  function extractProgressFromGlobals() {
    try {
      const possibleStores = [
        window.store,
        window.__STORE__,
        window.__appStore,
        window.__reduxStore,
        window.__REDUX_STORE__,
        window.__GLOBAL_STORE__
      ];

      for (const store of possibleStores) {
        if (!store) continue;

        const state = typeof store.getState === 'function' ? store.getState() : store.state || store;
        const game = state?.game || state?.app?.game || state;

        if (game && (game.currentLevel !== undefined || game.currentLevelGroup !== undefined)) {
          lastKnownProgress = {
            currentLevel: game.currentLevel,
            currentLevelGroup: game.currentLevelGroup,
            completedLevels: game.completedLevels || state.app?.completedLevels,
            levelGroups: game.levelGroups,
            timestamp: new Date().toISOString()
          };
          return lastKnownProgress;
        }
      }
    } catch (error) {
      log('warn', '⚠️ Ошибка при попытке извлечения прогресса из глобальных сторах', { error: error.message });
    }

    return null;
  }

  /**
   * Calculate next level based on current level and levelGroups structure
   * This mirrors the logic from the game's next() function in dac11.js:3822-3839
   */
  function calculateNextLevel(currentLevel, currentLevelGroup, levelGroups) {
    try {
      if (!levelGroups || !Array.isArray(levelGroups)) {
        log('warn', '⚠️ levelGroups не найдены или имеют неверный формат');
        return null;
      }

      // Filter out custom levels (same as game logic)
      const nonCustomGroups = levelGroups.filter(group => !group.isCustom);

      if (nonCustomGroups.length === 0) {
        log('warn', '⚠️ Не найдено ни одной не-пользовательской группы уровней');
        return null;
      }

      // Find current group in non-custom groups
      const currentGroupInFiltered = nonCustomGroups.indexOf(levelGroups[currentLevelGroup]);

      if (currentGroupInFiltered === -1) {
        log('warn', '⚠️ Текущая группа уровней не найдена в отфильтрованном списке');
        return null;
      }

      const currentGroupLevels = nonCustomGroups[currentGroupInFiltered].levels;
      const currentGroupIndexInAll = levelGroups.indexOf(nonCustomGroups[currentGroupInFiltered]);

      // Check if there's a next level in the current group
      if (currentLevel + 1 < currentGroupLevels.length) {
        // Move to next level in same group
        log('info', '➡️ Переход на следующий уровень в той же группе', {
          nextLevel: currentLevel + 1,
          nextGroup: currentGroupIndexInAll
        });
        return {
          nextLevel: currentLevel + 1,
          nextLevelGroup: currentGroupIndexInAll
        };
      }
      // Check if there's a next group
      else if (currentGroupInFiltered + 1 < nonCustomGroups.length) {
        // Move to first level of next group
        const nextGroupIndexInAll = levelGroups.indexOf(nonCustomGroups[currentGroupInFiltered + 1]);
        log('info', '➡️ Переход на первый уровень следующей группы', {
          nextLevel: 0,
          nextGroup: nextGroupIndexInAll
        });
        return {
          nextLevel: 0,
          nextLevelGroup: nextGroupIndexInAll
        };
      }

      // This is the last level
      log('info', '🏁 Это последний уровень в игре');
      return null;
    } catch (error) {
      log('error', '❌ Ошибка при вычислении следующего уровня', {
        error: error.message,
        stack: error.stack
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
      if (key.includes('persist') || key.includes('redux') || key.includes('state') || key.includes('app') || key.includes('game') || key.includes('progress')) {
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

              logLevelStartIfNew(currentLevel, currentLevelGroup);

              lastSavedLevel = currentLevel;
              lastSavedLevelGroup = currentLevelGroup;

              // Save progress
              savePlayerProgress(progress);
            }
          }
        }, 100);

        // Try parsing the incoming value immediately to cache best-effort progress
        try {
          const parsedValue = JSON.parse(value);
          const stateCandidate = parsedValue.game ? JSON.parse(parsedValue.game) : parsedValue;
          if (stateCandidate && (stateCandidate.currentLevel !== undefined || stateCandidate.currentLevelGroup !== undefined)) {
            lastKnownProgress = {
              currentLevel: stateCandidate.currentLevel,
              currentLevelGroup: stateCandidate.currentLevelGroup,
              completedLevels: stateCandidate.completedLevels,
              levelGroups: stateCandidate.levelGroups,
              timestamp: new Date().toISOString()
            };
          }
        } catch (e) {
          // Ignore parsing errors
        }
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

            logLevelStartIfNew(currentLevel, currentLevelGroup);

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
              logLevelStartIfNew(currentLevel, currentLevelGroup);
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
   * Setup Next button click monitoring for progress saving
   */
  function setupNextButtonMonitoring() {
    const handleNextButtonClick = async () => {
      log('info', '🖱️ Обнаружен клик на кнопку "Далее"');

      // Extract current state immediately
      let currentProgress = extractProgressFromState();

      if (!currentProgress || currentProgress.currentLevel === undefined) {
        log('warn', '⚠️ Не удалось извлечь текущий прогресс при клике на "Далее"');

        if (lastKnownProgress) {
          log('info', 'ℹ️ Используем последний известный снимок прогресса');
          currentProgress = { ...lastKnownProgress };
        } else if (lastSavedLevel !== null || lastSavedLevelGroup !== null) {
          log('info', 'ℹ️ Используем последний успешно сохраненный прогресс');
          currentProgress = {
            currentLevel: lastSavedLevel,
            currentLevelGroup: lastSavedLevelGroup,
            completedLevels: (() => {
              const raw = localStorage.getItem('completedLevels');
              if (!raw) return undefined;
              try {
                return JSON.parse(raw);
              } catch (e) {
                return undefined;
              }
            })(),
            levelGroups: (() => {
              const raw = localStorage.getItem('levelGroups');
              if (!raw) return undefined;
              try {
                return JSON.parse(raw);
              } catch (e) {
                return undefined;
              }
            })(),
            timestamp: new Date().toISOString()
          };
        }

        if (!currentProgress || currentProgress.currentLevel === undefined) {
          return;
        }
      }

      const { currentLevel, currentLevelGroup, levelGroups, completedLevels } = currentProgress;

      log('info', '📊 Текущее состояние перед кликом на "Далее"', {
        currentLevel,
        currentLevelGroup,
        hasLevelGroups: !!levelGroups
      });

      // Calculate next level using the game's logic
      const nextLevelInfo = calculateNextLevel(currentLevel, currentLevelGroup, levelGroups);

      if (!nextLevelInfo) {
        log('info', '🏁 Достигнут последний уровень или не удалось вычислить следующий');
        // Still save current progress
        await savePlayerProgress(currentProgress);
        lastSavedLevel = currentLevel;
        lastSavedLevelGroup = currentLevelGroup;
        return;
      }

      const { nextLevel, nextLevelGroup } = nextLevelInfo;

      // Create progress object for the next level
      const nextProgress = {
        currentLevel: nextLevel,
        currentLevelGroup: nextLevelGroup,
        completedLevels: completedLevels,
        levelGroups,
        timestamp: new Date().toISOString()
      };

      log('info', '💾 Сохранение прогресса для следующего уровня', {
        nextLevel,
        nextLevelGroup
      });

      // Save progress for the next level
      await savePlayerProgress(nextProgress);

      // Update last saved values
      lastSavedLevel = nextLevel;
      lastSavedLevelGroup = nextLevelGroup;
    };

    // Monitor for Next button clicks
    const observer = new MutationObserver(() => {
      const nextButtons = document.querySelectorAll('button._4e75b');

      nextButtons.forEach(button => {
        if (button.dataset.progressSaverListener === 'true') return;

        button.dataset.progressSaverListener = 'true';
        button.addEventListener('click', handleNextButtonClick);
        log('info', '✅ Добавлен обработчик сохранения к кнопке "Далее"');
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Check for existing buttons
    const existingButtons = document.querySelectorAll('button._4e75b');
    existingButtons.forEach(button => {
      if (button.dataset.progressSaverListener === 'true') return;

      button.dataset.progressSaverListener = 'true';
      button.addEventListener('click', handleNextButtonClick);
      log('info', '✅ Добавлен обработчик сохранения к существующей кнопке "Далее"');
    });

    log('info', '✅ Мониторинг кнопок "Далее" настроен');
  }

  /**
   * Initialize the progress saver
   */
  async function initialize() {
    log('info', '🚀 ========== ИНИЦИАЛИЗАЦИЯ PLAYER PROGRESS SAVER ==========');
    log('info', '📋 Версия: Player Progress Saver v1.1');
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
    setupNextButtonMonitoring();

    // Try to load initial progress
    const initialProgress = extractProgressFromState();
    if (initialProgress) {
      lastSavedLevel = initialProgress.currentLevel;
      lastSavedLevelGroup = initialProgress.currentLevelGroup;
      lastKnownProgress = initialProgress;
      logLevelStartIfNew(initialProgress.currentLevel, initialProgress.currentLevelGroup);
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
