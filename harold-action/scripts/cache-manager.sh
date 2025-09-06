#!/bin/bash

# Скрипт для управления кэшированием Harold Action
# Реализует интеллектуальное кэширование снимков и результатов сборки

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

# Константы для кэширования
CACHE_DIR=".harold-cache"
SNAPSHOTS_CACHE_DIR="$CACHE_DIR/snapshots"
BUILD_CACHE_DIR="$CACHE_DIR/builds"
METADATA_CACHE_DIR="$CACHE_DIR/metadata"

# Максимальный возраст кэша (в секундах)
MAX_CACHE_AGE=$((7 * 24 * 60 * 60))  # 7 дней
MAX_SNAPSHOT_AGE=$((24 * 60 * 60))    # 24 часа для снимков
MAX_BUILD_AGE=$((12 * 60 * 60))       # 12 часов для сборок

print_color $BLUE "💾 Harold Cache Manager"

# Функция для инициализации кэша
init_cache() {
    log_with_time "Initializing cache directories..."

    mkdir -p "$CACHE_DIR"
    mkdir -p "$SNAPSHOTS_CACHE_DIR"
    mkdir -p "$BUILD_CACHE_DIR"
    mkdir -p "$METADATA_CACHE_DIR"

    # Создаем файл конфигурации кэша
    cat > "$CACHE_DIR/config.json" << EOF
{
  "version": "1.0.0",
  "created": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "maxCacheAge": $MAX_CACHE_AGE,
  "maxSnapshotAge": $MAX_SNAPSHOT_AGE,
  "maxBuildAge": $MAX_BUILD_AGE,
  "compressionEnabled": true,
  "cleanupEnabled": true
}
EOF

    log_with_time "✅ Cache directories initialized"
}

# Функция для генерации ключа кэша
generate_cache_key() {
    local type="$1"
    local identifier="$2"

    case "$type" in
        "snapshot")
            # Ключ для снимка основан на commit SHA и конфигурации
            local config_hash=""
            if [ -f "$CONFIG_PATH" ]; then
                config_hash=$(sha256sum "$CONFIG_PATH" | cut -d' ' -f1)
            fi

            local package_hash=""
            if [ -f "package.json" ]; then
                package_hash=$(sha256sum package.json | cut -d' ' -f1)
            fi

            echo "snapshot_${identifier}_${config_hash}_${package_hash}" | sha256sum | cut -d' ' -f1
            ;;
        "build")
            # Ключ для сборки основан на исходных файлах
            local source_hash=$(find . -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" -o -name "*.vue" -o -name "*.css" -o -name "*.scss" | \
                sort | xargs cat 2>/dev/null | sha256sum | cut -d' ' -f1)
            echo "build_${identifier}_${source_hash}"
            ;;
        "metadata")
            # Ключ для метаданных
            echo "metadata_${identifier}_$(date +%Y%m%d)"
            ;;
        *)
            echo "unknown_${identifier}"
            ;;
    esac
}

# Функция для проверки валидности кэша
is_cache_valid() {
    local cache_file="$1"
    local max_age="$2"

    if [ ! -f "$cache_file" ]; then
        return 1
    fi

    local file_age=$(( $(date +%s) - $(stat -c %Y "$cache_file" 2>/dev/null || echo "0") ))

    if [ $file_age -gt $max_age ]; then
        log_with_time "Cache file $cache_file is too old (${file_age}s > ${max_age}s)"
        return 1
    fi

    return 0
}

