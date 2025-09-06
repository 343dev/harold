/**
 * Скрипт для создания и обновления комментариев в GitHub Pull Request
 * с результатами анализа Harold Bundle Analyzer
 */

const fs = require('node:fs');
const path = require('node:path');

// Импортируем утилиту для очистки ANSI кодов
const { cleanHaroldOutput } = require('../utils/ansi-strip.cjs');

/**
 * Основная функция для обработки комментариев
 * @param {Object} params - Параметры от github-script
 * @param {Object} params.github - GitHub API клиент
 * @param {Object} params.context - Контекст GitHub Actions
 * @param {Object} params.core - Core утилиты GitHub Actions
 * @param {string} params.commentTitle - Заголовок комментария
 * @param {number} params.sizeThreshold - Пороговое значение размера в байтах
 * @param {number} params.percentageThreshold - Пороговое значение в процентах
 * @param {boolean} params.failOnIncrease - Завершить с ошибкой при увеличении
 */
async function main({ github, context, core, commentTitle, sizeThreshold, percentageThreshold, failOnIncrease }) {
	try {
		core.info('Starting Harold comment processing...');

		// Проверяем контекст безопасности
		const securityContext = getSecurityContext();
		core.info(`Security context: fork=${securityContext.isFork}, writeAccess=${securityContext.hasWriteAccess}`);

		// Читаем результаты Harold
		const haroldResult = await readHaroldResults();

		if (!haroldResult) {
			core.setFailed('Failed to read Harold results');
			return;
		}

		core.info(`Harold analysis completed with exit code: ${haroldResult.exitCode}`);

		// Очищаем ANSI коды из вывода
		const cleanOutput = cleanHaroldOutput(haroldResult.output);

		// Формируем комментарий
		const commentBody = formatComment({
			title: commentTitle,
			output: cleanOutput,
			baseCommit: context.payload.pull_request.base.sha.slice(0, 7),
			headCommit: context.payload.pull_request.head.sha.slice(0, 7),
			baseBranch: context.payload.pull_request.base.ref,
			headBranch: context.payload.pull_request.head.ref,
			hasChanges: haroldResult.exitCode === 1,
			timestamp: new Date().toISOString(),
		});

		core.info('Comment formatted successfully');

		// Создаем или обновляем комментарий (с учетом ограничений безопасности)
		await updateOrCreateComment(github, context, commentBody, commentTitle, securityContext);

		// Анализируем результат для fail-on-increase
		if (failOnIncrease && shouldFailOnIncrease(cleanOutput, sizeThreshold, percentageThreshold)) {
			core.setFailed(`Bundle size increased beyond threshold (size: ${sizeThreshold}B, percentage: ${percentageThreshold}%)`);
			return;
		}

		core.info('Harold comment processing completed successfully! 🎉');
	} catch (error) {
		core.error(`Failed to process Harold comment: ${error.message}`);
		core.setFailed(`Harold comment processing failed: ${error.message}`);

		// Пытаемся создать fallback комментарий с информацией об ошибке
		try {
			await createErrorComment(github, context, error, commentTitle);
		} catch (fallbackError) {
			core.error(`Failed to create fallback comment: ${fallbackError.message}`);
		}
	}
}

/**
 * Получает контекст безопасности из переменных окружения
 * @returns {Object} Объект с информацией о безопасности
 */
function getSecurityContext() {
	return {
		isFork: process.env.IS_FORK === 'true',
		hasWriteAccess: process.env.HAS_WRITE_ACCESS === 'true',
		canComment: process.env.CAN_COMMENT === 'true',
		accessLevel: process.env.ACCESS_LEVEL || 'full',
		restrictions: (process.env.FORK_RESTRICTIONS || '').split(' ').filter(Boolean),
	};
}

/**
 * Читает результаты выполнения Harold
 * @returns {Object|null} Объект с результатами или null при ошибке
 */
async function readHaroldResults() {
	const outputFile = 'harold-output.txt';
	const exitCodeFile = 'harold-exit-code.txt';

	try {
		// Проверяем существование файлов
		if (!fs.existsSync(outputFile)) {
			throw new Error(`Harold output file not found: ${outputFile}`);
		}

		if (!fs.existsSync(exitCodeFile)) {
			throw new Error(`Harold exit code file not found: ${exitCodeFile}`);
		}

		// Читаем содержимое файлов
		const output = fs.readFileSync(outputFile, 'utf8');
		const exitCodeString = fs.readFileSync(exitCodeFile, 'utf8').trim();

		// Валидируем exit code
		const exitCode = Number.parseInt(exitCodeString, 10);
		if (isNaN(exitCode)) {
			throw new TypeError(`Invalid exit code: ${exitCodeString}`);
		}

		return {
			output: output || 'No output available',
			exitCode,
			hasChanges: exitCode === 1,
			hasErrors: exitCode > 1,
		};
	} catch (error) {
		console.error('Error reading Harold results:', error.message);
		return null;
	}
}

/**
 * Форматирует комментарий для GitHub PR
 * @param {Object} params - Параметры для форматирования
 * @returns {string} Отформатированный markdown комментарий
 */
