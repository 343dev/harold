#!/bin/bash

# Скрипт для проверки возможности раннего завершения (early exit)
# Анализирует изменения в PR и определяет, нужно ли выполнять полный анализ Harold

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для вывода цветного текста
print_color() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Функция для логирования с timestamp
log_with_time() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

print_color $BLUE "🔍 Checking for early exit opportunities..."

# Проверяем входные параметры
if [ -z "$GITHUB_EVENT_NAME" ]; then
    print_color $YELLOW "⚠️  GITHUB_EVENT_NAME not set, skipping early exit checks"
    echo "EARLY_EXIT=false" >> "$GITHUB_ENV"
    exit 0
fi

# Функция для проверки изменений в файлах
check_file_changes() {
    log_with_time "Analyzing changed files in PR..."

    # Паттерны файлов, которые влияют на размер бандла
    local bundle_affecting_patterns=(
        "*.js" "*.jsx" "*.ts" "*.tsx"
        "*.vue" "*.svelte" "*.angular.html"
        "*.css" "*.scss" "*.sass" "*.less" "*.styl"
        "*.json" "package.json" "package-lock.json" "yarn.lock"
        "*.html" "*.htm"
        "*.png" "*.jpg" "*.jpeg" "*.gif" "*.svg" "*.webp" "*.ico"
        "*.woff" "*.woff2" "*.ttf" "*.eot"
        "*.md" "*.txt" # Могут содержать встроенные ресурсы
    )

    # Паттерны файлов конфигурации сборки
    local build_config_patterns=(
        "webpack.config.*" "rollup.config.*" "vite.config.*"
        "tsconfig.json" "babel.config.*" ".babelrc*"
        "postcss.config.*" "tailwind.config.*"
        ".haroldrc.*" "harold.config.*"
        "Dockerfile" "docker-compose.*"
    )

    # Паттерны файлов, которые НЕ влияют на размер бандла
    local non_affecting_patterns=(
        "*.md" "*.txt" "*.rst" # Документация (если не встроена)
        "*.yml" "*.yaml" # CI/CD конфигурации
        ".github/**" ".gitlab/**" ".circleci/**"
        "*.test.js" "*.spec.js" "*.test.ts" "*.spec.ts" # Тесты
        "__tests__/**" "test/**" "tests/**" "spec/**"
        "*.config.js" "*.config.ts" # Конфигурации (кроме сборки)
        ".gitignore" ".gitattributes" ".editorconfig"
        "LICENSE" "CHANGELOG*" "CONTRIBUTING*"
        "*.sh" "*.bat" "*.ps1" # Скрипты (если не встроены)
    )

    local has_bundle_changes=false
    local has_config_changes=false
    local changed_files_count=0

    # Получаем список измененных файлов
    local changed_files=""

    if [ "$GITHUB_EVENT_NAME" = "pull_request" ]; then
        # Для PR получаем список измененных файлов через git diff
        if [ -d ".git" ]; then
            changed_files=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || echo "")
        fi

        # Альтернативный способ через GitHub API (если доступен)
        if [ -z "$changed_files" ] && [ -n "$GITHUB_TOKEN" ]; then
            local pr_number=$(echo "$GITHUB_REF" | sed 's/refs\/pull\/\([0-9]*\)\/merge/\1/')
            if [ -n "$pr_number" ] && [ "$pr_number" != "$GITHUB_REF" ]; then
                changed_files=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
                    "https://api.github.com/repos/$GITHUB_REPOSITORY/pulls/$pr_number/files" | \
                    grep '"filename":' | sed 's/.*"filename": *"\([^"]*\)".*/\1/' 2>/dev/null || echo "")
            fi
        fi
    fi

    if [ -z "$changed_files" ]; then
        log_with_time "Could not determine changed files, assuming full analysis needed"
        echo "EARLY_EXIT=false" >> "$GITHUB_ENV"
        echo "EARLY_EXIT_REASON=unknown_changes" >> "$GITHUB_ENV"
        return 0
    fi

    # Анализируем каждый измененный файл
    while IFS= read -r file; do
        [ -z "$file" ] && continue
        changed_files_count=$((changed_files_count + 1))

        log_with_time "Analyzing file: $file"

        # Проверяем, влияет ли файл на размер бандла
        local affects_bundle=false

        for pattern in "${bundle_affecting_patterns[@]}"; do
            if [[ "$file" == $pattern ]]; then
                affects_bundle=true
                break
            fi
        done

        # Проверяем конфигурационные файлы сборки
        for pattern in "${build_config_patterns[@]}"; do
            if [[ "$file" == $pattern ]]; then
                has_config_changes=true
                affects_bundle=true
                break
            fi
        done

        if [ "$affects_bundle" = "true" ]; then
            has_bundle_changes=true
            log_with_time "  → Affects bundle size"
        else
            log_with_time "  → Does not affect bundle size"
        fi

    done <<< "$changed_files"

    # Выводим статистику
    print_color $BLUE "📊 File change analysis:"
    print_color $BLUE "   Total changed files: $changed_files_count"
    print_color $BLUE "   Bundle affecting changes: $([ "$has_bundle_changes" = "true" ] && echo "YES" || echo "NO")"
    print_color $BLUE "   Build config changes: $([ "$has_config_changes" = "true" ] && echo "YES" || echo "NO")"

    # Определяем возможность early exit
    if [ "$has_bundle_changes" = "false" ] && [ "$changed_files_count" -gt 0 ]; then
        print_color $GREEN "✅ Early exit possible - no bundle affecting changes detected"
        echo "EARLY_EXIT=true" >> "$GITHUB_ENV"
        echo "EARLY_EXIT_REASON=no_bundle_changes" >> "$GITHUB_ENV"
        return 0
    fi

    if [ "$changed_files_count" -eq 0 ]; then
        print_color $GREEN "✅ Early exit possible - no file changes detected"
        echo "EARLY_EXIT=true" >> "$GITHUB_ENV"
        echo "EARLY_EXIT_REASON=no_changes" >> "$GITHUB_ENV"
        return 0
    fi

    print_color $YELLOW "⚠️  Full analysis required - bundle affecting changes detected"
    echo "EARLY_EXIT=false" >> "$GITHUB_ENV"
    echo "EARLY_EXIT_REASON=bundle_changes_detected" >> "$GITHUB_ENV"
}

