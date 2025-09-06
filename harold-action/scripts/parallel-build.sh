#!/bin/bash

# Скрипт для параллельной сборки и создания снимков базовой и PR веток
# Оптимизирует время выполнения за счет параллельного выполнения независимых операций

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

print_color $BLUE "🚀 Starting parallel build and snapshot process..."

# Создаем временные директории для логов
mkdir -p /tmp/harold-logs
BASE_LOG="/tmp/harold-logs/base-build.log"
PR_LOG="/tmp/harold-logs/pr-build.log"

# Функция для сборки и создания снимка базовой ветки
build_base_branch() {
    local start_time=$(date +%s)
    log_with_time "Starting base branch build..." >> "$BASE_LOG"

    if [ ! -d "base-branch" ]; then
        echo "❌ Base branch directory not found" >> "$BASE_LOG"
        return 1
    fi

    cd base-branch

    # Проверяем, есть ли уже готовая сборка (для оптимизации)
    if [ -d "$BUILD_PATH" ] && [ -n "$(ls -A "$BUILD_PATH" 2>/dev/null)" ]; then
        log_with_time "Build directory already exists, checking if rebuild needed..." >> "$BASE_LOG"

        # Проверяем, изменились ли исходные файлы
        if [ -f ".harold-build-hash" ]; then
            current_hash=$(find . -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" -o -name "*.vue" -o -name "package.json" | sort | xargs cat | sha256sum | cut -d' ' -f1)
            stored_hash=$(cat .harold-build-hash 2>/dev/null || echo "")

            if [ "$current_hash" = "$stored_hash" ]; then
                log_with_time "No changes detected, skipping base branch build" >> "$BASE_LOG"
                cd ..
                return 0
            fi
        fi
    fi

    # Выполняем сборку
    log_with_time "Executing build command: $BUILD_COMMAND" >> "$BASE_LOG"

    if eval "$BUILD_COMMAND" >> "$BASE_LOG" 2>&1; then
        log_with_time "✅ Base branch build completed successfully" >> "$BASE_LOG"

        # Сохраняем хеш для будущих оптимизаций
        find . -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" -o -name "*.vue" -o -name "package.json" | sort | xargs cat | sha256sum | cut -d' ' -f1 > .harold-build-hash
    else
        log_with_time "❌ Base branch build failed" >> "$BASE_LOG"
        cd ..
        return 1
    fi

    # Создаем снимок Harold
    log_with_time "Creating Harold snapshot for base branch..." >> "$BASE_LOG"

    local harold_cmd="harold snapshot --output ../base-snapshot.json"

    if [ -f "$CONFIG_PATH" ]; then
        harold_cmd="$harold_cmd --config $CONFIG_PATH"
        log_with_time "Using config: $CONFIG_PATH" >> "$BASE_LOG"
    fi

    if [ -n "$BUILD_PATH" ]; then
        harold_cmd="$harold_cmd --path $BUILD_PATH"
        log_with_time "Using build path: $BUILD_PATH" >> "$BASE_LOG"
    fi

    if eval "$harold_cmd" >> "$BASE_LOG" 2>&1; then
        log_with_time "✅ Base branch snapshot created successfully" >> "$BASE_LOG"
    else
        log_with_time "❌ Failed to create base branch snapshot" >> "$BASE_LOG"
        cd ..
        return 1
    fi

    cd ..

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    log_with_time "Base branch processing completed in ${duration}s" >> "$BASE_LOG"

    return 0
}

# Функция для сборки и создания снимка PR ветки
build_pr_branch() {
    local start_time=$(date +%s)
    log_with_time "Starting PR branch build..." >> "$PR_LOG"

    if [ ! -d "pr-branch" ]; then
        echo "❌ PR branch directory not found" >> "$PR_LOG"
        return 1
    fi

    cd pr-branch

    # Выполняем сборку
    log_with_time "Executing build command: $BUILD_COMMAND" >> "$PR_LOG"

    if eval "$BUILD_COMMAND" >> "$PR_LOG" 2>&1; then
        log_with_time "✅ PR branch build completed successfully" >> "$PR_LOG"
    else
        log_with_time "❌ PR branch build failed" >> "$PR_LOG"
        cd ..
        return 1
    fi

    # Создаем снимок Harold
    log_with_time "Creating Harold snapshot for PR branch..." >> "$PR_LOG"

    local harold_cmd="harold snapshot --output ../pr-snapshot.json"

    if [ -f "$CONFIG_PATH" ]; then
        harold_cmd="$harold_cmd --config $CONFIG_PATH"
        log_with_time "Using config: $CONFIG_PATH" >> "$PR_LOG"
    fi

    if [ -n "$BUILD_PATH" ]; then
        harold_cmd="$harold_cmd --path $BUILD_PATH"
        log_with_time "Using build path: $BUILD_PATH" >> "$PR_LOG"
    fi

    if eval "$harold_cmd" >> "$PR_LOG" 2>&1; then
        log_with_time "✅ PR branch snapshot created successfully" >> "$PR_LOG"
    else
        log_with_time "❌ Failed to create PR branch snapshot" >> "$PR_LOG"
        cd ..
        return 1
    fi

    cd ..

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    log_with_time "PR branch processing completed in ${duration}s" >> "$PR_LOG"

    return 0
}

# Функция для мониторинга процессов
monitor_processes() {
    local base_pid=$1
    local pr_pid=$2
    local start_time=$(date +%s)

    print_color $BLUE "⏳ Monitoring parallel build processes..."
    print_color $YELLOW "   Base branch PID: $base_pid"
    print_color $YELLOW "   PR branch PID: $pr_pid"

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

        # Показываем прогресс каждые 5 секунд
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))

        if [ $((elapsed % 5)) -eq 0 ]; then
            print_color $BLUE "⏱️  Elapsed time: ${elapsed}s"
        fi

        sleep 1
    done

    local total_time=$(date +%s)
    local total_duration=$((total_time - start_time))

    print_color $BLUE "📊 Parallel build summary:"
    print_color $BLUE "   Total time: ${total_duration}s"
    print_color $BLUE "   Base result: $([ $base_result -eq 0 ] && echo "SUCCESS" || echo "FAILED")"
    print_color $BLUE "   PR result: $([ $pr_result -eq 0 ] && echo "SUCCESS" || echo "FAILED")"

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
        print_color $RED "❌ Parallel build failed. Showing logs:"

        if [ -f "$BASE_LOG" ]; then
            print_color $YELLOW "📋 Base branch log:"
            cat "$BASE_LOG"
            echo
        fi

        if [ -f "$PR_LOG" ]; then
            print_color $YELLOW "📋 PR branch log:"
            cat "$PR_LOG"
            echo
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
}

