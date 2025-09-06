#!/bin/bash
set -e

echo "🔧 Setting up Harold Bundle Analyzer..."

# Подключаем безопасное логирование, если доступно
if [ -f "/tmp/safe-log.sh" ]; then
    source /tmp/safe-log.sh
fi

# Функция для вывода ошибок
error_exit() {
    if command -v safe_log >/dev/null 2>&1; then
        safe_log "$1" "error"
    else
        echo "::error::$1" >&2
    fi
    exit 1
}

# Функция для вывода предупреждений
warning() {
    if command -v safe_log >/dev/null 2>&1; then
        safe_log "$1" "warning"
    else
        echo "::warning::$1" >&2
    fi
}

# Функция для вывода информации
info() {
    if command -v safe_log >/dev/null 2>&1; then
        safe_log "$1" "info"
    else
        echo "::notice::$1"
    fi
}

# Проверка версии Node.js
check_node_version() {
    if ! command -v node &> /dev/null; then
        error_exit "Node.js is not installed. Harold requires Node.js >= 18.12"
    fi

    local node_version=$(node --version | sed 's/v//')
    local required_version="18.12.0"

    # Простая проверка версии (сравнение строк может быть неточным, но достаточно для основных случаев)
    if [[ "$(printf '%s\n' "$required_version" "$node_version" | sort -V | head -n1)" != "$required_version" ]]; then
        error_exit "Node.js version $node_version is too old. Harold requires Node.js >= $required_version"
    fi

    info "Node.js version: $node_version ✓"
}

# Проверка наличия npm
check_npm() {
    if ! command -v npm &> /dev/null; then
        error_exit "npm is not installed. Please install npm to use Harold"
    fi

    local npm_version=$(npm --version)
    info "npm version: $npm_version ✓"
}

# Установка Harold
install_harold() {
    info "Installing Harold..."

    # Проверяем, установлен ли harold уже
    if command -v harold &> /dev/null; then
        local harold_version=$(harold --version 2>/dev/null || echo "unknown")
        info "Harold is already installed (version: $harold_version)"
        return 0
    fi

    # Устанавливаем harold глобально
    if npm install -g @343dev/harold; then
        info "Harold installed successfully ✓"
    else
        error_exit "Failed to install Harold. Please check your npm configuration and permissions"
    fi
}

# Проверка успешности установки
verify_harold_installation() {
    if ! command -v harold &> /dev/null; then
        error_exit "Harold installation verification failed. Command 'harold' not found in PATH"
    fi

    # Проверяем, что harold может выполнить базовые команды
    if ! harold --version &> /dev/null; then
        warning "Harold is installed but --version command failed. This might indicate a problem"
    else
        local harold_version=$(harold --version)
        info "Harold verification successful. Version: $harold_version ✓"
    fi

    # Проверяем доступность команд snapshot и diff
    if harold --help | grep -q "snapshot\|diff"; then
        info "Harold commands (snapshot, diff) are available ✓"
    else
        warning "Harold help output doesn't show expected commands. This might indicate an issue"
    fi

    # Проверяем совместимость с текущей системой
    check_system_compatibility

    # Проверяем зависимости Harold
    check_harold_dependencies
}

# Проверка совместимости системы
check_system_compatibility() {
    local os_type=$(uname -s)
    local arch_type=$(uname -m)

    info "System: $os_type $arch_type"

    # Проверяем поддерживаемые операционные системы
    case "$os_type" in
        Linux|Darwin)
            info "Operating system $os_type is supported ✓"
            ;;
        MINGW*|CYGWIN*|MSYS*)
            info "Windows environment detected: $os_type"
            warning "Windows support may have limitations. Please report any issues"
            ;;
        *)
            warning "Unsupported operating system: $os_type. Harold may not work correctly"
            ;;
    esac

    # Проверяем архитектуру
    case "$arch_type" in
        x86_64|amd64)
            info "Architecture $arch_type is supported ✓"
            ;;
        arm64|aarch64)
            info "ARM64 architecture detected: $arch_type"
            info "ARM64 is supported ✓"
            ;;
        *)
            warning "Architecture $arch_type may not be fully supported"
            ;;
    esac
}

# Проверка зависимостей Harold
check_harold_dependencies() {
    info "Checking Harold dependencies..."

    # Проверяем наличие основных утилит, которые может использовать Harold
    local missing_deps=()

    # gzip для сжатия файлов
    if ! command -v gzip &> /dev/null; then
        missing_deps+=("gzip")
    fi

    # find для поиска файлов (обычно есть везде, но проверим)
    if ! command -v find &> /dev/null; then
        missing_deps+=("find")
    fi

    if [ ${#missing_deps[@]} -gt 0 ]; then
        warning "Missing optional dependencies: ${missing_deps[*]}. Harold may have limited functionality"
    else
        info "All Harold dependencies are available ✓"
    fi
}

# Основная логика
main() {
    info "Starting Harold setup process..."

    check_node_version
    check_npm
    install_harold
    verify_harold_installation

    info "Harold setup completed successfully! 🎉"
}

# Запуск с обработкой ошибок
if ! main; then
    error_exit "Harold setup failed. Please check the logs above for details"
fi
