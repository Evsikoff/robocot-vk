# VK Bridge Integration

Этот документ описывает интеграцию VK Bridge в игру Robocot.

## Реализованные функции

### 1. Подключение VK Bridge SDK
- ✅ Добавлена библиотека VK Bridge через CDN в `index.html`
- ✅ Создан модуль `scripts/vk-bridge-integration.js` для работы с VK Bridge

### 2. Инициализация VK Bridge
- ✅ Автоматическая инициализация при загрузке страницы через `VKWebAppInit`
- ✅ Логирование процесса инициализации в консоль

### 3. Работа с VK Storage

#### Загрузка прогресса
- ✅ Приоритетная загрузка данных из VK Storage
- ✅ Fallback на localStorage при недоступности VK Storage
- ✅ Прозрачная интеграция через модифицированный `safeStorage.getItem()`

#### Сохранение прогресса
- ✅ Одновременное сохранение в VK Storage и localStorage
- ✅ Синхронизация данных между хранилищами
- ✅ Обработка ошибок при недоступности VK Storage

### 4. Реклама

#### Предзагрузка рекламы
- ✅ Автоматическая предзагрузка рекламы за вознаграждение при инициализации
- ✅ Проверка доступности рекламы через `VKWebAppCheckNativeAds`

#### Межэкранная реклама
- ✅ Показ межэкранной рекламы при нажатии на кнопку "Далее" (класс `_4e75b`)
- ✅ Cooldown механизм (1 минута между показами)
- ✅ Graceful degradation при недоступности рекламы

## Архитектура

### Файлы
- `index.html` - подключение VK Bridge SDK
- `scripts/vk-bridge-integration.js` - основной модуль интеграции VK Bridge
- `scripts/custom.js` - интеграция VK Storage и рекламы в игровую логику

### Основные компоненты

#### VKBridgeWrapper
Глобальный объект, предоставляющий API для работы с VK Bridge:

```javascript
// Инициализация
await window.VKBridgeWrapper.init();

// Получение данных из VK Storage
const value = await window.VKBridgeWrapper.storageGet(key);

// Сохранение данных в VK Storage
await window.VKBridgeWrapper.storageSet(key, value);

// Инициализация рекламы
await window.VKBridgeWrapper.initAds();

// Показ межэкранной рекламы
await window.VKBridgeWrapper.showInterstitialAd();

// Показ рекламы за вознаграждение
await window.VKBridgeWrapper.showRewardAd();
```

#### safeStorage
Обертка над localStorage с интеграцией VK Storage:

```javascript
// Все вызовы автоматически работают с VK Storage и localStorage
const value = await safeStorage.getItem(localStorage, 'key');
await safeStorage.setItem(localStorage, 'key', 'value');
```

## Логирование

Все компоненты пишут подробные логи в консоль с префиксами:
- `[VK Bridge Integration]` - события VK Bridge
- `[Robocot WebView]` - события игры

## Тестирование

### Локальное тестирование
1. Откройте игру в браузере
2. Откройте консоль разработчика (F12)
3. Проверьте наличие логов инициализации VK Bridge
4. VK Bridge не будет полностью работать вне VK окружения

### Тестирование в VK
1. Загрузите игру на VK Mini Apps
2. Проверьте инициализацию VK Bridge в консоли
3. Проверьте сохранение/загрузку прогресса
4. Проверьте показ рекламы при нажатии "Далее"

## Обработка ошибок

Все функции VK Bridge обрабатывают ошибки gracefully:
- Ошибки логируются в консоль
- При недоступности VK Storage используется localStorage
- При недоступности рекламы игра продолжает работать без рекламы

## Совместимость

- ✅ Работает в VK Mini Apps
- ✅ Работает в обычном браузере (с fallback на localStorage)
- ✅ Работает в Android WebView
- ✅ Работает без VK Bridge SDK (fallback режим)
