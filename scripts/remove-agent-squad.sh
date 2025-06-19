#!/bin/bash

# Remove AgentSquad and other non-SEO services
echo "🗑️  Removing AgentSquad and Non-SEO Services"
echo "==========================================="

# Create backup
BACKUP_DIR=".backup/remove-agents-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📦 Creating backup..."

# Function to safely remove with backup
safe_remove() {
  if [ -e "$1" ]; then
    echo "  - Removing: $1"
    mv "$1" "$BACKUP_DIR/" 2>/dev/null || true
  fi
}

echo ""
echo "🤖 Removing multi-agent conversation system..."

# Remove entire agentSquad directory
safe_remove "server/services/agentSquad"

# Remove other non-SEO services
echo ""
echo "🧹 Removing other non-SEO services..."
safe_remove "server/services/websocket-service.ts"  # 1858 lines - for real-time agent chat
safe_remove "server/services/tool-registry.ts"      # 1054 lines - agent tools
safe_remove "server/routes/sandbox-routes.ts"       # 1157 lines - agent testing

# Remove orchestrator if it's the conversation one (not task orchestrator)
if grep -q "conversation" server/services/orchestrator.ts 2>/dev/null; then
  safe_remove "server/services/orchestrator.ts"    # 2433 lines - conversation orchestrator
fi

echo ""
echo "📊 Space saved calculation..."
REMOVED_LINES=$(find "$BACKUP_DIR" -name "*.ts" -o -name "*.tsx" 2>/dev/null | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
echo "  - Lines of code removed: ${REMOVED_LINES:-0}"

echo ""
echo "✅ Cleanup Complete!"
echo "==================="
echo "- Removed multi-agent conversation system"
echo "- Removed WebSocket service for agents"
echo "- Removed agent tool registry"
echo "- Removed sandbox routes"
echo ""
echo "📁 Backups saved to: $BACKUP_DIR/"
echo ""
echo "🎯 This is now a pure SEO platform without:"
echo "  ❌ Multi-agent orchestration"
echo "  ❌ Conversational agents"
echo "  ❌ Real-time agent chat"
echo ""
echo "✅ Keeping only SEO-focused features:"
echo "  ✅ Task management"
echo "  ✅ SEOWerks integration"
echo "  ✅ Deliverable processing"
echo "  ✅ Analytics"