# Основная логика выполнения
main() {
    local start_time=$(date +%s)

    print_color $BLUE "🔄 Initializing parallel build process..."

    # Проверяем наличие необходимых директорий
    if [ ! -d "base-branch" ] || [ ! -d "pr-branch" ]; then
        print_color $RED "❌ Required directories not found"
        echo "Expected: base-branch/ and pr-branch/"
        exit 1
    fi

    # Запускаем параллельные процессы
    print_color $BLUE "🚀 Starting parallel builds..."

    # Запускаем сборку базовой ветки в фоне
    build_base_branch &
    local base_pid=$!

    # Запускаем сборку PR ветки в фоне
    build_pr_branch &
    local pr_pid=$!

    # Мониторим выполнение
    if monitor_processes $base_pid $pr_pid; then
        local end_time=$(date +%s)
        local total_duration=$((end_time - start_time))

        print_color $GREEN "🎉 Parallel build completed successfully in ${total_duration}s!"

        # Проверяем, что снимки созданы
        if [ -f "base-snapshot.json" ] && [ -f "pr-snapshot.json" ]; then
            print_color $GREEN "✅ Both snapshots created successfully"

            # Показываем размеры снимков для отладки
            local base_size=$(wc -c < base-snapshot.json)
            local pr_size=$(wc -c < pr-snapshot.json)
            print_color $BLUE "📊 Snapshot sizes:"
            print_color $BLUE "   Base: ${base_size} bytes"
            print_color $BLUE "   PR: ${pr_size} bytes"
        else
            print_color $RED "❌ Snapshot files not found"
            show_logs_on_error 1
            cleanup
            exit 1
        fi

        cleanup
        exit 0
    else
        print_color $RED "❌ Parallel build process failed"
        show_logs_on_error 1
        cleanup
        exit 1
    fi
}

# Обработка сигналов для корректного завершения
trap 'print_color $YELLOW "\n⚠️  Build process interrupted"; cleanup; exit 130' INT TERM

# Запуск основной функции
main "$@"
