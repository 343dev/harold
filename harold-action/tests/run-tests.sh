#!/bin/bash

# Скрипт для запуска тестов Harold Action
# Поддерживает различные режимы тестирования и генерацию отчетов

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

# Функция для вывода заголовка
print_header() {
    echo
    print_color $BLUE "=================================="
    print_color $BLUE "$1"
    print_color $BLUE "=================================="
    echo
}

# Функция для проверки зависимостей
check_dependencies() {
    print_header "Checking Dependencies"

    # Проверяем наличие Node.js
    if ! command -v node &> /dev/null; then
        print_color $RED "❌ Node.js is not installed"
        exit 1
    fi

    local node_version=$(node --version)
    print_color $GREEN "✅ Node.js version: $node_version"

    # Проверяем наличие npm
    if ! command -v npm &> /dev/null; then
        print_color $RED "❌ npm is not installed"
        exit 1
    fi

    local npm_version=$(npm --version)
    print_color $GREEN "✅ npm version: $npm_version"

    # Проверяем package.json
    if [ ! -f "package.json" ]; then
        print_color $RED "❌ package.json not found"
        exit 1
    fi

    print_color $GREEN "✅ package.json found"
}

# Функция для установки зависимостей
install_dependencies() {
    print_header "Installing Dependencies"

    if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
        print_color $YELLOW "📦 Installing npm dependencies..."
        npm install
        print_color $GREEN "✅ Dependencies installed"
    else
        print_color $GREEN "✅ Dependencies already up to date"
    fi
}

# Функция для запуска линтера
run_linter() {
    print_header "Running Linter"

    if npm run lint --silent 2>/dev/null; then
        print_color $GREEN "✅ Linting passed"
    else
        print_color $YELLOW "⚠️  Linter not configured or failed"
    fi
}

# Функция для запуска unit тестов
run_unit_tests() {
    print_header "Running Unit Tests"

    print_color $BLUE "🧪 Running unit tests..."

    if npm run test:unit; then
        print_color $GREEN "✅ Unit tests passed"
        return 0
    else
        print_color $RED "❌ Unit tests failed"
        return 1
    fi
}

# Функция для запуска всех тестов
run_all_tests() {
    print_header "Running All Tests"

    print_color $BLUE "🧪 Running all tests..."

    if npm test; then
        print_color $GREEN "✅ All tests passed"
        return 0
    else
        print_color $RED "❌ Some tests failed"
        return 1
    fi
}

# Функция для генерации отчета о покрытии
generate_coverage() {
    print_header "Generating Coverage Report"

    print_color $BLUE "📊 Generating coverage report..."

    if npm run test:coverage; then
        print_color $GREEN "✅ Coverage report generated"

        if [ -f "coverage/lcov-report/index.html" ]; then
            print_color $BLUE "📄 Coverage report available at: coverage/lcov-report/index.html"
        fi

        return 0
    else
        print_color $RED "❌ Coverage generation failed"
        return 1
    fi
}

# Функция для запуска тестов в watch режиме
run_watch_mode() {
    print_header "Running Tests in Watch Mode"

    print_color $BLUE "👀 Starting tests in watch mode..."
    print_color $YELLOW "Press Ctrl+C to stop"

    npm run test:watch
}

# Функция для очистки
cleanup() {
    print_header "Cleanup"

    print_color $BLUE "🧹 Cleaning up..."

    # Удаляем временные файлы тестов
    find . -name "harold-test-*" -type f -delete 2>/dev/null || true

    # Очищаем coverage если нужно
    if [ "$1" = "--clean-coverage" ]; then
        rm -rf coverage/ 2>/dev/null || true
        print_color $GREEN "✅ Coverage files cleaned"
    fi

    print_color $GREEN "✅ Cleanup completed"
}