# Функция для сохранения снимка в кэш
cache_snapshot() {
    local snapshot_file="$1"
    local commit_sha="$2"
    local branch_type="$3"  # base или pr

    if [ ! -f "$snapshot_file" ]; then
        log_with_time "Snapshot file $snapshot_file not found"
        return 1
    fi

    local cache_key=$(generate_cache_key "snapshot" "${commit_sha}_${branch_type}")
    local cache_file="$SNAPSHOTS_CACHE_DIR/${cache_key}.json"
    local metadata_file="$SNAPSHOTS_CACHE_DIR/${cache_key}.meta"

    log_with_time "Caching snapshot: $snapshot_file -> $cache_file"

    # Копируем снимок в кэш
    cp "$snapshot_file" "$cache_file"

    # Сжимаем для экономии места
    if command -v gzip >/dev/null 2>&1; then
        gzip -c "$cache_file" > "${cache_file}.gz"
        rm "$cache_file"
        cache_file="${cache_file}.gz"
    fi

    # Создаем метаданные
    cat > "$metadata_file" << EOF
{
  "commitSha": "$commit_sha",
  "branchType": "$branch_type",
  "originalFile": "$snapshot_file",
  "cacheKey": "$cache_key",
  "created": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "compressed": $(command -v gzip >/dev/null 2>&1 && echo "true" || echo "false"),
  "size": $(wc -c < "$snapshot_file")
}
EOF

    log_with_time "✅ Snapshot cached successfully"
    return 0
}

# Функция для восстановления снимка из кэша
restore_snapshot() {
    local commit_sha="$1"
    local branch_type="$2"
    local output_file="$3"

    local cache_key=$(generate_cache_key "snapshot" "${commit_sha}_${branch_type}")
    local cache_file="$SNAPSHOTS_CACHE_DIR/${cache_key}.json"
    local compressed_cache_file="${cache_file}.gz"
    local metadata_file="$SNAPSHOTS_CACHE_DIR/${cache_key}.meta"

    # Проверяем сжатую версию
    if [ -f "$compressed_cache_file" ] && is_cache_valid "$compressed_cache_file" "$MAX_SNAPSHOT_AGE"; then
        log_with_time "Restoring compressed snapshot from cache: $compressed_cache_file"

        if command -v gunzip >/dev/null 2>&1; then
            gunzip -c "$compressed_cache_file" > "$output_file"
            log_with_time "✅ Snapshot restored from compressed cache"
            return 0
        fi
    fi

    # Проверяем несжатую версию
    if [ -f "$cache_file" ] && is_cache_valid "$cache_file" "$MAX_SNAPSHOT_AGE"; then
        log_with_time "Restoring snapshot from cache: $cache_file"
        cp "$cache_file" "$output_file"
        log_with_time "✅ Snapshot restored from cache"
        return 0
    fi

    log_with_time "No valid cached snapshot found for $commit_sha ($branch_type)"
    return 1
}

# Функция для кэширования результатов сборки
cache_build_result() {
    local build_dir="$1"
    local identifier="$2"

    if [ ! -d "$build_dir" ]; then
        log_with_time "Build directory $build_dir not found"
        return 1
    fi

    local cache_key=$(generate_cache_key "build" "$identifier")
    local cache_archive="$BUILD_CACHE_DIR/${cache_key}.tar.gz"
    local metadata_file="$BUILD_CACHE_DIR/${cache_key}.meta"

    log_with_time "Caching build result: $build_dir -> $cache_archive"

    # Создаем архив сборки
    if tar -czf "$cache_archive" -C "$(dirname "$build_dir")" "$(basename "$build_dir")" 2>/dev/null; then
        # Создаем метаданные
        cat > "$metadata_file" << EOF
{
  "identifier": "$identifier",
  "buildDir": "$build_dir",
  "cacheKey": "$cache_key",
  "created": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "size": $(wc -c < "$cache_archive"),
  "fileCount": $(find "$build_dir" -type f | wc -l)
}
EOF

        log_with_time "✅ Build result cached successfully"
        return 0
    else
        log_with_time "❌ Failed to create build cache archive"
        return 1
    fi
}

# Функция для восстановления результатов сборки
restore_build_result() {
    local identifier="$1"
    local output_dir="$2"

    local cache_key=$(generate_cache_key "build" "$identifier")
    local cache_archive="$BUILD_CACHE_DIR/${cache_key}.tar.gz"
    local metadata_file="$BUILD_CACHE_DIR/${cache_key}.meta"

    if [ -f "$cache_archive" ] && is_cache_valid "$cache_archive" "$MAX_BUILD_AGE"; then
        log_with_time "Restoring build result from cache: $cache_archive"

        # Создаем выходную директорию
        mkdir -p "$(dirname "$output_dir")"

        # Извлекаем архив
        if tar -xzf "$cache_archive" -C "$(dirname "$output_dir")" 2>/dev/null; then
            log_with_time "✅ Build result restored from cache"
            return 0
        else
            log_with_time "❌ Failed to extract build cache archive"
            return 1
        fi
    fi

    log_with_time "No valid cached build result found for $identifier"
    return 1
}

