# Harold Action Tests

Этот каталог содержит unit тесты для Harold Action утилит и функций.

## Структура тестов

```
tests/
├── package.json              # Зависимости для тестирования
├── jest.config.js           # Конфигурация Jest
├── jest.setup.js            # Настройка тестовой среды
├── run-tests.sh             # Скрипт запуска тестов
├── ansi-strip.test.js       # Тесты утилиты очистки ANSI кодов
├── comment-formatting.test.js # Тесты форматирования комментариев
├── threshold-analysis.test.js # Тесты анализа пороговых значений
├── error-handling.test.js   # Тесты обработки ошибок
├── github-integration.test.js # Тесты интеграции с GitHub Actions
└── README.md               # Этот файл
```

## Запуск тестов

### Быстрый запуск

```bash
# Запуск всех тестов
./run-tests.sh

# Или через npm
cd tests
npm test
```

### Различные режимы

```bash
cd tests

# Запуск с покрытием кода
npm run test:coverage

# Запуск в режиме наблюдения
npm run test:watch

# Запуск конкретного теста
npm test ansi-strip.test.js

# Запуск с подробным выводом
npm test -- --verbose
```

## Покрытие кода

Тесты настроены на достижение минимального покрытия:
- **Ветки (branches)**: 80%
- **Функции (functions)**: 80%
- **Строки (lines)**: 80%
- **Утверждения (statements)**: 80%

Отчет о покрытии генерируется в директории `coverage/`:
- `coverage/lcov-report/index.html` - HTML отчет
- `coverage/lcov.info` - LCOV формат для CI/CD

## Тестируемые компоненты

### 1. ANSI Strip Utility (`ansi-strip.test.js`)

Тестирует функцию очистки ANSI escape кодов:
- ✅ Удаление базовых цветовых кодов
- ✅ Обработка сложных ANSI последовательностей
- ✅ Сохранение текста без ANSI кодов
- ✅ Обработка реального вывода Harold
- ✅ Граничные случаи и производительность

### 2. Comment Formatting (`comment-formatting.test.js`)

Тестирует функции форматирования комментариев:
- ✅ Форматирование комментариев с изменениями и без
- ✅ Парсинг вывода Harold
- ✅ Обработка размеров файлов (B, KB, MB, GB)
- ✅ Анализ пороговых значений
- ✅ Обработка специальных символов

### 3. Threshold Analysis (`threshold-analysis.test.js`)

Тестирует логику анализа пороговых значений:
- ✅ Проверка размерных порогов
- ✅ Проверка процентных порогов
- ✅ Комбинированный анализ
- ✅ Реальные сценарии использования
- ✅ Обработка ошибок и валидация

### 4. Error Handling (`error-handling.test.js`)

Тестирует обработку ошибок:
- ✅ Ошибки чтения файлов
- ✅ Ошибки GitHub API
- ✅ Создание fallback комментариев
- ✅ Graceful degradation
- ✅ Валидация входных данных

### 5. GitHub Integration (`github-integration.test.js`)

Тестирует интеграцию с GitHub Actions:
- ✅ Обработка переменных окружения
- ✅ Обработка входных параметров Action
- ✅ Установка выходных параметров
- ✅ Условия выполнения шагов workflow
- ✅ Matrix стратегии

## Моки и утилиты

### Глобальные моки

```javascript
// Мок GitHub Actions core
jest.mock('@actions/core');

// Мок файловой системы
jest.mock('fs');

// Отключение логов в тестах
global.console = { ...console, log: jest.fn() };
```

### Утилиты для тестов

```javascript
// Создание мок вывода Harold
global.createMockHaroldOutput(hasChanges, sizeIncrease, gzipIncrease);

// Создание мок контекста GitHub
global.createMockGitHubContext(prNumber);
```

## Добавление новых тестов

### 1. Создание нового тестового файла

```javascript
/**
 * Unit тесты для новой функциональности
 */

describe('New Feature', () => {
  describe('specific functionality', () => {
    test('should do something', () => {
      // Arrange
      const input = 'test input';

      // Act
      const result = newFunction(input);

      // Assert
      expect(result).toBe('expected output');
    });
  });
});
```

### 2. Структура тестов

Используйте следующую структуру:
- `describe()` для группировки связанных тестов
- `test()` или `it()` для отдельных тест-кейсов
- Паттерн Arrange-Act-Assert для организации кода теста

### 3. Именование тестов

- Используйте описательные имена: `should return error when input is invalid`
- Группируйте по функциональности: `describe('error handling')`
- Тестируйте граничные случаи: `should handle empty input`

## Отладка тестов

### Запуск отдельного теста

```bash
# Запуск конкретного файла
npm test ansi-strip.test.js

# Запуск конкретного теста по имени
npm test -- --testNamePattern="should remove basic ANSI color codes"

# Запуск с отладочной информацией
npm test -- --verbose --no-coverage
```

### Использование debugger

```javascript
test('debug test', () => {
  debugger; // Точка останова
  const result = functionToTest();
  expect(result).toBe('expected');
});
```

Запуск с отладчиком:
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

## CI/CD интеграция

Тесты автоматически запускаются в GitHub Actions:

```yaml
- name: Run unit tests
  run: |
    cd harold-action/tests
    npm install
    npm run test:coverage

- name: Upload coverage reports
  uses: codecov/codecov-action@v3
  with:
    file: harold-action/tests/coverage/lcov.info
```

## Требования к тестам

1. **Покрытие**: Минимум 80% по всем метрикам
2. **Производительность**: Тесты должны выполняться быстро (< 10 сек)
3. **Изоляция**: Каждый тест должен быть независимым
4. **Читаемость**: Понятные имена и структура
5. **Надежность**: Стабильные результаты при повторных запусках

## Полезные ссылки

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [GitHub Actions Testing](https://docs.github.com/en/actions/automating-builds-and-tests/about-continuous-integration)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
