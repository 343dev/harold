/**
 * Утилита для удаления ANSI escape кодов из текста (CommonJS версия)
 * Используется для очистки вывода Harold от цветовых кодов перед публикацией в GitHub комментариях
 */

/**
 * Регулярное выражение для поиска ANSI escape последовательностей
 */
const ANSI_REGEX = /\u001B\[[\d;]*[A-Za-z]/g;
const EXTENDED_ANSI_REGEX = /\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

/**
 * Удаляет все ANSI escape коды из текста
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
 * Основная функция для очистки вывода Harold
 * @param {string} haroldOutput - Вывод команды harold diff
 * @returns {string} Очищенный вывод готовый для GitHub комментария
 */
function cleanHaroldOutput(haroldOutput) {
	if (typeof haroldOutput !== 'string') {
		return String(haroldOutput || 'No output available');
	}

	// Удаляем ANSI коды и нормализуем
	let cleaned = stripAnsiAndNormalize(haroldOutput);

	// Специальная обработка для таблиц Harold
	cleaned = cleaned
		.replaceAll(/^[\s—]*$/gm, '') // Удаляем строки только с разделителями
		.replaceAll(/\n{3,}/g, '\n\n') // Ограничиваем пустые строки
		.trim(); // Удаляем пробелы в начале и конце

	return cleaned || 'No changes detected';
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

// CommonJS экспорт
module.exports = {
	stripAllAnsi,
	stripAnsiAndNormalize,
	hasAnsiCodes,
	cleanHaroldOutput,

	// Алиасы для удобства
	strip: stripAllAnsi,
	clean: cleanHaroldOutput,
	normalize: stripAnsiAndNormalize,
};

// Если файл запущен напрямую, показываем пример использования
if (require.main === module) {
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