# Функция для проверки кэша предыдущих результатов
check_cache_validity() {
    log_with_time "Checking cache validity..."

    local cache_file=".harold-cache/last-analysis.json"

    if [ ! -f "$cache_file" ]; then
        log_with_time "No previous cache found"
        return 1
    fi

    # Проверяем возраст кэша (максимум 24 часа)
    local cache_age=$(( $(date +%s) - $(stat -c %Y "$cache_file" 2>/dev/null || echo "0") ))
    local max_age=$((24 * 60 * 60)) # 24 часа в секундах

    if [ $cache_age -gt $max_age ]; then
        log_with_time "Cache is too old (${cache_age}s), invalidating"
        return 1
    fi

    # Проверяем, изменились ли ключевые файлы с момента последнего анализа
    local key_files=(
        "package.json"
        "package-lock.json"
        "yarn.lock"
        ".haroldrc.js"
        "webpack.config.js"
        "vite.config.js"
    )

    for file in "${key_files[@]}"; do
        if [ -f "$file" ]; then
            local file_age=$(stat -c %Y "$file" 2>/dev/null || echo "0")
            local cache_time=$(stat -c %Y "$cache_file" 2>/dev/null || echo "0")

            if [ $file_age -gt $cache_time ]; then
                log_with_time "Key file $file modified since last cache, invalidating"
                return 1
            fi
        fi
    done

    log_with_time "✅ Cache is valid and recent"
    return 0
}

