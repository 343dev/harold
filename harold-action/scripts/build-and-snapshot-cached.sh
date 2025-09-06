#!/bin/bash
set -e

# Улучшенный скрипт сборки и создания снимков с поддержкой кэширования
# Интегрируется с cache-manager.sh для оптимизации производительности

# Функция для вывода ошибок
error_exit() {
    echo "::error::$1" >&2
    exit 1
}

# Функция для вывода предупреждений
warning() {
    echo "::warning::$1" >&2
}

# Функция для вывода информации
info() {
    echo "::notice::$1"
}

# Функция для логирования с timestamp
log_with_time() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Проверка входных параметров
if [ $# -ne 1 ]; then
    error_exit "Usage: $0 <type> where type is 'base' or 'pr'"
fi

SNAPSHOT_TYPE="$1"

# Валидация типа снимка
if [[ "$SNAPSHOT_TYPE" != "base" && "$SNAPSHOT_TYPE" != "pr" ]]; then
    error_exit "Invalid snapshot type: $SNAPSHOT_TYPE. Must be 'base' or 'pr'"
fi

# Получение переменных окружения с значениями по умолчанию
BUILD_COMMAND="${BUILD_COMMAND:-npm run build}"
BUILD_PATH="${BUILD_PATH:-dist}"
CONFIG_PATH="${CONFIG_PATH:-.haroldrc.js}"
WORKING_DIR="${WORKING_DIR:-.}"

# Переменные для кэширования
CACHE_MANAGER_SCRIPT="$(dirname "$0")/cache-manager.sh"
COMMIT_SHA=""
ENABLE_CACHING="${ENABLE_CACHING:-true}"

# Определяем commit SHA в зависимости от типа
if [ "$SNAPSHOT_TYPE" = "base" ]; then
    COMMIT_SHA="${GITHUB_BASE_SHA:-$(git rev-parse HEAD 2>/dev/null || echo 'unknown')}"
else
    COMMIT_SHA="${GITHUB_HEAD_SHA:-$(git rev-parse HEAD 2>/dev/null || echo 'unknown')}"
fi

info "Starting cached build and snapshot process for $SNAPSHOT_TYPE branch"
log_with_time "Configuration:"
log_with_time "  Working directory: $WORKING_DIR"
log_with_time "  Build command: $BUILD_COMMAND"
log_with_time "  Build path: $BUILD_PATH"
log_with_time "  Config path: $CONFIG_PATH"
log_with_time "  Commit SHA: $COMMIT_SHA"
log_with_time "  Caching enabled: $ENABLE_CACHING"

# Переход в рабочую директорию
if [ ! -d "$WORKING_DIR" ]; then
    error_exit "Working directory does not exist: $WORKING_DIR"
fi

cd "$WORKING_DIR" || error_exit "Failed to change to working directory: $WORKING_DIR"

# Функция для проверки кэша снимка
check_snapshot_cache() {
    if [ "$ENABLE_CACHING" != "true" ] || [ ! -f "$CACHE_MANAGER_SCRIPT" ]; then
        return 1
    fi

    local output_file="../${SNAPSHOT_TYPE}-snapshot.json"

    log_with_time "Checking snapshot cache for $SNAPSHOT_TYPE ($COMMIT_SHA)..."

    if "$CACHE_MANAGER_SCRIPT" restore-snapshot "$COMMIT_SHA" "$SNAPSHOT_TYPE" "$output_file"; then
        log_with_time "✅ Snapshot restored from cache"
        return 0
    else
        log_with_time "No valid cached snapshot found"
        return 1
    fi
}

# Функция для проверки кэша сборки
check_build_cache() {
    if [ "$ENABLE_CACHING" != "true" ] || [ ! -f "$CACHE_MANAGER_SCRIPT" ]; then
        return 1
    fi

    log_with_time "Checking build cache for $SNAPSHOT_TYPE ($COMMIT_SHA)..."

    # Генерируем идентификатор сборки на основе исходных файлов
    local build_id="${SNAPSHOT_TYPE}_${COMMIT_SHA}"

    if "$CACHE_MANAGER_SCRIPT" restore-build "$build_id" "$BUILD_PATH"; then
        log_with_time "✅ Build result restored from cache"
        return 0
    else
        log_with_time "No valid cached build found"
        return 1
    fi
}

# Функция для кэширования результатов сборки
cache_build_result() {
    if [ "$ENABLE_CACHING" != "true" ] || [ ! -f "$CACHE_MANAGER_SCRIPT" ]; then
        return 0
    fi

    if [ ! -d "$BUILD_PATH" ]; then
        log_with_time "Build directory not found, skipping build cache"
        return 0
    fi

    local build_id="${SNAPSHOT_TYPE}_${COMMIT_SHA}"

    log_with_time "Caching build result..."

    if "$CACHE_MANAGER_SCRIPT" cache-build "$BUILD_PATH" "$build_id"; then
        log_with_time "✅ Build result cached successfully"
    else
        log_with_time "⚠️  Failed to cache build result"
    fi
}

# Функция для кэширования снимка
cache_snapshot_result() {
    if [ "$ENABLE_CACHING" != "true" ] || [ ! -f "$CACHE_MANAGER_SCRIPT" ]; then
        return 0
    fi

    local snapshot_file="../${SNAPSHOT_TYPE}-snapshot.json"

    if [ ! -f "$snapshot_file" ]; then
        log_with_time "Snapshot file not found, skipping snapshot cache"
        return 0
    fi

    log_with_time "Caching snapshot result..."

    if "$CACHE_MANAGER_SCRIPT" cache-snapshot "$snapshot_file" "$COMMIT_SHA" "$SNAPSHOT_TYPE"; then
        log_with_time "✅ Snapshot cached successfully"
    else
        log_with_time "⚠️  Failed to cache snapshot"
    fi
}

# Функция для выполнения сборки
perform_build() {
    local start_time=$(date +%s)

    log_with_time "Starting build process..."

    # Проверяем, есть ли package.json для установки зависимостей
    if [ -f "package.json" ]; then
        log_with_time "Installing dependencies..."

        # Определяем менеджер пакетов
        if [ -f "yarn.lock" ]; then
            log_with_time "Using Yarn..."
            yarn install --frozen-lockfile --silent || yarn install --silent
        elif [ -f "pnpm-lock.yaml" ]; then
            log_with_time "Using pnpm..."
            pnpm install --frozen-lockfile || pnpm install
        else
            log_with_time "Using npm..."
            npm ci --silent || npm install --silent
        fi

        log_with_time "✅ Dependencies installed"
    fi

    # Выполняем команду сборки
    log_with_time "Executing build command: $BUILD_COMMAND"

    if eval "$BUILD_COMMAND"; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log_with_time "✅ Build completed successfully in ${duration}s"

        # Проверяем результат сборки
        if [ ! -d "$BUILD_PATH" ]; then
            error_exit "Build directory not found after build: $BUILD_PATH"
        fi

        local file_count=$(find "$BUILD_PATH" -type f | wc -l)
        local total_size=$(du -sh "$BUILD_PATH" | cut -f1)

        log_with_time "Build statistics:"
        log_with_time "  Files created: $file_count"
        log_with_time "  Total size: $total_size"

        return 0
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        error_exit "Build failed after ${duration}s. Command: $BUILD_COMMAND"
    fi
}

# Функция для создания снимка Harold
create_harold_snapshot() {
    local start_time=$(date +%s)

    log_with_time "Creating Harold snapshot..."

    # Проверяем наличие Harold
    if ! command -v harold >/dev/null 2>&1; then
        error_exit "Harold command not found. Please ensure Harold is installed."
    fi

    # Формируем команду Harold
    local harold_cmd="harold snapshot"
    local output_file="../${SNAPSHOT_TYPE}-snapshot.json"

    # Добавляем параметры
    harold_cmd="$harold_cmd --output $output_file"

    if [ -f "$CONFIG_PATH" ]; then
        harold_cmd="$harold_cmd --config $CONFIG_PATH"
        log_with_time "Using config file: $CONFIG_PATH"
    else
        log_with_time "Config file not found, using default configuration"
    fi

    if [ -n "$BUILD_PATH" ]; then
        harold_cmd="$harold_cmd --path $BUILD_PATH"
        log_with_time "Analyzing build path: $BUILD_PATH"
    fi

    # Выполняем команду Harold
    log_with_time "Executing: $harold_cmd"

    if eval "$harold_cmd"; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log_with_time "✅ Harold snapshot created successfully in ${duration}s"

        # Проверяем результат
        if [ ! -f "$output_file" ]; then
            error_exit "Harold snapshot file not created: $output_file"
        fi

        local snapshot_size=$(wc -c < "$output_file")
        log_with_time "Snapshot size: $snapshot_size bytes"

        return 0
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        error_exit "Harold snapshot creation failed after ${duration}s"
    fi
}

# Функция для оптимизации производительности
optimize_performance() {
    log_with_time "Applying performance optimizations..."

    # Настройки Node.js для производительности
    export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"

    # Настройки npm для ускорения
    if command -v npm >/dev/null 2>&1; then
        npm config set progress false --silent 2>/dev/null || true
        npm config set audit false --silent 2>/dev/null || true
    fi

    # Настройки Git для производительности
    git config --global core.preloadindex true 2>/dev/null || true
    git config --global core.fscache true 2>/dev/null || true

    log_with_time "✅ Performance optimizations applied"
}

# Основная логика выполнения
main() {
    local total_start_time=$(date +%s)

    # Инициализируем кэш
    if [ "$ENABLE_CACHING" = "true" ] && [ -f "$CACHE_MANAGER_SCRIPT" ]; then
        "$CACHE_MANAGER_SCRIPT" init
    fi

    # Применяем оптимизации производительности
    optimize_performance

    # Проверяем кэш снимка (полная оптимизация)
    if check_snapshot_cache; then
        log_with_time "🚀 Snapshot found in cache - skipping build and snapshot creation"

        local total_end_time=$(date +%s)
        local total_duration=$((total_end_time - total_start_time))

        info "✅ Cached build and snapshot process completed in ${total_duration}s"
        exit 0
    fi

    # Проверяем кэш сборки
    local build_from_cache=false
    if check_build_cache; then
        log_with_time "🚀 Build result found in cache - skipping build step"
        build_from_cache=true
    else
        # Выполняем сборку
        perform_build

        # Кэшируем результат сборки
        cache_build_result
    fi

    # Создаем снимок Harold
    create_harold_snapshot

    # Кэшируем снимок
    cache_snapshot_result

    # Показываем статистику кэша
    if [ "$ENABLE_CACHING" = "true" ] && [ -f "$CACHE_MANAGER_SCRIPT" ]; then
        "$CACHE_MANAGER_SCRIPT" stats
    fi

    local total_end_time=$(date +%s)
    local total_duration=$((total_end_time - total_start_time))

    if [ "$build_from_cache" = "true" ]; then
        info "✅ Cached build and snapshot process completed in ${total_duration}s (build from cache)"
    else
        info "✅ Build and snapshot process completed in ${total_duration}s"
    fi
}

# Обработка сигналов для корректного завершения
trap 'log_with_time "Build process interrupted"; exit 130' INT TERM

# Запуск основной функции
main "$@"
