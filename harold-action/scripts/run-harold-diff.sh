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

# Имена файлов снимков
BASE_SNAPSHOT="base-snapshot.json"
PR_SNAPSHOT="pr-snapshot.json"
OUTPUT_FILE="harold-output.txt"
EXIT_CODE_FILE="harold-exit-code.txt"

info "Starting Harold diff analysis..."

# Проверка существования файлов снимков
check_snapshot_files() {
    local missing_files=()
    local partial_analysis=false

    if [ ! -f "$BASE_SNAPSHOT" ]; then
        missing_files+=("$BASE_SNAPSHOT")
    fi

    if [ ! -f "$PR_SNAPSHOT" ]; then
        missing_files+=("$PR_SNAPSHOT")
    fi

    # Обработка различных сценариев отсутствия файлов
    if [ ${#missing_files[@]} -eq 2 ]; then
        error_exit "Both snapshot files are missing: $BASE_SNAPSHOT, $PR_SNAPSHOT. Build steps failed"
    elif [ ${#missing_files[@]} -eq 1 ]; then
        if [[ " ${missing_files[*]} " =~ " $BASE_SNAPSHOT " ]]; then
            warning "Base snapshot missing: $BASE_SNAPSHOT. Will show only PR branch analysis"
            create_fallback_analysis "base_missing"
            partial_analysis=true
        else
            warning "PR snapshot missing: $PR_SNAPSHOT. Will show only base branch analysis"
            create_fallback_analysis "pr_missing"
            partial_analysis=true
        fi
    else
        info "Found snapshot files: $BASE_SNAPSHOT, $PR_SNAPSHOT ✓"
    fi

    return $([ "$partial_analysis" = true ] && echo 1 || echo 0)
}

# Создание fallback анализа когда один из снимков отсутствует
create_fallback_analysis() {
    local scenario="$1"

    case "$scenario" in
        "base_missing")
            if [ -f "$PR_SNAPSHOT" ]; then
                info "Creating analysis for PR branch only..."
                echo "Base branch snapshot is not available (build may have failed)" > "$OUTPUT_FILE"
                echo "" >> "$OUTPUT_FILE"
                echo "PR Branch Analysis:" >> "$OUTPUT_FILE"

                # Пытаемся извлечь информацию из PR снимка
                if command -v jq &> /dev/null; then
                    local total_size=$(jq -r '.total.all.size // "unknown"' "$PR_SNAPSHOT" 2>/dev/null)
                    local total_gzip=$(jq -r '.total.all.gzipSize // "unknown"' "$PR_SNAPSHOT" 2>/dev/null)
                    local file_count=$(jq '.fsEntries | length' "$PR_SNAPSHOT" 2>/dev/null)

                    echo "Total size: $total_size bytes (gzipped: $total_gzip bytes)" >> "$OUTPUT_FILE"
                    echo "Files: $file_count" >> "$OUTPUT_FILE"
                fi

                echo "1" > "$EXIT_CODE_FILE"  # Указываем что есть "изменения" (нет базы для сравнения)
            fi
            ;;
        "pr_missing")
            if [ -f "$BASE_SNAPSHOT" ]; then
                info "Creating analysis for base branch only..."
                echo "PR branch snapshot is not available (build may have failed)" > "$OUTPUT_FILE"
                echo "" >> "$OUTPUT_FILE"
                echo "Base Branch Analysis:" >> "$OUTPUT_FILE"

                # Пытаемся извлечь информацию из базового снимка
                if command -v jq &> /dev/null; then
                    local total_size=$(jq -r '.total.all.size // "unknown"' "$BASE_SNAPSHOT" 2>/dev/null)
                    local total_gzip=$(jq -r '.total.all.gzipSize // "unknown"' "$BASE_SNAPSHOT" 2>/dev/null)
                    local file_count=$(jq '.fsEntries | length' "$BASE_SNAPSHOT" 2>/dev/null)

                    echo "Total size: $total_size bytes (gzipped: $total_gzip bytes)" >> "$OUTPUT_FILE"
                    echo "Files: $file_count" >> "$OUTPUT_FILE"
                fi

                echo "1" > "$EXIT_CODE_FILE"  # Указываем что есть "изменения" (нет PR для сравнения)
            fi
            ;;
    esac
}

# Валидация JSON файлов снимков
validate_snapshots() {
    local invalid_files=()

    # Проверяем базовый снимок
    if ! python3 -m json.tool "$BASE_SNAPSHOT" > /dev/null 2>&1 && ! node -e "JSON.parse(require('fs').readFileSync('$BASE_SNAPSHOT', 'utf8'))" 2>/dev/null; then
        invalid_files+=("$BASE_SNAPSHOT")
    fi

    # Проверяем снимок PR
    if ! python3 -m json.tool "$PR_SNAPSHOT" > /dev/null 2>&1 && ! node -e "JSON.parse(require('fs').readFileSync('$PR_SNAPSHOT', 'utf8'))" 2>/dev/null; then
        invalid_files+=("$PR_SNAPSHOT")
    fi

    if [ ${#invalid_files[@]} -gt 0 ]; then
        error_exit "Invalid JSON in snapshot files: ${invalid_files[*]}"
    fi

    info "Snapshot files are valid JSON ✓"
}

# Получение размера снимка для информации
get_snapshot_info() {
    local snapshot_file="$1"
    local label="$2"

    if [ -f "$snapshot_file" ]; then
        local size=$(stat -f%z "$snapshot_file" 2>/dev/null || stat -c%s "$snapshot_file" 2>/dev/null || echo "unknown")
        local file_count="unknown"

        # Пытаемся извлечь количество файлов из снимка
        if command -v jq &> /dev/null; then
            file_count=$(jq '.fsEntries | length' "$snapshot_file" 2>/dev/null || echo "unknown")
        elif node -e "console.log(Object.keys(JSON.parse(require('fs').readFileSync('$snapshot_file', 'utf8')).fsEntries || {}).length)" 2>/dev/null; then
            file_count=$(node -e "console.log(Object.keys(JSON.parse(require('fs').readFileSync('$snapshot_file', 'utf8')).fsEntries || {}).length)" 2>/dev/null)
        fi

        info "$label snapshot: ${size} bytes, ${file_count} files"
    fi
}

# Выполнение harold diff
run_harold_diff() {
    info "Running harold diff command..."
    info "Command: harold diff $BASE_SNAPSHOT $PR_SNAPSHOT"

    # Запускаем harold diff и сохраняем вывод
    # Harold возвращает exit code 1 если есть различия (это нормально)
    # Exit code > 1 означает ошибку
    if harold diff "$BASE_SNAPSHOT" "$PR_SNAPSHOT" > "$OUTPUT_FILE" 2>&1; then
        # Exit code 0 - нет изменений
        echo "0" > "$EXIT_CODE_FILE"
        info "No changes detected between snapshots"
    else
        local exit_code=$?
        echo "$exit_code" > "$EXIT_CODE_FILE"

        if [ $exit_code -eq 1 ]; then
            # Exit code 1 - есть изменения (нормальная ситуация)
            info "Changes detected in bundle size ✓"
        else
            # Exit code > 1 - ошибка выполнения
            warning "Harold diff failed with exit code $exit_code"
            analyze_harold_error "$exit_code"
        fi
    fi
}

# Анализ ошибок harold diff
analyze_harold_error() {
    local exit_code="$1"

    if [ -f "$OUTPUT_FILE" ]; then
        local error_content=$(cat "$OUTPUT_FILE")

        # Анализируем типичные ошибки
        if echo "$error_content" | grep -qi "ENOENT\|no such file"; then
            error_exit "Harold diff failed: Snapshot files not found or corrupted"
        elif echo "$error_content" | grep -qi "invalid json\|parse error"; then
            error_exit "Harold diff failed: Invalid JSON in snapshot files"
        elif echo "$error_content" | grep -qi "permission denied"; then
            error_exit "Harold diff failed: Permission denied accessing snapshot files"
        elif echo "$error_content" | grep -qi "out of memory\|ENOMEM"; then
            error_exit "Harold diff failed: Out of memory. Snapshots may be too large"
        elif echo "$error_content" | grep -qi "command not found"; then
            error_exit "Harold diff failed: Harold command not found. Installation may have failed"
        elif echo "$error_content" | grep -qi "timeout\|timed out"; then
            error_exit "Harold diff failed: Operation timed out. Snapshots may be too large"
        elif echo "$error_content" | grep -qi "EACCES"; then
            error_exit "Harold diff failed: Access denied. Check file permissions"
        elif echo "$error_content" | grep -qi "EMFILE\|too many open files"; then
            error_exit "Harold diff failed: Too many open files. Reduce snapshot size or increase limits"
        else
            # Показываем содержимое файла ошибки
            warning "Harold diff error output:"
            echo "$error_content" >&2

            # Пытаемся создать fallback отчет
            create_error_fallback_report "$exit_code" "$error_content"
        fi
    else
        error_exit "Harold diff failed with exit code $exit_code (no output captured)"
    fi
}

# Создание fallback отчета при ошибках
create_error_fallback_report() {
    local exit_code="$1"
    local error_content="$2"

    warning "Creating fallback error report..."

    {
        echo "Harold diff analysis failed"
        echo "Exit code: $exit_code"
        echo ""
        echo "Error details:"
        echo "$error_content"
        echo ""
        echo "This may indicate:"
        echo "- Corrupted snapshot files"
        echo "- Insufficient system resources"
        echo "- Harold installation issues"
        echo ""
        echo "Please check the build logs and try again"
    } > "$OUTPUT_FILE"

    echo "$exit_code" > "$EXIT_CODE_FILE"

    warning "Fallback error report created. Action will continue with limited information"
}

# Проверка и обработка результата
process_diff_result() {
    # Проверяем, что файл вывода создан
    if [ ! -f "$OUTPUT_FILE" ]; then
        error_exit "Harold output file was not created: $OUTPUT_FILE"
    fi

    # Проверяем, что файл exit code создан
    if [ ! -f "$EXIT_CODE_FILE" ]; then
        error_exit "Harold exit code file was not created: $EXIT_CODE_FILE"
    fi

    local exit_code=$(cat "$EXIT_CODE_FILE")
    local output_size=$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE" 2>/dev/null || echo "0")

    # Если нет вывода, создаем сообщение по умолчанию
    if [ "$output_size" -eq 0 ] || [ ! -s "$OUTPUT_FILE" ]; then
        if [ "$exit_code" -eq 0 ]; then
            echo "Snapshots are equal - no changes detected" > "$OUTPUT_FILE"
        else
            echo "Harold diff completed but produced no output" > "$OUTPUT_FILE"
        fi
    fi

    info "Harold diff result: exit code $exit_code, output size ${output_size} bytes"

    # Показываем краткую сводку результата
    if [ "$exit_code" -eq 0 ]; then
        info "Result: No bundle size changes ✓"
    elif [ "$exit_code" -eq 1 ]; then
        info "Result: Bundle size changes detected ✓"

        # Пытаемся извлечь краткую информацию об изменениях
        if grep -q "Total" "$OUTPUT_FILE"; then
            local total_line=$(grep "Total" "$OUTPUT_FILE" | head -1)
            info "Summary: $total_line"
        fi
    else
        warning "Result: Harold diff completed with warnings (exit code $exit_code)"
    fi
}

# Основная логика
main() {
    # Проверяем файлы снимков и определяем тип анализа
    if check_snapshot_files; then
        # Полный анализ - оба снимка доступны
        validate_snapshots

        # Показываем информацию о снимках
        get_snapshot_info "$BASE_SNAPSHOT" "Base"
        get_snapshot_info "$PR_SNAPSHOT" "PR"

        run_harold_diff
        process_diff_result
    else
        # Частичный анализ - один из снимков отсутствует
        info "Performing partial analysis due to missing snapshot"

        # Показываем информацию о доступных снимках
        [ -f "$BASE_SNAPSHOT" ] && get_snapshot_info "$BASE_SNAPSHOT" "Base"
        [ -f "$PR_SNAPSHOT" ] && get_snapshot_info "$PR_SNAPSHOT" "PR"

        # Файлы уже созданы в create_fallback_analysis
        info "Fallback analysis completed"
    fi

    info "Harold diff analysis completed! 🎉"
}

# Запуск с обработкой ошибок
if ! main; then
    error_exit "Harold diff analysis failed. Check the logs above for details"
fi
