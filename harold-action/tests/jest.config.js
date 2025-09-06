/**
 * Jest конфигурация для тестирования Harold Action
 */

module.exports = {
	// Тестовая среда
	testEnvironment: 'node',

	// Корневая директория для тестов
	rootDir: '../',

	// Паттерны для поиска тестовых файлов
	testMatch: [
		'<rootDir>/tests/**/*.test.js',
		'<rootDir>/tests/**/*.spec.js',
	],

	// Директории для поиска модулей
	moduleDirectories: [
		'node_modules',
		'<rootDir>',
		'<rootDir>/tests',
	],

	// Покрытие кода
	collectCoverageFrom: [
		'utils/**/*.{js,cjs}',
		'scripts/**/*.{js,cjs}',
		'!**/node_modules/**',
		'!**/tests/**',
		'!**/coverage/**',
	],

	// Директория для отчетов о покрытии
	coverageDirectory: '<rootDir>/tests/coverage',

	// Форматы отчетов о покрытии
	coverageReporters: [
		'text',
		'text-summary',
		'lcov',
		'html',
		'json',
	],

	// Пороги покрытия кода
	coverageThreshold: {
		global: {
			branches: 70,
			functions: 80,
			lines: 80,
			statements: 80,
		},
	},

	// Настройка для отображения результатов
	verbose: true,

	// Очистка моков между тестами
	clearMocks: true,

	// Восстановление моков после каждого теста
	restoreMocks: true,

	// Таймаут для тестов (в миллисекундах)
	testTimeout: 10_000,

	// Настройка для работы с ES модулями и CommonJS
	extensionsToTreatAsEsm: [],

	// Трансформация файлов (если нужно)
	transform: {},

	// Файлы для настройки тестовой среды
	setupFilesAfterEnv: [
		'<rootDir>/tests/jest.setup.js',
	],

	// Игнорируемые паттерны
	testPathIgnorePatterns: [
		'/node_modules/',
		'/coverage/',
		'/dist/',
	],

	// Дополнительные настройки для моков
	moduleNameMapping: {},

	// Настройки для отображения ошибок
	errorOnDeprecated: true,

	// Настройки для параллельного выполнения
	maxWorkers: '50%',

	// Дополнительные опции
	bail: false, // Не останавливаться на первой ошибке
	forceExit: false, // Не принудительно завершать процесс
	detectOpenHandles: true, // Обнаруживать незакрытые handles

	// Настройки для отчетов
	reporters: [
		'default',
		[
			'jest-html-reporters',
			{
				publicPath: '<rootDir>/tests/coverage/html-report',
				filename: 'test-report.html',
				expand: true,
				hideIcon: false,
				pageTitle: 'Harold Action Test Report',
			},
		],
	],
};
