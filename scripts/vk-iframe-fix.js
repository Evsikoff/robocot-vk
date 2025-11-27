/**
 * VK iframe compatibility fix
 * Prevents "unload is not allowed" Permissions Policy violations
 *
 * VK Games uses strict Permissions Policy in iframe that blocks 'unload' event.
 * This script intercepts attempts to add 'unload' or 'beforeunload' listeners
 * and replaces them with allowed alternatives like 'pagehide' or 'visibilitychange'.
 */
(function() {
  'use strict';

  console.log('[VK iframe Fix] Initializing unload event compatibility layer');

  // Store original addEventListener
  const originalAddEventListener = EventTarget.prototype.addEventListener;
  const originalRemoveEventListener = EventTarget.prototype.removeEventListener;

  // Map to track unload listeners and their pagehide equivalents
  const listenerMap = new WeakMap();

  /**
   * Intercept addEventListener to replace unload/beforeunload with pagehide
   */
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    // Check if it's an unload or beforeunload event
    if (type === 'unload' || type === 'beforeunload') {
      console.warn(
        '[VK iframe Fix] Intercepted ' + type + ' event listener. ' +
        'Replacing with "pagehide" to comply with VK Permissions Policy.'
      );

      // Store mapping for later removal
      if (!listenerMap.has(this)) {
        listenerMap.set(this, new Map());
      }
      const targetMap = listenerMap.get(this);
      targetMap.set(listener, { originalType: type, options: options });

      // Use pagehide instead of unload (it's allowed and works similarly)
      return originalAddEventListener.call(this, 'pagehide', listener, options);
    }

    // For all other events, use original addEventListener
    return originalAddEventListener.call(this, type, listener, options);
  };

  /**
   * Intercept removeEventListener to handle our replaced listeners
   */
  EventTarget.prototype.removeEventListener = function(type, listener, options) {
    // Check if we previously replaced this listener
    if ((type === 'unload' || type === 'beforeunload') && listenerMap.has(this)) {
      const targetMap = listenerMap.get(this);
      if (targetMap.has(listener)) {
        console.log('[VK iframe Fix] Removing replaced ' + type + ' listener');
        targetMap.delete(listener);
        return originalRemoveEventListener.call(this, 'pagehide', listener, options);
      }
    }

    // For all other events, use original removeEventListener
    return originalRemoveEventListener.call(this, type, listener, options);
  };

  // Also intercept direct property assignments (less common but possible)
  const windowProto = Object.getPrototypeOf(window);
  const originalUnloadDescriptor = Object.getOwnPropertyDescriptor(windowProto, 'onunload');
  const originalBeforeUnloadDescriptor = Object.getOwnPropertyDescriptor(windowProto, 'onbeforeunload');

  if (originalUnloadDescriptor) {
    Object.defineProperty(window, 'onunload', {
      get: function() {
        return this._pagehideHandler || null;
      },
      set: function(handler) {
        console.warn('[VK iframe Fix] Intercepted window.onunload assignment. Using onpagehide instead.');
        this._pagehideHandler = handler;
        if (handler) {
          window.addEventListener('pagehide', handler);
        }
      },
      configurable: true
    });
  }

  if (originalBeforeUnloadDescriptor) {
    Object.defineProperty(window, 'onbeforeunload', {
      get: function() {
        return this._pageHideBeforeHandler || null;
      },
      set: function(handler) {
        console.warn('[VK iframe Fix] Intercepted window.onbeforeunload assignment. Using visibilitychange instead.');
        this._pageHideBeforeHandler = handler;
        if (handler) {
          document.addEventListener('visibilitychange', function() {
            if (document.visibilityState === 'hidden') {
              handler.call(window);
            }
          });
        }
      },
      configurable: true
    });
  }

  console.log('[VK iframe Fix] Compatibility layer initialized successfully');

  // Signal that the fix is active
  window.__VK_IFRAME_FIX_ACTIVE__ = true;
})();
