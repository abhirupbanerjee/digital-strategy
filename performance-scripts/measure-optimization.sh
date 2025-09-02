#!/bin/bash

# =============================================================================
# DIGITAL STRATEGY BOT v2.0 - OPTIMIZATION MEASUREMENT SCRIPT
# =============================================================================
# Purpose: Create comprehensive baseline and progress tracking
# Usage: ./scripts/measure-optimization.sh [baseline|progress|compare]
# =============================================================================

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
MODE=${1:-"baseline"}
OUTPUT_DIR="$PROJECT_ROOT/optimization-metrics"
BASELINE_FILE="$OUTPUT_DIR/baseline_$TIMESTAMP.json"
PROGRESS_FILE="$OUTPUT_DIR/progress_$TIMESTAMP.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

echo -e "${BLUE}🚀 Digital Strategy Bot v2.0 - Optimization Measurement${NC}"
echo -e "${BLUE}=================================================${NC}"
echo -e "Mode: ${YELLOW}$MODE${NC}"
echo -e "Timestamp: ${YELLOW}$TIMESTAMP${NC}"
echo -e "Project Root: ${YELLOW}$PROJECT_ROOT${NC}"
echo ""

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

log_section() {
    echo -e "\n${BLUE}📊 $1${NC}"
    echo "----------------------------------------"
}

log_metric() {
    echo -e "${GREEN}✓${NC} $1: ${YELLOW}$2${NC}"
}

log_warning() {
    echo -e "${RED}⚠️${NC} $1"
}

# Check if command exists
check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_warning "$1 not found. Install it for complete metrics."
        return 1
    fi
    return 0
}

# =============================================================================
# CODE METRICS FUNCTIONS
# =============================================================================

measure_code_metrics() {
    log_section "Code Metrics"
    
    cd "$PROJECT_ROOT"
    
    # Total Lines of Code
    local total_lines=$(find . -name "*.ts" -o -name "*.tsx" | grep -v node_modules | grep -v .next | xargs wc -l | tail -1 | awk '{print $1}')
    log_metric "Total TypeScript Lines" "$total_lines"
    
    # JavaScript/JSX Lines (if any)
    local js_lines=$(find . -name "*.js" -o -name "*.jsx" | grep -v node_modules | grep -v .next | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}' || echo "0")
    log_metric "Total JavaScript Lines" "$js_lines"
    
    # Component Lines
    local component_lines=$(find ./components -name "*.tsx" | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}' || echo "0")
    log_metric "Component Lines" "$component_lines"
    
    # API Route Lines
    local api_lines=$(find ./app/api -name "*.ts" | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}' || echo "0")
    log_metric "API Route Lines" "$api_lines"
    
    # Service Lines (new)
    local service_lines=$(find ./services -name "*.ts" 2>/dev/null | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}' || echo "0")
    log_metric "Service Lines" "$service_lines"
    
    # Hook Lines
    local hook_lines=$(find ./hooks -name "*.ts" -o -name "*.tsx" | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}' || echo "0")
    log_metric "Hook Lines" "$hook_lines"
    
    echo ""
    echo "📁 Largest Files:"
    find . -name "*.ts" -o -name "*.tsx" | grep -v node_modules | grep -v .next | xargs wc -l | sort -nr | head -10 | while read line; do
        lines=$(echo "$line" | awk '{print $1}')
        file=$(echo "$line" | awk '{print $2}')
        echo "   $lines lines - $file"
    done
    
    # Store metrics
    cat > /tmp/code_metrics.json <<EOF
{
  "timestamp": "$TIMESTAMP",
  "total_lines": $total_lines,
  "js_lines": $js_lines,
  "component_lines": $component_lines,
  "api_lines": $api_lines,
  "service_lines": $service_lines,
  "hook_lines": $hook_lines
}
EOF
}