# Функция для очистки устаревшего кэша
cleanup_cache() {
    log_with_time "Starting cache cleanup..."

    local cleaned_files=0
    local total_size_before=0
    local total_size_after=0

    # Подсчитываем размер до очистки
    if [ -d "$CACHE_DIR" ]; then
        total_size_before=$(du -sb "$CACHE_DIR" 2>/dev/null | cut -f1 || echo "0")
    fi

    # Очищаем устаревшие снимки
    if [ -d "$SNAPSHOTS_CACHE_DIR" ]; then
        find "$SNAPSHOTS_CACHE_DIR" -type f -name "*.json*" -mtime +1 -delete 2>/dev/null || true
        find "$SNAPSHOTS_CACHE_DIR" -type f -name "*.meta" -mtime +1 -delete 2>/dev/null || true
        cleaned_files=$((cleaned_files + $(find "$SNAPSHOTS_CACHE_DIR" -type f -mtime +1 | wc -l)))
    fi

    # Очищаем устаревшие сборки
    if [ -d "$BUILD_CACHE_DIR" ]; then
        find "$BUILD_CACHE_DIR" -type f -name "*.tar.gz" -mtime +0.5 -delete 2>/dev/null || true
        find "$BUILD_CACHE_DIR" -type f -name "*.meta" -mtime +0.5 -delete 2>/dev/null || true
    fi

    # Очищаем старые метаданные
    if [ -d "$METADATA_CACHE_DIR" ]; then
        find "$METADATA_CACHE_DIR" -type f -mtime +7 -delete 2>/dev/null || true
    fi

    # Подсчитываем размер после очистки
    if [ -d "$CACHE_DIR" ]; then
        total_size_after=$(du -sb "$CACHE_DIR" 2>/dev/null | cut -f1 || echo "0")
    fi

    local size_saved=$((total_size_before - total_size_after))

    print_color $GREEN "🧹 Cache cleanup completed:"
    print_color $GREEN "   Files cleaned: $cleaned_files"
    print_color $GREEN "   Space saved: $(( size_saved / 1024 )) KB"
    print_color $GREEN "   Cache size: $(( total_size_after / 1024 )) KB"
}

# Функция для отображения статистики кэша
show_cache_stats() {
    log_with_time "Generating cache statistics..."

    if [ ! -d "$CACHE_DIR" ]; then
        print_color $YELLOW "No cache directory found"
        return 0
    fi

    local total_size=$(du -sh "$CACHE_DIR" 2>/dev/null | cut -f1 || echo "0")
    local snapshot_count=$(find "$SNAPSHOTS_CACHE_DIR" -name "*.json*" 2>/dev/null | wc -l || echo "0")
    local build_count=$(find "$BUILD_CACHE_DIR" -name "*.tar.gz" 2>/dev/null | wc -l || echo "0")
    local metadata_count=$(find "$METADATA_CACHE_DIR" -name "*.meta" 2>/dev/null | wc -l || echo "0")

    print_color $BLUE "📊 Cache Statistics:"
    print_color $BLUE "   Total cache size: $total_size"
    print_color $BLUE "   Cached snapshots: $snapshot_count"
    print_color $BLUE "   Cached builds: $build_count"
    print_color $BLUE "   Metadata files: $metadata_count"

    # Показываем топ-5 самых больших файлов кэша
    print_color $BLUE "   Largest cache files:"
    find "$CACHE_DIR" -type f -exec ls -lh {} \; 2>/dev/null | \
        sort -k5 -hr | head -5 | \
        awk '{print "     " $9 " (" $5 ")"}' || true
}

