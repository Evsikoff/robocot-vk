/**
 * VK Bridge Integration Module
 * Provides integration with VK Bridge for storage and ads
 */
(function() {
  'use strict';

  // Debug logging
  function debugLog(message, data) {
    console.log('[VK Bridge Integration]', message, data || '');
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
          debugLog('Already initialized');
          return true;
        }

        if (typeof vkBridge === 'undefined') {
          debugLog('VK Bridge not loaded');
          return false;
        }

        debugLog('Initializing VK Bridge');
        await vkBridge.send('VKWebAppInit');
        this.initialized = true;
        debugLog('VK Bridge initialized successfully');
        return true;
      } catch (error) {
        debugLog('Failed to initialize VK Bridge:', error);
        return false;
      }
    },

    /**
     * Get data from VK Storage
     * @param {string} key - Storage key
     * @returns {Promise<string|null>} Stored value or null
     */
    async storageGet(key) {
      try {
        if (!this.initialized) {
          await this.init();
        }

        if (!this.initialized) {
          debugLog('Cannot get from storage - not initialized');
          return null;
        }

        debugLog('Getting from VK Storage:', key);
        const result = await vkBridge.send('VKWebAppStorageGet', {
          keys: [key]
        });

        if (result && result.keys && result.keys.length > 0) {
          const value = result.keys[0].value;
          debugLog('Got from VK Storage:', { key, value });
          return value;
        }

        debugLog('No value in VK Storage for key:', key);
        return null;
      } catch (error) {
        debugLog('Error getting from VK Storage:', error);
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
      try {
        if (!this.initialized) {
          await this.init();
        }

        if (!this.initialized) {
          debugLog('Cannot set to storage - not initialized');
          return false;
        }

        debugLog('Setting to VK Storage:', { key, value });
        await vkBridge.send('VKWebAppStorageSet', {
          key: key,
          value: String(value)
        });

        debugLog('Successfully set to VK Storage:', key);
        return true;
      } catch (error) {
        debugLog('Error setting to VK Storage:', error);
        return false;
      }
    },

    /**
     * Get multiple keys from VK Storage
     * @param {string[]} keys - Array of storage keys
     * @returns {Promise<Object>} Object with key-value pairs
     */
    async storageGetMultiple(keys) {
      try {
        if (!this.initialized) {
          await this.init();
        }

        if (!this.initialized) {
          debugLog('Cannot get from storage - not initialized');
          return {};
        }

        debugLog('Getting multiple from VK Storage:', keys);
        const result = await vkBridge.send('VKWebAppStorageGet', {
          keys: keys
        });

        const data = {};
        if (result && result.keys) {
          result.keys.forEach(item => {
            data[item.key] = item.value;
          });
        }

        debugLog('Got multiple from VK Storage:', data);
        return data;
      } catch (error) {
        debugLog('Error getting multiple from VK Storage:', error);
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
          debugLog('Ads already initialized');
          return true;
        }

        if (!this.initialized) {
          await this.init();
        }

        if (!this.initialized) {
          debugLog('Cannot init ads - VK Bridge not initialized');
          return false;
        }

        debugLog('Checking native ads availability');
        const result = await vkBridge.send('VKWebAppCheckNativeAds', {
          ad_format: 'reward' // Реклама за вознаграждение
        });

        debugLog('Native ads check result:', result);
        this.adsInitialized = result && result.result;
        return this.adsInitialized;
      } catch (error) {
        debugLog('Error checking native ads:', error);
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
          debugLog('Cannot show ad - VK Bridge not initialized');
          return false;
        }

        debugLog('Showing interstitial ad');
        const result = await vkBridge.send('VKWebAppShowNativeAds', {
          ad_format: 'interstitial'
        });

        debugLog('Interstitial ad result:', result);
        return result && result.result;
      } catch (error) {
        debugLog('Error showing interstitial ad:', error);
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
          debugLog('Cannot show ad - VK Bridge not initialized');
          return false;
        }

        debugLog('Showing reward ad');
        const result = await vkBridge.send('VKWebAppShowNativeAds', {
          ad_format: 'reward'
        });

        debugLog('Reward ad result:', result);
        return result && result.result;
      } catch (error) {
        debugLog('Error showing reward ad:', error);
        return false;
      }
    }
  };

  // Auto-initialize when script loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      debugLog('DOM loaded, initializing VK Bridge');
      window.VKBridgeWrapper.init().then(function(success) {
        if (success) {
          debugLog('VK Bridge ready');
          // Preload ads after initialization
          window.VKBridgeWrapper.initAds();
        }
      });
    });
  } else {
    debugLog('DOM already loaded, initializing VK Bridge');
    window.VKBridgeWrapper.init().then(function(success) {
      if (success) {
        debugLog('VK Bridge ready');
        // Preload ads after initialization
        window.VKBridgeWrapper.initAds();
      }
    });
  }
})();
