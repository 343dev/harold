#!/bin/bash

# Улучшенный скрипт для параллельной сборки и создания снимков с кэшированием
# Использует cache-manager.sh и build-and-snapshot-cached.sh для максимальной производительности

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
if [ -z "$BUILD_COMMAND" ] || [ -z "$BUILD_PATH" ] || [ -z "$CONFIG_PATH" ]; then
    print_color $RED "❌ Missing required environment variables"
    echo "Required: BUILD_COMMAND, BUILD_PATH, CONFIG_PATH"
    exit 1
fi

print_color $BLUE "🚀 Starting parallel cached build and snapshot process..."

# Создаем временные директории для логов
mkdir -p /tmp/harold-logs
BASE_LOG="/tmp/harold-logs/base-build.log"
PR_LOG="/tmp/harold-logs/pr-build.log"

# Путь к кэшированному скрипту сборки
CACHED_BUILD_SCRIPT="$(dirname "$0")/build-and-snapshot-cached.sh"
CACHE_MANAGER_SCRIPT="$(dirname "$0")/cache-manager.sh"

# Функция для сборки и создания снимка базовой ветки с кэшированием
build_base_branch_cached() {
    local start_time=$(date +%s)
    log_with_time "Starting cached base branch build..." >> "$BASE_LOG"

    if [ ! -d "base-branch" ]; then
        echo "❌ Base branch directory not found" >> "$BASE_LOG"
        return 1
    fi

    cd base-branch

    # Устанавливаем переменные окружения для кэшированного скрипта
    export WORKING_DIR="."
    export ENABLE_CACHING="true"
    export GITHUB_BASE_SHA="${GITHUB_BASE_SHA:-$(git rev-parse HEAD 2>/dev/null || echo 'unknown')}"

    log_with_time "Using cached build script: $CACHED_BUILD_SCRIPT" >> "$BASE_LOG"
    log_with_time "Base SHA: $GITHUB_BASE_SHA" >> "$BASE_LOG"

    # Выполняем кэшированную сборку и создание снимка
    if [ -f "$CACHED_BUILD_SCRIPT" ]; then
        if "$CACHED_BUILD_SCRIPT" base >> "$BASE_LOG" 2>&1; then
            log_with_time "✅ Cached base branch build and snapshot completed successfully" >> "$BASE_LOG"
        else
            log_with_time "❌ Cached base branch build and snapshot failed" >> "$BASE_LOG"
            cd ..
            return 1
        fi
    else
        log_with_time "❌ Cached build script not found: $CACHED_BUILD_SCRIPT" >> "$BASE_LOG"
        cd ..
        return 1
    fi

    cd ..

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    log_with_time "Base branch processing completed in ${duration}s" >> "$BASE_LOG"

    return 0
}

# Функция для сборки и создания снимка PR ветки с кэшированием
build_pr_branch_cached() {
    local start_time=$(date +%s)
    log_with_time "Starting cached PR branch build..." >> "$PR_LOG"

    if [ ! -d "pr-branch" ]; then
        echo "❌ PR branch directory not found" >> "$PR_LOG"
        return 1
    fi

    cd pr-branch

    # Устанавливаем переменные окружения для кэшированного скрипта
    export WORKING_DIR="."
    export ENABLE_CACHING="true"
    export GITHUB_HEAD_SHA="${GITHUB_HEAD_SHA:-$(git rev-parse HEAD 2>/dev/null || echo 'unknown')}"

    log_with_time "Using cached build script: $CACHED_BUILD_SCRIPT" >> "$PR_LOG"
    log_with_time "Head SHA: $GITHUB_HEAD_SHA" >> "$PR_LOG"

    # Выполняем кэшированную сборку и создание снимка
    if [ -f "$CACHED_BUILD_SCRIPT" ]; then
        if "$CACHED_BUILD_SCRIPT" pr >> "$PR_LOG" 2>&1; then
            log_with_time "✅ Cached PR branch build and snapshot completed successfully" >> "$PR_LOG"
        else
            log_with_time "❌ Cached PR branch build and snapshot failed" >> "$PR_LOG"
            cd ..
            return 1
        fi
    else
        log_with_time "❌ Cached build script not found: $CACHED_BUILD_SCRIPT" >> "$PR_LOG"
        cd ..
        return 1
    fi

    cd ..

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    log_with_time "PR branch processing completed in ${duration}s" >> "$PR_LOG"

    return 0
}