measure_api_routes() {
    log_section "API Route Analysis"
    
    cd "$PROJECT_ROOT"
    
    echo "🔍 Individual API Route Sizes:"
    
    # Key API routes to track
    local routes=(
        "app/api/chat/route.ts"
        "app/api/upload/route.ts"
        "app/api/cleanup-threads/route.ts"
        "app/api/threads/route.ts"
        "app/api/threads/[id]/route.ts"
        "app/api/projects/route.ts"
        "app/api/projects/[id]/route.ts"
    )
    
    local api_data="{"
    local first=true
    
    for route in "${routes[@]}"; do
        if [ -f "$route" ]; then
            local lines=$(wc -l < "$route")
            echo "   $lines lines - $route"
            
            if [ "$first" = true ]; then
                first=false
            else
                api_data+=","
            fi
            
            local key=$(echo "$route" | sed 's/[\/\[\]]/_/g' | sed 's/\.ts$//')
            api_data+="\"$key\": $lines"
        else
            echo "   NOT FOUND - $route"
        fi
    done
    
    api_data+="}"
    echo "$api_data" > /tmp/api_routes.json
}

measure_dependencies() {
    log_section "Dependencies & Imports"
    
    cd "$PROJECT_ROOT"
    
    # Service imports (key optimization metric)
    local service_imports=$(grep -r "from.*services\/" . --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo "0")
    log_metric "Service Imports" "$service_imports"
    
    # Internal imports
    local internal_imports=$(grep -r "from.*@\/" . --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo "0")
    log_metric "Internal Imports" "$internal_imports"
    
    # External dependencies
    local ext_deps=$(grep -r "from.*['\"]react" . --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo "0")
    log_metric "React Imports" "$ext_deps"
    
    # Duplicate patterns (simple check)
    echo ""
    echo "🔍 Potential Duplication Patterns:"
    
    # Look for repeated import patterns
    echo "   Common service patterns:"
    grep -r "createClient.*supabase" . --include="*.ts" 2>/dev/null | wc -l | xargs -I {} echo "   - Supabase client creation: {} occurrences"
    grep -r "OPENAI_API_KEY" . --include="*.ts" 2>/dev/null | wc -l | xargs -I {} echo "   - OpenAI API key usage: {} occurrences"
    grep -r "TAVILY_API_KEY" . --include="*.ts" 2>/dev/null | wc -l | xargs -I {} echo "   - Tavily API key usage: {} occurrences"
    
    cat > /tmp/dependencies.json <<EOF
{
  "service_imports": $service_imports,
  "internal_imports": $internal_imports,
  "react_imports": $ext_deps
}
EOF
}

measure_performance() {
    log_section "Performance Metrics"
    
    cd "$PROJECT_ROOT"
    
    # Bundle analysis (if built)
    if [ -d ".next" ]; then
        echo "📦 Next.js Build Analysis:"
        
        # Check if we have a recent build
        if [ -f ".next/BUILD_ID" ]; then
            local build_id=$(cat .next/BUILD_ID)
            log_metric "Build ID" "$build_id"
            
            # Analyze bundle sizes
            if [ -d ".next/static" ]; then
                local static_size=$(du -sh .next/static 2>/dev/null | cut -f1 || echo "N/A")
                log_metric "Static Assets Size" "$static_size"
            fi
        else
            log_warning "No recent build found. Run 'npm run build' for bundle metrics."
        fi
    else
        log_warning "No .next directory found. Run 'npm run build' first."
    fi
    
    # Package.json analysis
    if [ -f "package.json" ]; then
        local deps=$(jq '.dependencies | length' package.json 2>/dev/null || echo "N/A")
        local dev_deps=$(jq '.devDependencies | length' package.json 2>/dev/null || echo "N/A")
        log_metric "Production Dependencies" "$deps"
        log_metric "Development Dependencies" "$dev_deps"
    fi
    
    cat > /tmp/performance.json <<EOF
{
  "static_size": "${static_size:-N/A}",
  "dependencies": ${deps:-0},
  "dev_dependencies": ${dev_deps:-0}
}
EOF
}