# Функция для показа помощи
show_help() {
    echo "Harold Action Test Runner"
    echo
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  --unit              Run only unit tests"
    echo "  --coverage          Run tests with coverage report"
    echo "  --watch             Run tests in watch mode"
    echo "  --lint              Run linter only"
    echo "  --clean             Clean up temporary files"
    echo "  --clean-coverage    Clean up coverage files"
    echo "  --install           Install dependencies only"
    echo "  --check             Check dependencies only"
    echo "  --help              Show this help message"
    echo
    echo "Examples:"
    echo "  $0                  Run all tests"
    echo "  $0 --unit          Run unit tests only"
    echo "  $0 --coverage      Generate coverage report"
    echo "  $0 --watch         Run tests in watch mode"
}

# Функция для отображения статистики
show_stats() {
    print_header "Test Statistics"

    if [ -d "coverage" ]; then
        print_color $BLUE "📊 Coverage Statistics:"

        if [ -f "coverage/coverage-summary.json" ]; then
            # Извлекаем статистики из JSON (если доступен jq)
            if command -v jq &> /dev/null; then
                local lines=$(jq -r '.total.lines.pct' coverage/coverage-summary.json 2>/dev/null || echo "N/A")
                local functions=$(jq -r '.total.functions.pct' coverage/coverage-summary.json 2>/dev/null || echo "N/A")
                local branches=$(jq -r '.total.branches.pct' coverage/coverage-summary.json 2>/dev/null || echo "N/A")
                local statements=$(jq -r '.total.statements.pct' coverage/coverage-summary.json 2>/dev/null || echo "N/A")

                echo "   Lines: ${lines}%"
                echo "   Functions: ${functions}%"
                echo "   Branches: ${branches}%"
                echo "   Statements: ${statements}%"
            else
                print_color $YELLOW "   Install 'jq' for detailed coverage statistics"
            fi
        fi
    fi

    # Подсчитываем количество тестовых файлов
    local test_files=$(find . -name "*.test.js" -o -name "*.spec.js" | wc -l)
    print_color $BLUE "📁 Test Files: $test_files"

    # Размер coverage директории
    if [ -d "coverage" ]; then
        local coverage_size=$(du -sh coverage 2>/dev/null | cut -f1 || echo "N/A")
        print_color $BLUE "💾 Coverage Size: $coverage_size"
    fi
}

# Основная логика
main() {
    local exit_code=0

    # Переходим в директорию скрипта
    cd "$(dirname "$0")"

    # Обработка аргументов
    case "${1:-}" in
        --help|-h)
            show_help
            exit 0
            ;;
        --check)
            check_dependencies
            exit 0
            ;;
        --install)
            check_dependencies
            install_dependencies
            exit 0
            ;;
        --lint)
            check_dependencies
            install_dependencies
            run_linter
            exit $?
            ;;
        --unit)
            check_dependencies
            install_dependencies
            run_unit_tests
            exit_code=$?
            ;;
        --coverage)
            check_dependencies
            install_dependencies
            generate_coverage
            exit_code=$?
            show_stats
            ;;
        --watch)
            check_dependencies
            install_dependencies
            run_watch_mode
            exit 0
            ;;
        --clean)
            cleanup
            exit 0
            ;;
        --clean-coverage)
            cleanup --clean-coverage
            exit 0
            ;;
        "")
            # Запуск по умолчанию - все тесты
            check_dependencies
            install_dependencies
            run_linter
            run_all_tests
            exit_code=$?
            show_stats
            ;;
        *)
            print_color $RED "❌ Unknown option: $1"
            show_help
            exit 1
            ;;
    esac

    # Финальное сообщение
    echo
    if [ $exit_code -eq 0 ]; then
        print_color $GREEN "🎉 All operations completed successfully!"
    else
        print_color $RED "💥 Some operations failed (exit code: $exit_code)"
    fi

    exit $exit_code
}

# Обработка сигналов для корректного завершения
trap 'print_color $YELLOW "\n⚠️  Test execution interrupted"; exit 130' INT TERM

# Запуск основной функции
main "$@"
