#!/bin/bash

# Скрипт для оптимизированного checkout базовой и PR веток
# Использует shallow clone и параллельный checkout для ускорения процесса

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

# Проверяем входные параметры
if [ -z "$BASE_SHA" ] || [ -z "$HEAD_SHA" ]; then
    print_color $RED "❌ Missing required environment variables"
    echo "Required: BASE_SHA, HEAD_SHA"
    exit 1
fi

print_color $BLUE "🔄 Starting optimized checkout process..."

# Функция для checkout базовой ветки
checkout_base_branch() {
    local start_time=$(date +%s)
    log_with_time "Starting base branch checkout..."

    # Проверяем, есть ли уже checkout базовой ветки
    if [ -d "base-branch/.git" ]; then
        cd base-branch

        # Проверяем текущий commit
        local current_sha=$(git rev-parse HEAD 2>/dev/null || echo "")

        if [ "$current_sha" = "$BASE_SHA" ]; then
            log_with_time "Base branch already at correct commit: $BASE_SHA"
            cd ..
            return 0
        fi

        # Пытаемся обновить существующий репозиторий
        log_with_time "Updating existing base branch checkout..."

        if git fetch origin --depth=1 && git checkout "$BASE_SHA" 2>/dev/null; then
            log_with_time "✅ Base branch updated successfully"
            cd ..
            return 0
        else
            log_with_time "Failed to update, will re-clone..."
            cd ..
            rm -rf base-branch
        fi
    fi

    # Выполняем shallow clone базовой ветки
    log_with_time "Performing shallow clone for base branch..."

    local repo_url="https://github.com/$GITHUB_REPOSITORY.git"

    if git clone --depth=1 --no-checkout "$repo_url" base-branch; then
        cd base-branch

        # Пытаемся checkout нужный commit
        if git checkout "$BASE_SHA" 2>/dev/null; then
            log_with_time "✅ Base branch checkout completed"
        else
            # Если shallow clone не содержит нужный commit, делаем fetch
            log_with_time "Commit not found in shallow clone, fetching more history..."

            if git fetch origin --depth=50 && git checkout "$BASE_SHA"; then
                log_with_time "✅ Base branch checkout completed with extended history"
            else
                log_with_time "❌ Failed to checkout base branch commit: $BASE_SHA"
                cd ..
                return 1
            fi
        fi

        cd ..
    else
        log_with_time "❌ Failed to clone base branch"
        return 1
    fi

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    log_with_time "Base branch checkout completed in ${duration}s"

    return 0
}

# Функция для checkout PR ветки
checkout_pr_branch() {
    local start_time=$(date +%s)
    log_with_time "Starting PR branch checkout..."

    # Проверяем, есть ли уже checkout PR ветки
    if [ -d "pr-branch/.git" ]; then
        cd pr-branch

        # Проверяем текущий commit
        local current_sha=$(git rev-parse HEAD 2>/dev/null || echo "")

        if [ "$current_sha" = "$HEAD_SHA" ]; then
            log_with_time "PR branch already at correct commit: $HEAD_SHA"
            cd ..
            return 0
        fi

        # Пытаемся обновить существующий репозиторий
        log_with_time "Updating existing PR branch checkout..."

        if git fetch origin --depth=1 && git checkout "$HEAD_SHA" 2>/dev/null; then
            log_with_time "✅ PR branch updated successfully"
            cd ..
            return 0
        else
            log_with_time "Failed to update, will re-clone..."
            cd ..
            rm -rf pr-branch
        fi
    fi

    # Выполняем shallow clone PR ветки
    log_with_time "Performing shallow clone for PR branch..."

    local repo_url="https://github.com/$GITHUB_REPOSITORY.git"

    if git clone --depth=1 --no-checkout "$repo_url" pr-branch; then
        cd pr-branch

        # Пытаемся checkout нужный commit
        if git checkout "$HEAD_SHA" 2>/dev/null; then
            log_with_time "✅ PR branch checkout completed"
        else
            # Если shallow clone не содержит нужный commit, делаем fetch
            log_with_time "Commit not found in shallow clone, fetching more history..."

            if git fetch origin --depth=50 && git checkout "$HEAD_SHA"; then
                log_with_time "✅ PR branch checkout completed with extended history"
            else
                log_with_time "❌ Failed to checkout PR branch commit: $HEAD_SHA"
                cd ..
                return 1
            fi
        fi

        cd ..
    else
        log_with_time "❌ Failed to clone PR branch"
        return 1
    fi

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    log_with_time "PR branch checkout completed in ${duration}s"

    return 0
}

# Функция для оптимизации Git конфигурации
optimize_git_config() {
    log_with_time "Optimizing Git configuration for performance..."

    # Настройки для ускорения Git операций
    git config --global core.preloadindex true
    git config --global core.fscache true
    git config --global gc.auto 0  # Отключаем автоматический garbage collection
    git config --global advice.detachedHead false  # Отключаем предупреждения

    # Настройки для экономии места
    git config --global pack.threads 0  # Используем все доступные ядра
    git config --global pack.windowMemory 256m

    log_with_time "✅ Git configuration optimized"
}

