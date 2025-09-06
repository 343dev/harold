/**
 * Утилита для удаления ANSI escape кодов из текста
 * Используется для очистки вывода Harold от цветовых кодов перед публикацией в GitHub комментариях
 */

/**
 * Регулярное выражение для поиска ANSI escape последовательностей
 * Покрывает:
 * - Цветовые коды (foreground/background)
 * - Стили текста (bold, italic, underline, etc.)
 * - Курсорные команды
 * - Очистка экрана
 * - Другие управляющие последовательности
 */
const ANSI_REGEX = /\u001B\[[\d;]*[A-Za-z]/g;

/**
 * Расширенное регулярное выражение для более сложных ANSI последовательностей
 * Включает:
 * - OSC (Operating System Command) последовательности
 * - DCS (Device Control String) последовательности
 * - APC (Application Program Command) последовательности
 */
const EXTENDED_ANSI_REGEX = /\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

/**
 * Удаляет базовые ANSI escape коды из текста
 * @param {string} text - Исходный текст с ANSI кодами
 * @returns {string} Очищенный текст без ANSI кодов
 */
function stripBasicAnsi(text) {
	if (typeof text !== 'string') {
		return String(text || '');
	}

	return text.replaceAll(ANSI_REGEX, '');
}

/**
 * Удаляет все ANSI escape коды из текста (включая расширенные)
 * @param {string} text - Исходный текст с ANSI кодами
 * @returns {string} Очищенный текст без ANSI кодов
 */
function stripAllAnsi(text) {
	if (typeof text !== 'string') {
		return String(text || '');
	}

	// Сначала удаляем расширенные последовательности
	let cleaned = text.replaceAll(EXTENDED_ANSI_REGEX, '');

	// Затем удаляем базовые последовательности
	cleaned = cleaned.replaceAll(ANSI_REGEX, '');

	return cleaned;
}

/**
 * Удаляет ANSI коды и нормализует пробелы
 * @param {string} text - Исходный текст
 * @returns {string} Очищенный и нормализованный текст
 */
function stripAnsiAndNormalize(text) {
	if (typeof text !== 'string') {
		return String(text || '');
	}

	let cleaned = stripAllAnsi(text);

	// Нормализуем пробелы и переносы строк
	cleaned = cleaned
		.replaceAll('\r\n', '\n') // Нормализуем переносы строк Windows
		.replaceAll('\r', '\n') // Нормализуем переносы строк Mac
		.replaceAll('\t', '    ') // Заменяем табы на пробелы
		.replaceAll(/ +$/gm, '') // Удаляем trailing пробелы
		.replaceAll(/\n{3,}/g, '\n\n'); // Ограничиваем множественные переносы

	return cleaned;
}

/**
 * Проверяет, содержит ли текст ANSI коды
 * @param {string} text - Текст для проверки
 * @returns {boolean} true если содержит ANSI коды
 */
function hasAnsiCodes(text) {
	if (typeof text !== 'string') {
		return false;
	}

	return ANSI_REGEX.test(text) || EXTENDED_ANSI_REGEX.test(text);
}

/**
 * Обрабатывает многострочный текст, удаляя ANSI коды из каждой строки
 * @param {string} text - Многострочный текст
 * @returns {string} Очищенный многострочный текст
 */
function stripAnsiFromLines(text) {
	if (typeof text !== 'string') {
		return String(text || '');
	}

	return text
		.split('\n')
		.map(line => stripAllAnsi(line))
		.join('\n');
}

/**
 * Основная функция для очистки вывода Harold
 * Оптимизирована для формата вывода Harold
 * @param {string} haroldOutput - Вывод команды harold diff
 * @returns {string} Очищенный вывод готовый для GitHub комментария
 */
function cleanHaroldOutput(haroldOutput) {
	if (typeof haroldOutput !== 'string') {
		return String(haroldOutput || 'No output available');
	}

	// Удаляем ANSI коды и нормализуем
	let cleaned = stripAnsiAndNormalize(haroldOutput);

	// Специальная обработка для таблиц Harold (сохраняем структуру)
	cleaned = cleaned
		.replaceAll(/^[\s—]*$/gm, '') // Удаляем строки только с разделителями
		.replaceAll(/\n{3,}/g, '\n\n') // Ограничиваем пустые строки
		.trim(); // Удаляем пробелы в начале и конце

	return cleaned || 'No changes detected';
}

/**
 * Утилита для тестирования - создает текст с ANSI кодами
 * @param {string} text - Обычный текст
 * @returns {string} Текст с ANSI кодами для тестирования
 */
function addTestAnsiCodes(text) {
	return `\u001B[31m${text}\u001B[0m`; // Красный цвет
}

// Экспорт функций (поддержка CommonJS и ES модулей)
const ansiStripUtils = {
	stripBasicAnsi,
	stripAllAnsi,
	stripAnsiAndNormalize,
	stripAnsiFromLines,
	hasAnsiCodes,
	cleanHaroldOutput,
	addTestAnsiCodes, // Для тестирования

	// Алиасы для удобства
	strip: stripAllAnsi,
	clean: cleanHaroldOutput,
	normalize: stripAnsiAndNormalize,
};

// Поддержка CommonJS
if (typeof module !== 'undefined' && module.exports) {
	module.exports = ansiStripUtils;
}

// Поддержка ES модулей
if (typeof globalThis !== 'undefined') {
	globalThis.ansiStripUtils = ansiStripUtils;
}

// Если файл запущен напрямую, показываем пример использования
function runDemo() {
	const testText = '\u001B[31mRed text\u001B[0m and \u001B[32mgreen text\u001B[0m';
	console.log('Original:', JSON.stringify(testText));
	console.log('Cleaned:', JSON.stringify(stripAllAnsi(testText)));

	const haroldExample = `\u001B[36mSnapshots:\u001B[39m
 \u001B[31mLeft:\u001B[39m 12/2/2025 3:45:12 PM • my-project • main
 \u001B[32mRight:\u001B[39m 12/2/2025 3:47:23 PM • my-project • feature`;

	console.log('\nHarold example:');
	console.log('Original:', JSON.stringify(haroldExample));
	console.log('Cleaned:', JSON.stringify(cleanHaroldOutput(haroldExample)));
}

// Проверяем если файл запущен напрямую
if (typeof require !== 'undefined' && require.main === module) {
	runDemo();
}

// Для ES модулей - запускаем демо если это основной файл
if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].endsWith('ansi-strip.js')) {
	runDemo();
}