# Функция для проверки целостности кэша
verify_cache_integrity() {
    log_with_time "Verifying cache integrity..."

    local corrupted_files=0

    # Проверяем сжатые файлы
    if [ -d "$SNAPSHOTS_CACHE_DIR" ]; then
        for gz_file in "$SNAPSHOTS_CACHE_DIR"/*.gz; do
            [ -f "$gz_file" ] || continue

            if ! gunzip -t "$gz_file" 2>/dev/null; then
                log_with_time "Corrupted compressed file: $gz_file"
                rm -f "$gz_file"
                corrupted_files=$((corrupted_files + 1))
            fi
        done
    fi

    # Проверяем архивы сборок
    if [ -d "$BUILD_CACHE_DIR" ]; then
        for tar_file in "$BUILD_CACHE_DIR"/*.tar.gz; do
            [ -f "$tar_file" ] || continue

            if ! tar -tzf "$tar_file" >/dev/null 2>&1; then
                log_with_time "Corrupted archive file: $tar_file"
                rm -f "$tar_file"
                corrupted_files=$((corrupted_files + 1))
            fi
        done
    fi

    if [ $corrupted_files -eq 0 ]; then
        print_color $GREEN "✅ Cache integrity verified - no corrupted files found"
    else
        print_color $YELLOW "⚠️  Cache integrity check completed - $corrupted_files corrupted files removed"
    fi
}

# Основная логика выполнения
main() {
    local command="${1:-help}"

    case "$command" in
        "init")
            init_cache
            ;;
        "cache-snapshot")
            local snapshot_file="$2"
            local commit_sha="$3"
            local branch_type="$4"

            if [ -z "$snapshot_file" ] || [ -z "$commit_sha" ] || [ -z "$branch_type" ]; then
                print_color $RED "Usage: $0 cache-snapshot <snapshot_file> <commit_sha> <branch_type>"
                exit 1
            fi

            init_cache
            cache_snapshot "$snapshot_file" "$commit_sha" "$branch_type"
            ;;
        "restore-snapshot")
            local commit_sha="$2"
            local branch_type="$3"
            local output_file="$4"

            if [ -z "$commit_sha" ] || [ -z "$branch_type" ] || [ -z "$output_file" ]; then
                print_color $RED "Usage: $0 restore-snapshot <commit_sha> <branch_type> <output_file>"
                exit 1
            fi

            restore_snapshot "$commit_sha" "$branch_type" "$output_file"
            ;;
        "cache-build")
            local build_dir="$2"
            local identifier="$3"

            if [ -z "$build_dir" ] || [ -z "$identifier" ]; then
                print_color $RED "Usage: $0 cache-build <build_dir> <identifier>"
                exit 1
            fi

            init_cache
            cache_build_result "$build_dir" "$identifier"
            ;;
        "restore-build")
            local identifier="$2"
            local output_dir="$3"

            if [ -z "$identifier" ] || [ -z "$output_dir" ]; then
                print_color $RED "Usage: $0 restore-build <identifier> <output_dir>"
                exit 1
            fi

            restore_build_result "$identifier" "$output_dir"
            ;;
        "cleanup")
            cleanup_cache
            ;;
        "stats")
            show_cache_stats
            ;;
        "verify")
            verify_cache_integrity
            ;;
        "help"|*)
            print_color $BLUE "Harold Cache Manager"
            echo
            echo "Usage: $0 <command> [arguments]"
            echo
            echo "Commands:"
            echo "  init                                    Initialize cache directories"
            echo "  cache-snapshot <file> <sha> <type>     Cache a Harold snapshot"
            echo "  restore-snapshot <sha> <type> <file>   Restore a cached snapshot"
            echo "  cache-build <dir> <id>                 Cache build results"
            echo "  restore-build <id> <dir>               Restore cached build results"
            echo "  cleanup                                Clean up old cache files"
            echo "  stats                                  Show cache statistics"
            echo "  verify                                 Verify cache integrity"
            echo "  help                                   Show this help message"
            echo
            ;;
    esac
}

# Запуск основной функции
main "$@"
