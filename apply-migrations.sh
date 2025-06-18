#!/bin/bash
# Apply database migrations

DATABASE_URL="postgresql://seorylie_db_user:IFgPS0XSnJJql8P4LUOB92KqOVuhAKGK@dpg-d184im15pdvs73brlnv0-a.oregon-postgres.render.com/seorylie_db"

echo "🔄 Applying database migrations..."
echo ""

# Export for psql
export PGPASSWORD="IFgPS0XSnJJql8P4LUOB92KqOVuhAKGK"

# Apply each migration in order
for migration in migrations/002*.sql; do
  if [[ ! "$migration" == *"_rollback.sql" ]]; then
    echo "📄 Applying $(basename $migration)..."
    psql "postgresql://seorylie_db_user@dpg-d184im15pdvs73brlnv0-a.oregon-postgres.render.com/seorylie_db" \
      -h dpg-d184im15pdvs73brlnv0-a.oregon-postgres.render.com \
      -p 5432 \
      -f "$migration" \
      --single-transaction \
      2>&1
    
    if [ $? -eq 0 ]; then
      echo "✅ Successfully applied $(basename $migration)"
    else
      echo "❌ Failed to apply $(basename $migration)"
      exit 1
    fi
    echo ""
  fi
done

echo "✅ All migrations applied successfully!"