# Функция для проверки размера проекта
check_project_size() {
    log_with_time "Analyzing project size for optimization opportunities..."

    # Подсчитываем количество файлов в проекте
    local total_files=$(find . -type f -not -path "./.git/*" -not -path "./node_modules/*" | wc -l)
    local js_files=$(find . -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" | wc -l)
    local css_files=$(find . -name "*.css" -o -name "*.scss" -o -name "*.sass" -o -name "*.less" | wc -l)

    print_color $BLUE "📊 Project size analysis:"
    print_color $BLUE "   Total files: $total_files"
    print_color $BLUE "   JS/TS files: $js_files"
    print_color $BLUE "   CSS files: $css_files"

    # Определяем размер проекта
    local project_size="small"

    if [ $total_files -gt 1000 ] || [ $js_files -gt 200 ]; then
        project_size="large"
    elif [ $total_files -gt 500 ] || [ $js_files -gt 100 ]; then
        project_size="medium"
    fi

    echo "PROJECT_SIZE=$project_size" >> "$GITHUB_ENV"
    print_color $BLUE "   Project size category: $project_size"

    # Для больших проектов рекомендуем дополнительные оптимизации
    if [ "$project_size" = "large" ]; then
        print_color $YELLOW "⚠️  Large project detected - enabling additional optimizations"
        echo "ENABLE_PARALLEL_BUILD=true" >> "$GITHUB_ENV"
        echo "ENABLE_INCREMENTAL_BUILD=true" >> "$GITHUB_ENV"
    fi
}

# Функция для создания отчета о возможностях оптимизации
create_optimization_report() {
    log_with_time "Creating optimization report..."

    local report_file="/tmp/harold-optimization-report.txt"

    cat > "$report_file" << EOF
Harold Action Optimization Report
Generated: $(date)

Early Exit Analysis:
- Early exit enabled: ${EARLY_EXIT:-false}
- Reason: ${EARLY_EXIT_REASON:-not_determined}

Project Analysis:
- Project size: ${PROJECT_SIZE:-unknown}
- Parallel build enabled: ${ENABLE_PARALLEL_BUILD:-false}
- Incremental build enabled: ${ENABLE_INCREMENTAL_BUILD:-false}

Recommendations:
EOF

    if [ "${EARLY_EXIT:-false}" = "true" ]; then
        echo "- ✅ Early exit will save significant time" >> "$report_file"
    else
        echo "- ⚠️  Full analysis required" >> "$report_file"
    fi

    if [ "${PROJECT_SIZE:-small}" = "large" ]; then
        echo "- 🚀 Parallel processing recommended for large project" >> "$report_file"
        echo "- 💾 Incremental builds can improve performance" >> "$report_file"
    fi

    # Показываем отчет
    print_color $BLUE "📋 Optimization Report:"
    cat "$report_file"

    # Сохраняем отчет как артефакт
    echo "OPTIMIZATION_REPORT=$report_file" >> "$GITHUB_ENV"
}

# Основная логика выполнения
main() {
    local start_time=$(date +%s)

    print_color $BLUE "🔍 Starting early exit analysis..."

    # Проверяем изменения файлов
    check_file_changes

    # Проверяем валидность кэша
    if check_cache_validity; then
        print_color $GREEN "✅ Valid cache found - additional optimizations possible"
        echo "CACHE_VALID=true" >> "$GITHUB_ENV"
    else
        echo "CACHE_VALID=false" >> "$GITHUB_ENV"
    fi

    # Анализируем размер проекта
    check_project_size

    # Создаем отчет об оптимизации
    create_optimization_report

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    print_color $GREEN "✅ Early exit analysis completed in ${duration}s"

    # Если возможен early exit, создаем заглушку для результата
    if [ "${EARLY_EXIT:-false}" = "true" ]; then
        print_color $GREEN "🚀 Early exit enabled - creating no-change result"

        # Создаем заглушки для файлов результата
        echo "No changes detected in bundle-affecting files" > harold-output.txt
        echo "0" > harold-exit-code.txt

        print_color $GREEN "✅ Early exit setup completed"
    fi
}

# Обработка сигналов для корректного завершения
trap 'print_color $YELLOW "\n⚠️  Early exit check interrupted"; exit 130' INT TERM

# Запуск основной функции
main "$@"
