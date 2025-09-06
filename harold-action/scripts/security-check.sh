#!/bin/bash
set -e

# Скрипт для проверки безопасности при выполнении в fork репозиториях
# Определяет контекст выполнения и применяет соответствующие ограничения

echo "🔒 Checking security context..."

# Проверяем, выполняется ли action в fork репозитории
IS_FORK="false"
FORK_RESTRICTIONS=""

# Определяем, является ли это fork'ом
if [ "$GITHUB_EVENT_NAME" = "pull_request" ]; then
    # Получаем информацию о PR из GitHub context
    BASE_REPO=$(echo "$GITHUB_REPOSITORY")
    HEAD_REPO=$(echo "$GITHUB_HEAD_REPOSITORY" 2>/dev/null || echo "$GITHUB_REPOSITORY")

    if [ "$BASE_REPO" != "$HEAD_REPO" ]; then
        IS_FORK="true"
        echo "⚠️  Detected execution in fork repository"
        echo "   Base repository: $BASE_REPO"
        echo "   Head repository: $HEAD_REPO"
    else
        echo "✅ Execution in same repository"
    fi
elif [ "$GITHUB_EVENT_NAME" = "pull_request_target" ]; then
    # pull_request_target всегда выполняется в контексте базового репозитория
    # но может обрабатывать код из fork'а
    echo "⚠️  Using pull_request_target event - extra security measures applied"
    IS_FORK="true"  # Применяем ограничения как для fork'а
fi

# Проверяем права доступа токена
echo "🔑 Validating GitHub token permissions..."

# Создаем временный файл для проверки прав
TEMP_PERMISSIONS_FILE=$(mktemp)

# Проверяем права через GitHub API
if ! curl -s -H "Authorization: token $GITHUB_TOKEN" \
     -H "Accept: application/vnd.github.v3+json" \
     "https://api.github.com/repos/$GITHUB_REPOSITORY" \
     > "$TEMP_PERMISSIONS_FILE" 2>/dev/null; then
    echo "::error::Failed to validate GitHub token permissions"
    rm -f "$TEMP_PERMISSIONS_FILE"
    exit 1
fi

# Проверяем, есть ли права на запись в PR
HAS_WRITE_ACCESS="false"
if grep -q '"permissions"' "$TEMP_PERMISSIONS_FILE"; then
    if grep -q '"push": true' "$TEMP_PERMISSIONS_FILE" || grep -q '"admin": true' "$TEMP_PERMISSIONS_FILE"; then
        HAS_WRITE_ACCESS="true"
    fi
fi

rm -f "$TEMP_PERMISSIONS_FILE"

# Применяем ограничения для fork'ов
if [ "$IS_FORK" = "true" ]; then
    echo "🛡️  Applying fork security restrictions..."

    # Ограничение 1: Проверяем, что не используются секреты из fork'а
    if [ -n "$GITHUB_HEAD_REF" ] && [ "$GITHUB_HEAD_REF" != "$GITHUB_REF" ]; then
        echo "::warning::Fork detected - some features may be limited for security"
        FORK_RESTRICTIONS="$FORK_RESTRICTIONS fork_detected"
    fi

    # Ограничение 2: Ограничиваем доступ к секретам
    if [ "$HAS_WRITE_ACCESS" = "false" ]; then
        echo "::warning::Limited write access detected - comments may not be posted"
        FORK_RESTRICTIONS="$FORK_RESTRICTIONS limited_write_access"
    fi

    # Ограничение 3: Валидируем входные параметры более строго
    echo "🔍 Validating input parameters for fork execution..."

    # Проверяем команду сборки на потенциально опасные команды
    if echo "$BUILD_COMMAND" | grep -E "(curl|wget|ssh|scp|rsync|git clone)" > /dev/null; then
        echo "::error::Potentially unsafe build command detected in fork: $BUILD_COMMAND"
        echo "::error::Commands containing network operations are not allowed in forks"
        exit 1
    fi

    # Проверяем рабочую директорию
    if echo "$WORKING_DIRECTORY" | grep -E "\.\.|^/" > /dev/null; then
        echo "::error::Invalid working directory path in fork: $WORKING_DIRECTORY"
        echo "::error::Path traversal attempts are not allowed"
        exit 1
    fi

    # Ограничиваем размер конфигурационного файла
    if [ -n "$CONFIG_PATH" ] && [ -f "$CONFIG_PATH" ]; then
        CONFIG_SIZE=$(wc -c < "$CONFIG_PATH" 2>/dev/null || echo "0")
        if [ "$CONFIG_SIZE" -gt 10240 ]; then  # 10KB лимит
            echo "::error::Configuration file too large in fork: ${CONFIG_SIZE} bytes"
            echo "::error::Maximum allowed size is 10KB for security"
            exit 1
        fi
    fi
fi

# Валидация входных параметров (общая для всех случаев)
echo "✅ Validating input parameters..."

# Проверяем пороговые значения
if ! echo "$SIZE_THRESHOLD" | grep -E "^[0-9]+$" > /dev/null; then
    echo "::error::Invalid size-threshold value: $SIZE_THRESHOLD"
    exit 1
fi

if ! echo "$PERCENTAGE_THRESHOLD" | grep -E "^[0-9]+(\.[0-9]+)?$" > /dev/null; then
    echo "::error::Invalid percentage-threshold value: $PERCENTAGE_THRESHOLD"
    exit 1
fi

# Проверяем булевые значения
if [ "$FAIL_ON_INCREASE" != "true" ] && [ "$FAIL_ON_INCREASE" != "false" ]; then
    echo "::error::Invalid fail-on-increase value: $FAIL_ON_INCREASE (must be 'true' or 'false')"
    exit 1
fi

# Экспортируем переменные для использования в других скриптах
echo "IS_FORK=$IS_FORK" >> "$GITHUB_ENV"
echo "HAS_WRITE_ACCESS=$HAS_WRITE_ACCESS" >> "$GITHUB_ENV"
echo "FORK_RESTRICTIONS=$FORK_RESTRICTIONS" >> "$GITHUB_ENV"

# Выводим итоговую информацию о безопасности
echo "🔒 Security check completed:"
echo "   Fork execution: $IS_FORK"
echo "   Write access: $HAS_WRITE_ACCESS"
if [ -n "$FORK_RESTRICTIONS" ]; then
    echo "   Applied restrictions: $FORK_RESTRICTIONS"
fi

echo "✅ Security validation passed"