# Функция для мониторинга процессов с улучшенной отчетностью
monitor_processes() {
    local base_pid=$1
    local pr_pid=$2
    local start_time=$(date +%s)

    print_color $BLUE "⏳ Monitoring parallel cached build processes..."
    print_color $YELLOW "   Base branch PID: $base_pid"
    print_color $YELLOW "   PR branch PID: $pr_pid"

    local base_done=false
    local pr_done=false
    local base_result=0
    local pr_result=0
    local last_progress_time=$start_time

    while [ "$base_done" = false ] || [ "$pr_done" = false ]; do
        # Проверяем статус базовой ветки
        if [ "$base_done" = false ]; then
            if ! kill -0 $base_pid 2>/dev/null; then
                wait $base_pid
                base_result=$?
                base_done=true

                if [ $base_result -eq 0 ]; then
                    print_color $GREEN "✅ Base branch completed successfully"
                else
                    print_color $RED "❌ Base branch failed (exit code: $base_result)"
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
                    print_color $GREEN "✅ PR branch completed successfully"
                else
                    print_color $RED "❌ PR branch failed (exit code: $pr_result)"
                fi
            fi
        fi

        # Показываем прогресс каждые 10 секунд
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))

        if [ $((current_time - last_progress_time)) -ge 10 ]; then
            print_color $BLUE "⏱️  Progress update (${elapsed}s elapsed):"

            # Показываем статус процессов
            if [ "$base_done" = false ]; then
                print_color $YELLOW "   Base branch: In progress..."
                # Показываем последние строки лога
                if [ -f "$BASE_LOG" ]; then
                    local last_base_line=$(tail -n 1 "$BASE_LOG" 2>/dev/null || echo "No log available")
                    print_color $BLUE "     Latest: $last_base_line"
                fi
            fi

            if [ "$pr_done" = false ]; then
                print_color $YELLOW "   PR branch: In progress..."
                # Показываем последние строки лога
                if [ -f "$PR_LOG" ]; then
                    local last_pr_line=$(tail -n 1 "$PR_LOG" 2>/dev/null || echo "No log available")
                    print_color $BLUE "     Latest: $last_pr_line"
                fi
            fi

            last_progress_time=$current_time
        fi

        sleep 1
    done

    local total_time=$(date +%s)
    local total_duration=$((total_time - start_time))

    print_color $BLUE "📊 Parallel cached build summary:"
    print_color $BLUE "   Total time: ${total_duration}s"
    print_color $BLUE "   Base result: $([ $base_result -eq 0 ] && echo "SUCCESS" || echo "FAILED")"
    print_color $BLUE "   PR result: $([ $pr_result -eq 0 ] && echo "SUCCESS" || echo "FAILED")"

    # Показываем статистику кэша
    if [ -f "$CACHE_MANAGER_SCRIPT" ]; then
        print_color $BLUE "💾 Cache statistics:"
        "$CACHE_MANAGER_SCRIPT" stats | grep -E "(Total cache size|Cached snapshots|Cached builds)" || true
    fi

    # Возвращаем ошибку если хотя бы один процесс упал
    if [ $base_result -ne 0 ] || [ $pr_result -ne 0 ]; then
        return 1
    fi

    return 0
}

# Функция для отображения логов в случае ошибки
show_logs_on_error() {
    local exit_code=$1

    if [ $exit_code -ne 0 ]; then
        print_color $RED "❌ Parallel cached build failed. Showing logs:"

        if [ -f "$BASE_LOG" ]; then
            print_color $YELLOW "📋 Base branch log (last 20 lines):"
            tail -n 20 "$BASE_LOG" 2>/dev/null || echo "No base log available"
            echo
        fi

        if [ -f "$PR_LOG" ]; then
            print_color $YELLOW "📋 PR branch log (last 20 lines):"
            tail -n 20 "$PR_LOG" 2>/dev/null || echo "No PR log available"
            echo
        fi

        # Показываем информацию о кэше для отладки
        if [ -f "$CACHE_MANAGER_SCRIPT" ]; then
            print_color $YELLOW "💾 Cache debug information:"
            "$CACHE_MANAGER_SCRIPT" stats 2>/dev/null || echo "Cache stats unavailable"
        fi
    fi
}