measure_git_metrics() {
    log_section "Git Repository Metrics"
    
    cd "$PROJECT_ROOT"
    
    if [ -d ".git" ]; then
        local commit_hash=$(git rev-parse HEAD 2>/dev/null || echo "N/A")
        local branch=$(git branch --show-current 2>/dev/null || echo "N/A")
        local commit_count=$(git rev-list --count HEAD 2>/dev/null || echo "0")
        local last_commit=$(git log -1 --format="%cd" --date=iso 2>/dev/null || echo "N/A")
        
        log_metric "Current Commit" "${commit_hash:0:8}"
        log_metric "Current Branch" "$branch"
        log_metric "Total Commits" "$commit_count"
        log_metric "Last Commit" "$last_commit"
        
        echo ""
        echo "📈 Recent Activity:"
        git log --oneline -5 2>/dev/null | sed 's/^/   /' || echo "   No git history available"
        
        cat > /tmp/git_metrics.json <<EOF
{
  "commit_hash": "$commit_hash",
  "branch": "$branch",
  "commit_count": $commit_count,
  "last_commit": "$last_commit"
}
EOF
    else
        log_warning "Not a git repository"
        echo '{}' > /tmp/git_metrics.json
    fi
}

measure_structure() {
    log_section "Project Structure"
    
    cd "$PROJECT_ROOT"
    
    # Directory analysis
    local dirs=(
        "app"
        "components" 
        "hooks"
        "lib"
        "services"
        "types"
        "utils"
    )
    
    echo "📁 Directory Structure:"
    for dir in "${dirs[@]}"; do
        if [ -d "$dir" ]; then
            local file_count=$(find "$dir" -name "*.ts" -o -name "*.tsx" | wc -l)
            local line_count=$(find "$dir" -name "*.ts" -o -name "*.tsx" | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}' || echo "0")
            echo "   $dir/: $file_count files, $line_count lines"
        else
            echo "   $dir/: NOT FOUND"
        fi
    done
    
    # Special files
    echo ""
    echo "📄 Configuration Files:"
    local configs=(
        "package.json"
        "tsconfig.json"
        "next.config.js"
        "tailwind.config.js"
        ".env.local"
        "README.md"
    )
    
    for config in "${configs[@]}"; do
        if [ -f "$config" ]; then
            local size=$(ls -lh "$config" | awk '{print $5}')
            echo "   ✓ $config ($size)"
        else
            echo "   ✗ $config (missing)"
        fi
    done
}

# =============================================================================
# REPORT GENERATION
# =============================================================================