# Функция для проверки изменений файлов
check_file_changes() {
    log_with_time "Checking for relevant file changes..."

    if [ ! -d "base-branch" ] || [ ! -d "pr-branch" ]; then
        log_with_time "Branches not available for comparison"
        return 0
    fi

    # Создаем список файлов, которые могут влиять на размер бандла
    local relevant_patterns=(
        "*.js" "*.jsx" "*.ts" "*.tsx"
        "*.vue" "*.svelte"
        "*.css" "*.scss" "*.sass" "*.less"
        "*.json" "package.json" "package-lock.json"
        "*.html" "*.htm"
        "*.png" "*.jpg" "*.jpeg" "*.gif" "*.svg" "*.webp"
        "*.woff" "*.woff2" "*.ttf" "*.eot"
    )

    local has_relevant_changes=false

    # Проверяем каждый паттерн
    for pattern in "${relevant_patterns[@]}"; do
        if find pr-branch -name "$pattern" -newer base-branch 2>/dev/null | grep -q .; then
            has_relevant_changes=true
            break
        fi
    done

    if [ "$has_relevant_changes" = "false" ]; then
        log_with_time "⚡ No relevant file changes detected - build optimization possible"
        echo "SKIP_BUILD_OPTIMIZATION=true" >> "$GITHUB_ENV"
    else
        log_with_time "📝 Relevant file changes detected - full build required"
        echo "SKIP_BUILD_OPTIMIZATION=false" >> "$GITHUB_ENV"
    fi
}

# Функция для мониторинга параллельных процессов
monitor_parallel_checkout() {
    local base_pid=$1
    local pr_pid=$2
    local start_time=$(date +%s)

    print_color $BLUE "⏳ Monitoring parallel checkout processes..."

    local base_done=false
    local pr_done=false
    local base_result=0
    local pr_result=0

    while [ "$base_done" = false ] || [ "$pr_done" = false ]; do
        # Проверяем статус базовой ветки
        if [ "$base_done" = false ]; then
            if ! kill -0 $base_pid 2>/dev/null; then
                wait $base_pid
                base_result=$?
                base_done=true

                if [ $base_result -eq 0 ]; then
                    print_color $GREEN "✅ Base branch checkout completed"
                else
                    print_color $RED "❌ Base branch checkout failed"
                fi
            fi
        fi

        # Проверяем статус PR ветки
        if [ "$pr_done" = false ]; then
            if ! kill -0 $pr_pid 2>/dev/null; then
                wait $pr_pid
                pr_result=$?
                pr_done=true

                if [ $pr_result -eq 0 ]; then
                    print_color $GREEN "✅ PR branch checkout completed"
                else
                    print_color $RED "❌ PR branch checkout failed"
                fi
            fi
        fi

        sleep 0.5
    done

    local total_time=$(date +%s)
    local total_duration=$((total_time - start_time))

    print_color $BLUE "📊 Parallel checkout summary:"
    print_color $BLUE "   Total time: ${total_duration}s"

    # Возвращаем ошибку если хотя бы один процесс упал
    if [ $base_result -ne 0 ] || [ $pr_result -ne 0 ]; then
        return 1
    fi

    return 0
}

# Основная логика выполнения
main() {
    local start_time=$(date +%s)

    print_color $BLUE "🚀 Starting optimized checkout process..."

    # Оптимизируем Git конфигурацию
    optimize_git_config

    # Проверяем доступность репозитория
    if [ -z "$GITHUB_REPOSITORY" ]; then
        print_color $RED "❌ GITHUB_REPOSITORY environment variable not set"
        exit 1
    fi

    print_color $BLUE "📋 Checkout details:"
    print_color $BLUE "   Repository: $GITHUB_REPOSITORY"
    print_color $BLUE "   Base SHA: $BASE_SHA"
    print_color $BLUE "   Head SHA: $HEAD_SHA"

    # Запускаем параллельные checkout процессы
    print_color $BLUE "🔄 Starting parallel checkout..."

    # Запускаем checkout базовой ветки в фоне
    checkout_base_branch &
    local base_pid=$!

    # Запускаем checkout PR ветки в фоне
    checkout_pr_branch &
    local pr_pid=$!

    # Мониторим выполнение
    if monitor_parallel_checkout $base_pid $pr_pid; then
        local end_time=$(date +%s)
        local total_duration=$((end_time - start_time))

        print_color $GREEN "🎉 Parallel checkout completed successfully in ${total_duration}s!"

        # Проверяем изменения файлов для оптимизации
        check_file_changes

        # Показываем статистику
        if [ -d "base-branch" ] && [ -d "pr-branch" ]; then
            local base_files=$(find base-branch -type f | wc -l)
            local pr_files=$(find pr-branch -type f | wc -l)

            print_color $BLUE "📊 Checkout statistics:"
            print_color $BLUE "   Base branch files: $base_files"
            print_color $BLUE "   PR branch files: $pr_files"
        fi

        exit 0
    else
        print_color $RED "❌ Parallel checkout process failed"
        exit 1
    fi
}

# Обработка сигналов для корректного завершения
trap 'print_color $YELLOW "\n⚠️  Checkout process interrupted"; exit 130' INT TERM

# Запуск основной функции
main "$@"