# Функция для очистки временных файлов
cleanup() {
    print_color $BLUE "🧹 Cleaning up temporary files..."

    # Удаляем временные логи
    rm -f "$BASE_LOG" "$PR_LOG" 2>/dev/null || true

    # Удаляем временные директории если они пустые
    rmdir /tmp/harold-logs 2>/dev/null || true

    # Очищаем устаревший кэш
    if [ -f "$CACHE_MANAGER_SCRIPT" ]; then
        "$CACHE_MANAGER_SCRIPT" cleanup 2>/dev/null || true
    fi
}

# Функция для проверки предварительных условий
check_prerequisites() {
    print_color $BLUE "🔍 Checking prerequisites..."

    # Проверяем наличие необходимых скриптов
    if [ ! -f "$CACHED_BUILD_SCRIPT" ]; then
        print_color $RED "❌ Cached build script not found: $CACHED_BUILD_SCRIPT"
        return 1
    fi

    if [ ! -f "$CACHE_MANAGER_SCRIPT" ]; then
        print_color $YELLOW "⚠️  Cache manager script not found: $CACHE_MANAGER_SCRIPT"
        print_color $YELLOW "   Caching will be disabled"
        export ENABLE_CACHING="false"
    fi

    # Проверяем наличие необходимых директорий
    if [ ! -d "base-branch" ] || [ ! -d "pr-branch" ]; then
        print_color $RED "❌ Required directories not found"
        echo "Expected: base-branch/ and pr-branch/"
        return 1
    fi

    # Инициализируем кэш
    if [ "$ENABLE_CACHING" != "false" ] && [ -f "$CACHE_MANAGER_SCRIPT" ]; then
        "$CACHE_MANAGER_SCRIPT" init
        print_color $GREEN "✅ Cache initialized"
    fi

    print_color $GREEN "✅ Prerequisites check completed"
    return 0
}

# Основная логика выполнения
main() {
    local start_time=$(date +%s)

    print_color $BLUE "🔄 Initializing parallel cached build process..."

    # Проверяем предварительные условия
    if ! check_prerequisites; then
        exit 1
    fi

    # Запускаем параллельные процессы
    print_color $BLUE "🚀 Starting parallel cached builds..."

    # Запускаем сборку базовой ветки в фоне
    build_base_branch_cached &
    local base_pid=$!

    # Запускаем сборку PR ветки в фоне
    build_pr_branch_cached &
    local pr_pid=$!

    # Мониторим выполнение
    if monitor_processes $base_pid $pr_pid; then
        local end_time=$(date +%s)
        local total_duration=$((end_time - start_time))

        print_color $GREEN "🎉 Parallel cached build completed successfully in ${total_duration}s!"

        # Проверяем, что снимки созданы
        if [ -f "base-snapshot.json" ] && [ -f "pr-snapshot.json" ]; then
            print_color $GREEN "✅ Both snapshots created successfully"

            # Показываем размеры снимков для отладки
            local base_size=$(wc -c < base-snapshot.json)
            local pr_size=$(wc -c < pr-snapshot.json)
            print_color $BLUE "📊 Snapshot sizes:"
            print_color $BLUE "   Base: ${base_size} bytes"
            print_color $BLUE "   PR: ${pr_size} bytes"

            # Показываем предварительную информацию о различиях
            local size_diff=$((pr_size - base_size))
            if [ $size_diff -gt 0 ]; then
                print_color $YELLOW "📈 PR snapshot is ${size_diff} bytes larger"
            elif [ $size_diff -lt 0 ]; then
                print_color $GREEN "📉 PR snapshot is $((size_diff * -1)) bytes smaller"
            else
                print_color $BLUE "📊 Snapshots are the same size"
            fi
        else
            print_color $RED "❌ Snapshot files not found"
            show_logs_on_error 1
            cleanup
            exit 1
        fi

        cleanup
        exit 0
    else
        print_color $RED "❌ Parallel cached build process failed"
        show_logs_on_error 1
        cleanup
        exit 1
    fi
}

# Обработка сигналов для корректного завершения
trap 'print_color $YELLOW "\n⚠️  Build process interrupted"; cleanup; exit 130' INT TERM

# Запуск основной функции
main "$@"