generate_report() {
    local output_file="$1"
    
    log_section "Generating Report"
    
    # Combine all metrics
    local combined_json=$(jq -s '
    {
        "measurement_info": {
            "timestamp": "'$TIMESTAMP'",
            "mode": "'$MODE'",
            "git": .[4]
        },
        "code_metrics": .[0],
        "api_routes": .[1],
        "dependencies": .[2],
        "performance": .[3]
    }' /tmp/code_metrics.json /tmp/api_routes.json /tmp/dependencies.json /tmp/performance.json /tmp/git_metrics.json)
    
    echo "$combined_json" > "$output_file"
    
    log_metric "Report saved to" "$output_file"
    
    # Create human-readable summary
    local summary_file="${output_file%.json}_summary.md"
    
    cat > "$summary_file" <<EOF
# Digital Strategy Bot v2.0 - Optimization Metrics

**Generated:** $(date)  
**Mode:** $MODE  
**Commit:** $(git rev-parse --short HEAD 2>/dev/null || echo "N/A")  

## 📊 Key Metrics

### Code Volume
- **Total Lines:** $(jq -r '.code_metrics.total_lines' "$output_file") TypeScript lines
- **API Routes:** $(jq -r '.code_metrics.api_lines' "$output_file") lines
- **Components:** $(jq -r '.code_metrics.component_lines' "$output_file") lines
- **Services:** $(jq -r '.code_metrics.service_lines' "$output_file") lines

### Optimization Indicators
- **Service Imports:** $(jq -r '.dependencies.service_imports' "$output_file") (target: >15)
- **Dependencies:** $(jq -r '.performance.dependencies' "$output_file") production packages

### API Route Breakdown
$(jq -r '.api_routes | to_entries[] | "- **\(.key):** \(.value) lines"' "$output_file")

## 📈 Progress Tracking

Use this as baseline to measure:
- [ ] Code duplication reduction (target: <10%)
- [ ] Service layer adoption (target: >15 imports)
- [ ] API route optimization (target: 50% reduction)
- [ ] Bundle size impact (target: <2MB)

---
*Generated by optimization measurement script*
EOF
    
    log_metric "Summary saved to" "$summary_file"
}

compare_reports() {
    local baseline_file="$1"
    local current_file="$2"
    
    if [ ! -f "$baseline_file" ] || [ ! -f "$current_file" ]; then
        log_warning "Cannot compare: missing baseline or current file"
        return 1
    fi
    
    log_section "Comparison Report"
    
    echo "📊 Code Metrics Comparison:"
    echo "   Baseline → Current (Change)"
    
    # Compare key metrics
    local metrics=("total_lines" "api_lines" "component_lines" "service_lines")
    
    for metric in "${metrics[@]}"; do
        local baseline_val=$(jq -r ".code_metrics.$metric" "$baseline_file")
        local current_val=$(jq -r ".code_metrics.$metric" "$current_file")
        local diff=$((current_val - baseline_val))
        local pct_change=$(echo "scale=1; ($diff * 100) / $baseline_val" | bc 2>/dev/null || echo "N/A")
        
        if [ "$diff" -lt 0 ]; then
            echo -e "   ${GREEN}✓${NC} $metric: $baseline_val → $current_val (${diff}, ${pct_change}%)"
        elif [ "$diff" -gt 0 ]; then
            echo -e "   ${RED}⚠${NC} $metric: $baseline_val → $current_val (+${diff}, +${pct_change}%)"
        else
            echo -e "   ${YELLOW}-${NC} $metric: $baseline_val → $current_val (no change)"
        fi
    done
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

main() {
    case "$MODE" in
        "baseline")
            echo -e "${GREEN}Creating baseline measurement...${NC}"
            measure_code_metrics
            measure_api_routes
            measure_dependencies
            measure_performance
            measure_git_metrics
            measure_structure
            generate_report "$BASELINE_FILE"
            echo -e "\n${GREEN}✅ Baseline measurement complete!${NC}"
            echo -e "📁 Files created:"
            echo -e "   - Metrics: ${YELLOW}$BASELINE_FILE${NC}"
            echo -e "   - Summary: ${YELLOW}${BASELINE_FILE%.json}_summary.md${NC}"
            ;;
            
        "progress")
            echo -e "${GREEN}Measuring current progress...${NC}"
            measure_code_metrics
            measure_api_routes
            measure_dependencies
            measure_performance
            measure_git_metrics
            measure_structure
            generate_report "$PROGRESS_FILE"
            
            # Try to find most recent baseline for comparison
            local latest_baseline=$(ls -t "$OUTPUT_DIR"/baseline_*.json 2>/dev/null | head -1)
            if [ -n "$latest_baseline" ]; then
                echo -e "\n${BLUE}Comparing with baseline...${NC}"
                compare_reports "$latest_baseline" "$PROGRESS_FILE"
            fi
            
            echo -e "\n${GREEN}✅ Progress measurement complete!${NC}"
            ;;
            
        "compare")
            echo -e "${GREEN}Comparing measurements...${NC}"
            local baseline=$(ls -t "$OUTPUT_DIR"/baseline_*.json 2>/dev/null | head -1)
            local progress=$(ls -t "$OUTPUT_DIR"/progress_*.json 2>/dev/null | head -1)
            
            if [ -n "$baseline" ] && [ -n "$progress" ]; then
                compare_reports "$baseline" "$progress"
            else
                log_warning "Need both baseline and progress files for comparison"
                echo "Available files:"
                ls -la "$OUTPUT_DIR"/*.json 2>/dev/null || echo "No measurement files found"
            fi
            ;;
            
        *)
            echo -e "${RED}❌ Unknown mode: $MODE${NC}"
            echo ""
            echo "Usage: $0 [baseline|progress|compare]"
            echo ""
            echo "  baseline  - Create initial measurement"
            echo "  progress  - Measure current state and compare with baseline"
            echo "  compare   - Compare latest baseline and progress files"
            exit 1
            ;;
    esac
    
    # Cleanup temp files
    rm -f /tmp/code_metrics.json /tmp/api_routes.json /tmp/dependencies.json /tmp/performance.json /tmp/git_metrics.json
}

# Run main function
main "$@"