function formatComment({ title, output, baseCommit, headCommit, baseBranch, headBranch, hasChanges, timestamp }) {
	const statusEmoji = hasChanges ? '📊' : '✅';
	const statusText = hasChanges ? 'Changes detected' : 'No changes';

	return `## ${statusEmoji} ${title}

**Base:** \`${baseBranch}\` (${baseCommit})
**Head:** \`${headBranch}\` (${headCommit})
**Status:** ${statusText}

\`\`\`
${output}
\`\`\`

---
<sub>Generated by [Harold Action](https://github.com/343dev/harold) • Updated ${new Date(timestamp).toLocaleString()}</sub>`;
}

/**
 * Создает или обновляет комментарий в PR
 * @param {Object} github - GitHub API клиент
 * @param {Object} context - Контекст GitHub Actions
 * @param {string} commentBody - Тело комментария
 * @param {string} commentTitle - Заголовок для поиска существующего комментария
 * @param {Object} securityContext - Контекст безопасности
 */
async function updateOrCreateComment(github, context, commentBody, commentTitle, securityContext) {
	const { owner, repo } = context.repo;
	const issueNumber = context.payload.pull_request.number;

	// Проверяем права доступа и применяем graceful fallback
	if (!securityContext.canComment || securityContext.accessLevel === 'minimal') {
		console.log('⚠️  Limited access detected - using fallback mode');
		console.log('📊 Harold results (would be posted as comment):');
		console.log('---');
		console.log(commentBody);
		console.log('---');

		// Выводим результат в лог вместо создания комментария
		if (securityContext.isFork) {
			console.log('ℹ️  This is expected behavior for fork repositories with limited permissions');
		}

		return;
	}

	try {
		// Ищем существующий комментарий
		const existingComment = await findExistingComment(github, owner, repo, issueNumber, commentTitle);

		if (existingComment) {
			// Обновляем существующий комментарий
			await github.rest.issues.updateComment({
				owner,
				repo,
				comment_id: existingComment.id,
				body: commentBody,
			});

			console.log(`Updated existing comment: ${existingComment.id}`);
		} else {
			// Создаем новый комментарий
			const newComment = await github.rest.issues.createComment({
				owner,
				repo,
				issue_number: issueNumber,
				body: commentBody,
			});

			console.log(`Created new comment: ${newComment.data.id}`);
		}
	} catch (error) {
		// Для fork'ов с ограниченными правами показываем предупреждение вместо ошибки
		if (securityContext.isFork && error.status === 403) {
			console.log('⚠️  Insufficient permissions to create comment in fork - this is expected');
			console.log('📊 Harold results (would be posted as comment):');
			console.log(commentBody);
			return;
		}

		throw new Error(`Failed to update or create comment: ${error.message}`);
	}
}

/**
 * Ищет существующий комментарий Harold в PR
 * @param {Object} github - GitHub API клиент
 * @param {string} owner - Владелец репозитория
 * @param {string} repo - Название репозитория
 * @param {number} issueNumber - Номер PR
 * @param {string} commentTitle - Заголовок для поиска
 * @returns {Object|null} Найденный комментарий или null
 */
async function findExistingComment(github, owner, repo, issueNumber, commentTitle) {
	try {
		const comments = await github.rest.issues.listComments({
			owner,
			repo,
			issue_number: issueNumber,
		});

		// Ищем комментарий с нашим заголовком
		const haroldComment = comments.data.find(comment =>
			comment.body && comment.body.includes(commentTitle),
		);

		return haroldComment || null;
	} catch (error) {
		console.error('Error finding existing comment:', error.message);
		return null;
	}
}

/**
 * Анализирует вывод Harold для определения превышения пороговых значений
 * @param {string} output - Очищенный вывод Harold
 * @param {number} sizeThreshold - Пороговое значение размера в байтах
 * @param {number} percentageThreshold - Пороговое значение в процентах
 * @returns {boolean} true если превышены пороговые значения
 */
function shouldFailOnIncrease(output, sizeThreshold, percentageThreshold) {
	try {
		const analysis = parseHaroldOutput(output);

		if (!analysis.hasChanges) {
			return false; // Нет изменений - не превышаем пороги
		}

		// Проверяем абсолютное увеличение размера
		if (analysis.totalSizeIncrease > sizeThreshold) {
			console.log(`Size threshold exceeded: ${analysis.totalSizeIncrease} > ${sizeThreshold} bytes`);
			return true;
		}

		// Проверяем процентное увеличение
		if (analysis.percentageIncrease > percentageThreshold) {
			console.log(`Percentage threshold exceeded: ${analysis.percentageIncrease}% > ${percentageThreshold}%`);
			return true;
		}

		return false;
	} catch (error) {
		console.error('Error analyzing thresholds:', error.message);
		// В случае ошибки парсинга не блокируем выполнение
		return false;
	}
}

/**
 * Парсит вывод Harold для извлечения числовых данных
 * @param {string} output - Вывод Harold
 * @returns {Object} Объект с данными анализа
 */
