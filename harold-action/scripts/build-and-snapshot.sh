#!/bin/bash
set -e

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

info "Starting build and snapshot process for $SNAPSHOT_TYPE branch"
info "Working directory: $WORKING_DIR"
info "Build command: $BUILD_COMMAND"
info "Build path: $BUILD_PATH"
info "Config path: $CONFIG_PATH"

# Переход в рабочую директорию
if [ ! -d "$WORKING_DIR" ]; then
    error_exit "Working directory does not exist: $WORKING_DIR"
fi

cd "$WORKING_DIR" || error_exit "Failed to change to working directory: $WORKING_DIR"

# Проверка наличия package.json (для npm проектов)
if [[ "$BUILD_COMMAND" == npm* ]] && [ ! -f "package.json" ]; then
    warning "package.json not found in $WORKING_DIR. Build command may fail"
fi

# Установка зависимостей если есть package.json и node_modules отсутствует
if [ -f "package.json" ] && [ ! -d "node_modules" ]; then
    info "Installing dependencies..."
    if npm ci 2>/dev/null || npm install; then
        info "Dependencies installed successfully ✓"
    else
        warning "Failed to install dependencies. Build may fail"
    fi
fi

# Очистка предыдущих результатов сборки
if [ -d "$BUILD_PATH" ]; then
    info "Cleaning previous build output in $BUILD_PATH"
    rm -rf "$BUILD_PATH"
fi

# Выполнение команды сборки с расширенной обработкой ошибок
run_build_command() {
    local build_cmd="$1"
    local log_file="build-${SNAPSHOT_TYPE}.log"

    info "Running build command: $build_cmd"
    build_start_time=$(date +%s)

    # Выполняем команду сборки с детальным логированием
    if eval "$build_cmd" 2>&1 | tee "$log_file"; then
        build_end_time=$(date +%s)
        build_duration=$((build_end_time - build_start_time))
        info "Build completed successfully in ${build_duration}s ✓"
        return 0
    else
        local build_exit_code=$?
        build_end_time=$(date +%s)
        build_duration=$((build_end_time - build_start_time))

        warning "Build command failed after ${build_duration}s with exit code $build_exit_code"

        # Анализируем тип ошибки по логу
        analyze_build_error "$log_file" "$build_exit_code"

        return $build_exit_code
    fi
}

# Анализ ошибок сборки
analyze_build_error() {
    local log_file="$1"
    local exit_code="$2"

    if [ ! -f "$log_file" ]; then
        error_exit "Build failed but no log file found"
    fi

    # Ищем распространенные ошибки в логе
    if grep -qi "ENOSPC\|no space left" "$log_file"; then
        error_exit "Build failed: No space left on device. Try cleaning up or using a larger runner"
    elif grep -qi "ENOMEM\|out of memory" "$log_file"; then
        error_exit "Build failed: Out of memory. Try using a runner with more RAM or optimize your build"
    elif grep -qi "permission denied\|EACCES" "$log_file"; then
        error_exit "Build failed: Permission denied. Check file permissions and runner configuration"
    elif grep -qi "command not found\|not recognized" "$log_file"; then
        error_exit "Build failed: Command not found. Check that all required tools are installed"
    elif grep -qi "module not found\|cannot resolve" "$log_file"; then
        error_exit "Build failed: Missing dependencies. Try running 'npm install' or check your package.json"
    elif grep -qi "syntax error\|unexpected token" "$log_file"; then
        error_exit "Build failed: Syntax error in code. Check the build log for details"
    elif grep -qi "timeout\|timed out" "$log_file"; then
        error_exit "Build failed: Timeout. Try increasing timeout limits or optimizing build performance"
    else
        # Показываем последние строки лога для диагностики
        local last_lines=$(tail -10 "$log_file" 2>/dev/null || echo "Unable to read log file")
        error_exit "Build failed with exit code $exit_code. Last log lines:\n$last_lines\n\nFull log available in $log_file"
    fi
}

# Попытка восстановления после ошибки сборки
attempt_build_recovery() {
    local build_cmd="$1"

    warning "Attempting build recovery..."

    # Очищаем кэш npm если это npm проект
    if [[ "$build_cmd" == npm* ]] && [ -f "package.json" ]; then
        info "Clearing npm cache..."
        npm cache clean --force 2>/dev/null || true

        # Переустанавливаем зависимости
        info "Reinstalling dependencies..."
        rm -rf node_modules package-lock.json 2>/dev/null || true

        if npm install; then
            info "Dependencies reinstalled. Retrying build..."
            return 0
        fi
    fi

    return 1
}

