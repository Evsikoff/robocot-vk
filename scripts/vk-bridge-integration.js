/**
 * VK Bridge Integration Module
 * Provides integration with VK Bridge for storage and ads
 */
(function() {
  'use strict';

  // Enhanced logging with different levels
  function debugLog(level, message, data) {
    const timestamp = new Date().toISOString();
    const prefix = `[VK Bridge Integration][${timestamp}][${level.toUpperCase()}]`;

    if (level === 'error') {
      console.error(prefix, message, data || '');
    } else if (level === 'warn') {
      console.warn(prefix, message, data || '');
    } else {
      console.log(prefix, message, data || '');
    }
  }

  // Global VK Bridge wrapper
  window.VKBridgeWrapper = {
    initialized: false,
    adsInitialized: false,

    /**
     * Initialize VK Bridge
     * @returns {Promise<boolean>} Success status
     */
    async init() {
      try {
        if (this.initialized) {
          debugLog('info', 'Already initialized');
          return true;
        }

        if (typeof vkBridge === 'undefined') {
          debugLog('error', 'VK Bridge not loaded');
          return false;
        }

        debugLog('info', 'Initializing VK Bridge');
        await vkBridge.send('VKWebAppInit');
        this.initialized = true;
        debugLog('info', 'VK Bridge initialized successfully');
        return true;
      } catch (error) {
        debugLog('error', 'Failed to initialize VK Bridge', {
          error: error.message,
          stack: error.stack
        });
        return false;
      }
    },

    /**
     * Get data from VK Storage
     * @param {string} key - Storage key
     * @returns {Promise<string|null>} Stored value or null
     */
    async storageGet(key) {
      const startTime = performance.now();
      try {
        if (!this.initialized) {
          await this.init();
        }

        if (!this.initialized) {
          debugLog('error', 'Cannot get from storage - not initialized', { key });
          return null;
        }

        debugLog('info', 'VK Storage GET request', { key });
        const result = await vkBridge.send('VKWebAppStorageGet', {
          keys: [key]
        });

        const duration = (performance.now() - startTime).toFixed(2);

        if (result && result.keys && result.keys.length > 0) {
          const value = result.keys[0].value;
          debugLog('info', 'VK Storage GET success', {
            key,
            valueLength: value ? value.length : 0,
            duration: `${duration}ms`
          });
          return value;
        }

        debugLog('warn', 'VK Storage GET returned no value', {
          key,
          duration: `${duration}ms`
        });
        return null;
      } catch (error) {
        const duration = (performance.now() - startTime).toFixed(2);
        debugLog('error', 'VK Storage GET failed', {
          key,
          error: error.message,
          stack: error.stack,
          duration: `${duration}ms`
        });
        return null;
      }
    },

    /**
     * Set data in VK Storage
     * @param {string} key - Storage key
     * @param {string} value - Value to store
     * @returns {Promise<boolean>} Success status
     */
    async storageSet(key, value) {
      const startTime = performance.now();
      try {
        if (!this.initialized) {
          await this.init();
        }

        if (!this.initialized) {
          debugLog('error', 'Cannot set to storage - not initialized', { key });
          return false;
        }

        const stringValue = String(value);
        debugLog('info', 'VK Storage SET request', {
          key,
          valueLength: stringValue.length
        });

        await vkBridge.send('VKWebAppStorageSet', {
          key: key,
          value: stringValue
        });

        const duration = (performance.now() - startTime).toFixed(2);
        debugLog('info', 'VK Storage SET success', {
          key,
          valueLength: stringValue.length,
          duration: `${duration}ms`
        });
        return true;
      } catch (error) {
        const duration = (performance.now() - startTime).toFixed(2);
        debugLog('error', 'VK Storage SET failed', {
          key,
          valueLength: value ? String(value).length : 0,
          error: error.message,
          stack: error.stack,
          duration: `${duration}ms`
        });
        return false;
      }
    },

    /**
     * Get multiple keys from VK Storage
     * @param {string[]} keys - Array of storage keys
     * @returns {Promise<Object>} Object with key-value pairs
     */
    async storageGetMultiple(keys) {
      const startTime = performance.now();
      try {
        if (!this.initialized) {
          await this.init();
        }

        if (!this.initialized) {
          debugLog('error', 'Cannot get from storage - not initialized', {
            keysCount: keys.length
          });
          return {};
        }

        debugLog('info', 'VK Storage GET MULTIPLE request', {
          keys,
          keysCount: keys.length
        });

        const result = await vkBridge.send('VKWebAppStorageGet', {
          keys: keys
        });

        const data = {};
        let totalValueLength = 0;
        if (result && result.keys) {
          result.keys.forEach(item => {
            data[item.key] = item.value;
            totalValueLength += item.value ? item.value.length : 0;
          });
        }

        const duration = (performance.now() - startTime).toFixed(2);
        debugLog('info', 'VK Storage GET MULTIPLE success', {
          requestedKeys: keys.length,
          returnedKeys: Object.keys(data).length,
          totalValueLength,
          duration: `${duration}ms`
        });
        return data;
      } catch (error) {
        const duration = (performance.now() - startTime).toFixed(2);
        debugLog('error', 'VK Storage GET MULTIPLE failed', {
          keys,
          keysCount: keys.length,
          error: error.message,
          stack: error.stack,
          duration: `${duration}ms`
        });
        return {};
      }
    },

    /**
     * Initialize and preload ads
     * @returns {Promise<boolean>} Success status
     */
    async initAds() {
      try {
        if (this.adsInitialized) {
          debugLog('info', 'Ads already initialized');
          return true;
        }

        if (!this.initialized) {
          await this.init();
        }

        if (!this.initialized) {
          debugLog('error', 'Cannot init ads - VK Bridge not initialized');
          return false;
        }

        debugLog('info', 'Checking native ads availability');
        const result = await vkBridge.send('VKWebAppCheckNativeAds', {
          ad_format: 'reward' // Реклама за вознаграждение
        });

        debugLog('info', 'Native ads check result', result);
        this.adsInitialized = result && result.result;
        return this.adsInitialized;
      } catch (error) {
        debugLog('error', 'Error checking native ads', {
          error: error.message,
          stack: error.stack
        });
        return false;
      }
    },

    /**
     * Show interstitial ad
     * @returns {Promise<boolean>} Success status
     */
    async showInterstitialAd() {
      try {
        if (!this.initialized) {
          await this.init();
        }

        if (!this.initialized) {
          debugLog('error', 'Cannot show ad - VK Bridge not initialized');
          return false;
        }

        debugLog('info', 'Showing interstitial ad');
        const result = await vkBridge.send('VKWebAppShowNativeAds', {
          ad_format: 'interstitial'
        });

        debugLog('info', 'Interstitial ad result', result);
        return result && result.result;
      } catch (error) {
        debugLog('error', 'Error showing interstitial ad', {
          error: error.message,
          stack: error.stack
        });
        return false;
      }
    },

    /**
     * Show reward ad
     * @returns {Promise<boolean>} Success status
     */
    async showRewardAd() {
      try {
        if (!this.initialized) {
          await this.init();
        }

        if (!this.initialized) {
          debugLog('error', 'Cannot show ad - VK Bridge not initialized');
          return false;
        }

        debugLog('info', 'Showing reward ad');
        const result = await vkBridge.send('VKWebAppShowNativeAds', {
          ad_format: 'reward'
        });

        debugLog('info', 'Reward ad result', result);
        return result && result.result;
      } catch (error) {
        debugLog('error', 'Error showing reward ad', {
          error: error.message,
          stack: error.stack
        });
        return false;
      }
    }
  };

  // Auto-initialize when script loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      debugLog('info', 'DOM loaded, initializing VK Bridge');
      window.VKBridgeWrapper.init().then(function(success) {
        if (success) {
          debugLog('info', 'VK Bridge ready');
          // Preload ads after initialization
          window.VKBridgeWrapper.initAds();
        }
      });
    });
  } else {
    debugLog('info', 'DOM already loaded, initializing VK Bridge');
    window.VKBridgeWrapper.init().then(function(success) {
      if (success) {
        debugLog('info', 'VK Bridge ready');
        // Preload ads after initialization
        window.VKBridgeWrapper.initAds();
      }
    });
  }
})();