function parseHaroldOutput(output) {
	const result = {
		hasChanges: false,
		totalSizeIncrease: 0,
		totalGzipIncrease: 0,
		percentageIncrease: 0,
		fileChanges: [],
	};

	if (!output || typeof output !== 'string') {
		return result;
	}

	// Проверяем, есть ли изменения
	if (output.includes('No changes') || output.includes('Snapshots are equal')) {
		return result;
	}

	result.hasChanges = true;

	// Ищем строку с общими изменениями (Total)
	const totalMatch = output.match(/total.*?([+-][\d,.]+\s*[gkmt]?b).*?\(([+-][\d,.]+\s*[gkmt]?b)\)/i);

	if (totalMatch) {
		result.totalSizeIncrease = parseSizeString(totalMatch[1]);
		result.totalGzipIncrease = parseSizeString(totalMatch[2]);
	}

	// Пытаемся найти процентное изменение
	const percentMatch = output.match(/([+-]?\d+(?:\.\d+)?)\s*%/);
	if (percentMatch) {
		result.percentageIncrease = Math.abs(Number.parseFloat(percentMatch[1]));
	}

	// Парсим изменения отдельных файлов
	result.fileChanges = parseFileChanges(output);

	return result;
}

/**
 * Парсит строку размера в байты
 * @param {string} sizeStr - Строка размера (например, "+1.2 kB", "-500 B")
 * @returns {number} Размер в байтах (положительное число для увеличения)
 */
function parseSizeString(sizeString) {
	if (!sizeString || typeof sizeString !== 'string') {
		return 0;
	}

	// Удаляем пробелы и извлекаем число и единицу измерения
	const match = sizeString.trim().match(/([+-]?)([\d,.]+)\s*([gkmt]?)b?/i);

	if (!match) {
		return 0;
	}

	const sign = match[1] === '-' ? -1 : 1;
	const number = Number.parseFloat(match[2].replaceAll(',', ''));
	const unit = match[3].toUpperCase();

	if (isNaN(number)) {
		return 0;
	}

	// Конвертируем в байты
	let bytes = number;
	switch (unit) {
		case 'K': {
			bytes *= 1024;
			break;
		}

		case 'M': {
			bytes *= 1024 * 1024;
			break;
		}

		case 'G': {
			bytes *= 1024 * 1024 * 1024;
			break;
		}

		case 'T': {
			bytes *= 1024 * 1024 * 1024 * 1024;
			break;
		}
	}

	return Math.abs(bytes * sign); // Возвращаем абсолютное значение для проверки порогов
}

/**
 * Парсит изменения отдельных файлов из вывода Harold
 * @param {string} output - Вывод Harold
 * @returns {Array} Массив объектов с изменениями файлов
 */
function parseFileChanges(output) {
	const changes = [];

	// Ищем секцию "Diff by files"
	const filesSectionMatch = output.match(/Diff by files:(.*?)(?:\n\n|$)/s);

	if (!filesSectionMatch) {
		return changes;
	}

	const filesSection = filesSectionMatch[1];

	// Парсим каждую строку с изменением файла
	const fileLines = filesSection.split('\n').filter(line => line.trim());

	for (const line of fileLines) {
		// Формат: "+ filename: +1.2 kB (+300 B)" или "m filename: +500 B (+100 B)"
		const match = line.match(/([+m-])\s+(.+?):\s*([+-][\d,.]+\s*[GKMT]?B).*?\(([+-][\d,.]+\s*[GKMT]?B)\)/);

		if (match) {
			const [, type, filename, sizeChange, gzipChange] = match;

			changes.push({
				type, // '+' = added, 'm' = modified, '-' = removed
				filename: filename.trim(),
				sizeChange: parseSizeString(sizeChange),
				gzipChange: parseSizeString(gzipChange),
			});
		}
	}

	return changes;
}

/**
 * Форматирует размер в байтах в читаемый вид
 * @param {number} bytes - Размер в байтах
 * @returns {string} Отформатированный размер
 */
function formatBytes(bytes) {
	if (bytes === 0) {
		return '0 B';
	}

	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const index = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));

	return Number.parseFloat((bytes / k ** index).toFixed(1)) + ' ' + sizes[index];
}

/**
 * Создает комментарий об ошибке
 * @param {Object} github - GitHub API клиент
 * @param {Object} context - Контекст GitHub Actions
 * @param {Error} error - Объект ошибки
 * @param {string} commentTitle - Заголовок комментария
 */
async function createErrorComment(github, context, error, commentTitle) {
	const errorCommentBody = `## ❌ ${commentTitle} - Error

An error occurred while analyzing bundle size changes:

\`\`\`
${error.message}
\`\`\`

Please check the action logs for more details.

---
<sub>Generated by [Harold Action](https://github.com/343dev/harold) • ${new Date().toLocaleString()}</sub>`;

	const { owner, repo } = context.repo;
	const issueNumber = context.payload.pull_request.number;

	await github.rest.issues.createComment({
		owner,
		repo,
		issue_number: issueNumber,
		body: errorCommentBody,
	});
}

// Экспорт основной функции
module.exports = main;