# Основная логика сборки с обработкой ошибок
if ! run_build_command "$BUILD_COMMAND"; then
    build_exit_code=$?

    # Пытаемся восстановиться только для определенных типов ошибок
    if [ $build_exit_code -eq 1 ] && attempt_build_recovery "$BUILD_COMMAND"; then
        # Повторная попытка сборки
        if run_build_command "$BUILD_COMMAND"; then
            info "Build recovery successful! ✓"
        else
            error_exit "Build failed even after recovery attempt. Check build-${SNAPSHOT_TYPE}.log for details"
        fi
    else
        error_exit "Build failed and recovery is not possible. Check build-${SNAPSHOT_TYPE}.log for details"
    fi
fi

# Проверка наличия результатов сборки
if [ ! -d "$BUILD_PATH" ]; then
    error_exit "Build output directory not found: $BUILD_PATH. Build may have failed or used different output path"
fi

# Проверка, что в директории сборки есть файлы
if [ -z "$(find "$BUILD_PATH" -type f 2>/dev/null)" ]; then
    error_exit "Build output directory is empty: $BUILD_PATH. Build may have failed"
fi

file_count=$(find "$BUILD_PATH" -type f | wc -l)
info "Found $file_count files in build output directory ✓"

# Подготовка параметров для harold snapshot
harold_args=()

# Проверка и обработка конфигурационного файла Harold
check_harold_config() {
    local config_file="$1"

    # Проверяем существование файла
    if [ -f "$config_file" ]; then
        info "Found Harold config: $config_file"

        # Проверяем синтаксис JavaScript файла (базовая проверка)
        if node -c "$config_file" 2>/dev/null; then
            info "Harold config syntax is valid ✓"
            return 0
        else
            warning "Harold config has syntax errors: $config_file. Using default configuration"
            return 1
        fi
    else
        # Ищем альтернативные конфигурационные файлы
        local alt_configs=(".haroldrc.js" "harold.config.js" ".harold.config.js")

        for alt_config in "${alt_configs[@]}"; do
            if [ -f "$alt_config" ]; then
                info "Found alternative Harold config: $alt_config"
                CONFIG_PATH="$alt_config"
                return 0
            fi
        done

        info "No Harold config found. Using default configuration"
        return 1
    fi
}

# Добавляем путь к конфигурации если файл существует и валиден
if check_harold_config "$CONFIG_PATH"; then
    harold_args+=("--config" "$CONFIG_PATH")
    info "Using Harold config: $CONFIG_PATH ✓"
fi

# Добавляем путь к результатам сборки
harold_args+=("--path" "$BUILD_PATH")

# Определяем имя выходного файла снимка
snapshot_filename="${SNAPSHOT_TYPE}-snapshot.json"
harold_args+=("--output" "../$snapshot_filename")

# Выполнение harold snapshot с обработкой ошибок
run_harold_snapshot() {
    local log_file="harold-${SNAPSHOT_TYPE}.log"

    info "Creating Harold snapshot..."
    info "Command: harold snapshot ${harold_args[*]}"

    if harold snapshot "${harold_args[@]}" 2>&1 | tee "$log_file"; then
        info "Harold snapshot created successfully ✓"
        return 0
    else
        local harold_exit_code=$?
        warning "Harold snapshot failed with exit code $harold_exit_code"

        # Анализируем ошибку Harold
        if [ -f "$log_file" ]; then
            if grep -qi "ENOENT\|no such file" "$log_file"; then
                error_exit "Harold failed: Build output directory not found or empty. Check build configuration"
            elif grep -qi "permission denied" "$log_file"; then
                error_exit "Harold failed: Permission denied accessing build files"
            elif grep -qi "invalid configuration\|config error" "$log_file"; then
                error_exit "Harold failed: Invalid configuration file. Check .haroldrc.js syntax"
            else
                local last_lines=$(tail -5 "$log_file" 2>/dev/null || echo "Unable to read log")
                error_exit "Harold snapshot failed: $last_lines"
            fi
        else
            error_exit "Harold snapshot failed with exit code $harold_exit_code (no log available)"
        fi

        return $harold_exit_code
    fi
}

# Запуск Harold с обработкой ошибок
run_harold_snapshot

# Проверка создания файла снимка
if [ ! -f "../$snapshot_filename" ]; then
    error_exit "Snapshot file was not created: $snapshot_filename"
fi

# Проверка валидности JSON в снимке
if ! python3 -m json.tool "../$snapshot_filename" > /dev/null 2>&1 && ! node -e "JSON.parse(require('fs').readFileSync('../$snapshot_filename', 'utf8'))" 2>/dev/null; then
    error_exit "Created snapshot file is not valid JSON: $snapshot_filename"
fi

snapshot_size=$(stat -f%z "../$snapshot_filename" 2>/dev/null || stat -c%s "../$snapshot_filename" 2>/dev/null || echo "unknown")
info "Snapshot file created: $snapshot_filename (${snapshot_size} bytes) ✓"

# Возвращаемся в исходную директорию
cd - > /dev/null

info "Build and snapshot process completed successfully for $SNAPSHOT_TYPE branch! 🎉"
