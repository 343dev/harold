#!/bin/bash
set -e

# Скрипт для маскирования секретов и чувствительной информации в логах
# Обеспечивает безопасность при работе с токенами и другими секретами

echo "🔒 Masking sensitive information in logs..."

# Маскируем GitHub токен (если он передан)
if [ -n "$GITHUB_TOKEN" ]; then
    echo "::add-mask::$GITHUB_TOKEN"
    echo "✅ GitHub token masked"
fi

# Маскируем другие потенциальные секреты из переменных окружения
# Ищем переменные, которые могут содержать секреты
for var in $(env | grep -E "(TOKEN|SECRET|KEY|PASSWORD|PASS)" | cut -d= -f1); do
    value=$(eval echo \$$var)
    if [ -n "$value" ] && [ ${#value} -gt 8 ]; then
        echo "::add-mask::$value"
        echo "✅ Masked environment variable: $var"
    fi
done

# Маскируем потенциальные секреты в командной строке
if [ -n "$BUILD_COMMAND" ]; then
    # Проверяем, содержит ли команда сборки потенциальные секреты
    if echo "$BUILD_COMMAND" | grep -E "(token|secret|key|password)" > /dev/null; then
        echo "::warning::Build command may contain sensitive information"
        echo "::warning::Please ensure no secrets are exposed in build commands"
    fi
fi

# Создаем функцию для безопасного логирования
cat > /tmp/safe-log.sh << 'EOF'
#!/bin/bash
# Функция для безопасного логирования с автоматическим маскированием

safe_log() {
    local message="$1"
    local level="${2:-info}"

    # Маскируем потенциальные токены в сообщении
    # Паттерны для GitHub токенов
    message=$(echo "$message" | sed -E 's/ghp_[a-zA-Z0-9]{36}/***GITHUB_TOKEN***/g')
    message=$(echo "$message" | sed -E 's/gho_[a-zA-Z0-9]{36}/***GITHUB_TOKEN***/g')
    message=$(echo "$message" | sed -E 's/ghu_[a-zA-Z0-9]{36}/***GITHUB_TOKEN***/g')
    message=$(echo "$message" | sed -E 's/ghs_[a-zA-Z0-9]{36}/***GITHUB_TOKEN***/g')
    message=$(echo "$message" | sed -E 's/ghr_[a-zA-Z0-9]{36}/***GITHUB_TOKEN***/g')

    # Маскируем другие потенциальные секреты (длинные строки из букв и цифр)
    message=$(echo "$message" | sed -E 's/[a-zA-Z0-9]{32,}/***MASKED***/g')

    # Выводим сообщение с соответствующим уровнем
    case $level in
        error)
            echo "::error::$message"
            ;;
        warning)
            echo "::warning::$message"
            ;;
        *)
            echo "$message"
            ;;
    esac
}

# Экспортируем функцию для использования в других скриптах
export -f safe_log
EOF

chmod +x /tmp/safe-log.sh

# Создаем алиас для безопасного логирования
echo "SAFE_LOG_SCRIPT=/tmp/safe-log.sh" >> "$GITHUB_ENV"

# Проверяем наличие потенциально чувствительных файлов
echo "🔍 Checking for sensitive files..."

SENSITIVE_FILES=(
    ".env"
    ".env.local"
    ".env.production"
    "secrets.json"
    "private.key"
    "id_rsa"
    ".npmrc"
    ".yarnrc"
)

for file in "${SENSITIVE_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "::warning::Sensitive file detected: $file"
        echo "::warning::Ensure this file doesn't contain secrets that could be exposed"

        # Маскируем содержимое файла, если он небольшой
        if [ -s "$file" ] && [ $(wc -c < "$file") -lt 1024 ]; then
            while IFS= read -r line; do
                if echo "$line" | grep -E "(token|secret|key|password)" > /dev/null; then
                    echo "::add-mask::$line"
                fi
            done < "$file"
        fi
    fi
done

# Создаем функцию для очистки временных файлов с секретами
cat > /tmp/cleanup-secrets.sh << 'EOF'
#!/bin/bash
# Функция для безопасной очистки временных файлов

cleanup_secrets() {
    echo "🧹 Cleaning up temporary files with potential secrets..."

    # Список паттернов файлов для очистки
    local cleanup_patterns=(
        "*.tmp"
        "*.temp"
        "*token*"
        "*secret*"
        "*key*"
        ".env*"
    )

    for pattern in "${cleanup_patterns[@]}"; do
        find /tmp -name "$pattern" -type f -exec shred -vfz -n 3 {} \; 2>/dev/null || true
    done

    # Очищаем переменные окружения с секретами
    unset GITHUB_TOKEN
    unset NPM_TOKEN
    unset NODE_AUTH_TOKEN

    echo "✅ Cleanup completed"
}

export -f cleanup_secrets
EOF

chmod +x /tmp/cleanup-secrets.sh
echo "CLEANUP_SECRETS_SCRIPT=/tmp/cleanup-secrets.sh" >> "$GITHUB_ENV"

# Настраиваем trap для автоматической очистки при завершении
echo "trap 'source /tmp/cleanup-secrets.sh && cleanup_secrets' EXIT" >> "$GITHUB_ENV"

echo "🔒 Secret masking setup completed"
echo "✅ Safe logging functions available"
