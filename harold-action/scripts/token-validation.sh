#!/bin/bash
set -e

# Скрипт для валидации и безопасной обработки GitHub токенов
# Проверяет права доступа и маскирует токены в логах

echo "🔑 Validating GitHub token..."

# Проверяем наличие токена
if [ -z "$GITHUB_TOKEN" ]; then
    echo "::error::GitHub token is required but not provided"
    exit 1
fi

# Маскируем токен в логах (GitHub Actions делает это автоматически, но добавляем для надежности)
echo "::add-mask::$GITHUB_TOKEN"

# Проверяем формат токена (должен начинаться с ghp_, gho_, ghu_, ghs_, или ghr_)
if ! echo "$GITHUB_TOKEN" | grep -E "^(ghp_|gho_|ghu_|ghs_|ghr_)" > /dev/null; then
    echo "::warning::Token format may be invalid - expected GitHub token format"
fi

# Создаем временный файл для проверки прав
TEMP_TOKEN_CHECK=$(mktemp)
trap 'rm -f "$TEMP_TOKEN_CHECK"' EXIT

# Проверяем базовые права доступа к репозиторию
echo "🔍 Checking repository access permissions..."

HTTP_STATUS=$(curl -s -w "%{http_code}" -o "$TEMP_TOKEN_CHECK" \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    "https://api.github.com/repos/$GITHUB_REPOSITORY" || echo "000")

case $HTTP_STATUS in
    200)
        echo "✅ Repository access: OK"
        ;;
    401)
        echo "::error::Invalid or expired GitHub token"
        exit 1
        ;;
    403)
        echo "::warning::Limited access to repository (may be expected for forks)"
        ;;
    404)
        echo "::error::Repository not found or no access"
        exit 1
        ;;
    *)
        echo "::warning::Unexpected response from GitHub API: $HTTP_STATUS"
        ;;
esac

# Проверяем права на создание комментариев (если это PR)
if [ "$GITHUB_EVENT_NAME" = "pull_request" ] || [ "$GITHUB_EVENT_NAME" = "pull_request_target" ]; then
    echo "🔍 Checking pull request comment permissions..."

    PR_NUMBER=$(echo "$GITHUB_REF" | sed 's/refs\/pull\/\([0-9]*\)\/merge/\1/' || echo "")

    if [ -n "$PR_NUMBER" ] && [ "$PR_NUMBER" != "$GITHUB_REF" ]; then
        # Пытаемся получить информацию о PR
        HTTP_STATUS=$(curl -s -w "%{http_code}" -o "$TEMP_TOKEN_CHECK" \
            -H "Authorization: token $GITHUB_TOKEN" \
            -H "Accept: application/vnd.github.v3+json" \
            "https://api.github.com/repos/$GITHUB_REPOSITORY/pulls/$PR_NUMBER" || echo "000")

        case $HTTP_STATUS in
            200)
                echo "✅ Pull request access: OK"

                # Проверяем права на комментарии
                HTTP_STATUS=$(curl -s -w "%{http_code}" -o "$TEMP_TOKEN_CHECK" \
                    -H "Authorization: token $GITHUB_TOKEN" \
                    -H "Accept: application/vnd.github.v3+json" \
                    "https://api.github.com/repos/$GITHUB_REPOSITORY/issues/$PR_NUMBER/comments" || echo "000")

                if [ "$HTTP_STATUS" = "200" ]; then
                    echo "✅ Comment permissions: OK"
                    echo "CAN_COMMENT=true" >> "$GITHUB_ENV"
                else
                    echo "::warning::Limited comment permissions (status: $HTTP_STATUS)"
                    echo "CAN_COMMENT=false" >> "$GITHUB_ENV"
                fi
                ;;
            403)
                echo "::warning::Limited pull request access"
                echo "CAN_COMMENT=false" >> "$GITHUB_ENV"
                ;;
            404)
                echo "::warning::Pull request not found or no access"
                echo "CAN_COMMENT=false" >> "$GITHUB_ENV"
                ;;
            *)
                echo "::warning::Cannot determine PR comment permissions: $HTTP_STATUS"
                echo "CAN_COMMENT=false" >> "$GITHUB_ENV"
                ;;
        esac
    else
        echo "::warning::Cannot determine PR number from context"
        echo "CAN_COMMENT=false" >> "$GITHUB_ENV"
    fi
else
    echo "ℹ️  Not a pull request event - skipping comment permission check"
    echo "CAN_COMMENT=false" >> "$GITHUB_ENV"
fi

# Проверяем минимально необходимые права
echo "🔍 Checking minimum required permissions..."

# Читаем ответ API для анализа прав
if [ -f "$TEMP_TOKEN_CHECK" ] && [ -s "$TEMP_TOKEN_CHECK" ]; then
    # Проверяем наличие поля permissions в ответе
    if grep -q '"permissions"' "$TEMP_TOKEN_CHECK"; then
        # Извлекаем права доступа
        PERMISSIONS=$(grep -o '"permissions":{[^}]*}' "$TEMP_TOKEN_CHECK" || echo "")

        if echo "$PERMISSIONS" | grep -q '"contents":"read"'; then
            echo "✅ Contents read permission: OK"
        else
            echo "::warning::Contents read permission may be limited"
        fi

        if echo "$PERMISSIONS" | grep -q '"pull_requests":"write"'; then
            echo "✅ Pull requests write permission: OK"
        else
            echo "::warning::Pull requests write permission may be limited"
        fi

        if echo "$PERMISSIONS" | grep -q '"issues":"write"'; then
            echo "✅ Issues write permission: OK"
        else
            echo "::warning::Issues write permission may be limited (needed for comments)"
        fi
    else
        echo "::warning::Cannot determine detailed permissions from API response"
    fi
fi

# Экспортируем информацию о токене (без самого токена!)
echo "TOKEN_VALIDATED=true" >> "$GITHUB_ENV"

# Определяем уровень доступа для graceful fallback
ACCESS_LEVEL="full"

if [ "$HTTP_STATUS" = "403" ] || [ "$CAN_COMMENT" = "false" ]; then
    ACCESS_LEVEL="limited"
    echo "::warning::Limited access detected - some features may be restricted"
elif [ "$HTTP_STATUS" != "200" ]; then
    ACCESS_LEVEL="minimal"
    echo "::warning::Minimal access detected - functionality will be limited"
fi

# Экспортируем уровень доступа
echo "ACCESS_LEVEL=$ACCESS_LEVEL" >> "$GITHUB_ENV"

# Создаем маскированную версию токена для логирования (показываем только первые и последние символы)
if [ ${#GITHUB_TOKEN} -gt 8 ]; then
    MASKED_TOKEN="${GITHUB_TOKEN:0:4}...${GITHUB_TOKEN: -4}"
else
    MASKED_TOKEN="***"
fi

echo "🔑 Token validation completed for: $MASKED_TOKEN"
echo "🔐 Access level: $ACCESS_LEVEL"
echo "✅ GitHub token validation passed"
