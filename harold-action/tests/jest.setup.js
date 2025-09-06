/**
 * Jest setup файл для Harold Action тестов
 * Настраивает глобальные моки и утилиты для тестирования
 */

// Глобальные моки для Node.js модулей
global.console = {
	...console,
	// Отключаем логи в тестах, если не нужны
	log: jest.fn(),
	debug: jest.fn(),
	info: jest.fn(),
	warn: jest.fn(),
	error: jest.fn(),
};

// Мок для process.env
const originalEnvironment = process.env;

beforeEach(() => {
	// Сбрасываем process.env перед каждым тестом
	jest.resetModules();
	process.env = { ...originalEnvironment };
});

afterEach(() => {
	// Восстанавливаем оригинальный process.env
	process.env = originalEnvironment;
});

// Глобальные утилиты для тестов
global.createMockGitHubContext = (overrides = {}) => ({
	repo: {
		owner: 'test-owner',
		repo: 'test-repo',
		...overrides.repo,
	},
	payload: {
		pull_request: {
			number: 123,
			base: {
				sha: 'abc1234567890',
				ref: 'main',
			},
			head: {
				sha: 'def0987654321',
				ref: 'feature-branch',
			},
			...overrides.pull_request,
		},
		...overrides.payload,
	},
	...overrides,
});

global.createMockGitHubAPI = (overrides = {}) => ({
	rest: {
		issues: {
			listComments: jest.fn().mockResolvedValue({ data: [] }),
			createComment: jest.fn().mockResolvedValue({ data: { id: 456 } }),
			updateComment: jest.fn().mockResolvedValue({ data: { id: 456 } }),
			...overrides.issues,
		},
		...overrides.rest,
	},
	...overrides,
});

global.createMockCore = (overrides = {}) => ({
	info: jest.fn(),
	debug: jest.fn(),
	warning: jest.fn(),
	error: jest.fn(),
	setFailed: jest.fn(),
	setOutput: jest.fn(),
	exportVariable: jest.fn(),
	...overrides,
});

// Утилиты для создания тестовых данных Harold
global.createHaroldOutput = (options = {}) => {
	const {
		hasChanges = true,
		sizeChange = '+ 1.2 KB',
		gzipChange = '+ 300 B',
		percentage = '+2.5%',
		files = [],
	} = options;

	if (!hasChanges) {
		return 'No changes detected';
	}

	let output = `Snapshots:
 Left: 2/9/2025, 3:45:12 PM • test-project • main (abc1234)
 Right: 2/9/2025, 3:47:23 PM • test-project • feature (def5678)

Total: ${sizeChange} (${gzipChange}) (${percentage})`;

	if (files.length > 0) {
		output += '\n\nFiles:';
		for (const file of files) {
			output += `\n ${file.name}      ${file.sizeChange} (${file.gzipChange}) (${file.percentage})`;
		}
	}

	return output;
};

// Утилиты для работы с ANSI кодами в тестах
global.addAnsiCodes = text =>
	`\u001B[31m${text}\u001B[0m` // Красный цвет
;

global.createColoredHaroldOutput = (options = {}) => {
	const plainOutput = global.createHaroldOutput(options);

	return plainOutput
		.replaceAll('Snapshots:', '\u001B[36mSnapshots:\u001B[39m')
		.replaceAll('Left:', '\u001B[31mLeft:\u001B[39m')
		.replaceAll('Right:', '\u001B[32mRight:\u001B[39m')
		.replaceAll('Total:', '\u001B[36mTotal:\u001B[39m')
		.replaceAll('Files:', '\u001B[36mFiles:\u001B[39m')
		.replaceAll('+', '\u001B[32m+\u001B[39m')
		.replaceAll('-', '\u001B[31m-\u001B[39m');
};

// Настройка таймаутов для асинхронных тестов
jest.setTimeout(10_000);

// Подавление предупреждений в тестах
const originalWarn = console.warn;
console.warn = (...arguments_) => {
	// Игнорируем определенные предупреждения
	if (arguments_[0] && arguments_[0].includes && arguments_[0].includes('deprecated')) {
		return;
	}

	originalWarn.apply(console, arguments_);
};

// Настройка для работы с временными файлами в тестах
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

global.createTempFile = (content, filename = 'temp-file.txt') => {
	const tempDir = os.tmpdir();
	const temporaryFile = path.join(tempDir, `harold-test-${Date.now()}-${filename}`);
	fs.writeFileSync(temporaryFile, content);
	return temporaryFile;
};

global.cleanupTempFile = filePath => {
	try {
		if (fs.existsSync(filePath)) {
			fs.unlinkSync(filePath);
		}
	} catch {
		// Игнорируем ошибки очистки в тестах
	}
};

// Мок для GitHub Actions core
jest.mock('@actions/core', () => ({
	info: jest.fn(),
	debug: jest.fn(),
	warning: jest.fn(),
	error: jest.fn(),
	setFailed: jest.fn(),
	setOutput: jest.fn(),
	exportVariable: jest.fn(),
	getInput: jest.fn(),
	getBooleanInput: jest.fn(),
	getMultilineInput: jest.fn(),
}), { virtual: true });

// Мок для GitHub Actions github
jest.mock('@actions/github', () => ({
	context: {
		repo: {
			owner: 'test-owner',
			repo: 'test-repo',
		},
		payload: {
			pull_request: {
				number: 123,
				base: { sha: 'abc123', ref: 'main' },
				head: { sha: 'def456', ref: 'feature' },
			},
		},
	},
	getOctokit: jest.fn(() => global.createMockGitHubAPI()),
}), { virtual: true });

// Настройка для тестирования с различными версиями Node.js
if ((process.version.startsWith('v14') || process.version.startsWith('v16')) // Полифилл для replaceAll в старых версиях Node.js
  && !String.prototype.replaceAll) {
	String.prototype.replaceAll = function (search, replace) {
		return this.split(search).join(replace);
	};
}

// Глобальная обработка необработанных промисов в тестах
process.on('unhandledRejection', (reason, promise) => {
	console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Настройка для детального логирования в режиме отладки
if (process.env.DEBUG_TESTS) {
	global.console = console; // Включаем все логи
}

console.log('Jest setup completed for Harold Action tests');
