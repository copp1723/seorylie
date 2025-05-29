#!/bin/bash
#
# Health Check Script for AI Platform Services
# 
# This script polls health endpoints for all services defined in docker-compose.platform.yml
# and waits for them to become healthy or times out.
#
# Usage: ./wait-for-health.sh [TIMEOUT_SECONDS]
#   TIMEOUT_SECONDS: Maximum time to wait for all services (default: 90)

# Default configuration
TIMEOUT=${1:-90}
CHECK_INTERVAL=3
VERBOSE=true

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Service endpoints
POSTGRES_HOST="localhost"
POSTGRES_PORT="5432"
POSTGRES_USER="postgres"
REDIS_HOST="localhost"
REDIS_PORT="6379"
CLEANRYLIE_API="http://localhost:3000/api/metrics/health"
CLEANRYLIE_FRONTEND="http://localhost:5173"
WATCHDOG_API="http://localhost:8000/api/health"
MINDSDB_API="http://localhost:47334/api/health"
VIN_AGENT_API="http://localhost:5000/health"

# Initialize service status
declare -A SERVICE_STATUS
SERVICE_STATUS["postgres"]="pending"
SERVICE_STATUS["redis"]="pending"
SERVICE_STATUS["cleanrylie-api"]="pending"
SERVICE_STATUS["cleanrylie-frontend"]="pending"
SERVICE_STATUS["watchdog-api"]="pending"
SERVICE_STATUS["mindsdb"]="pending"
SERVICE_STATUS["vin-agent"]="pending"

# Function to check PostgreSQL
check_postgres() {
  if pg_isready -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER > /dev/null 2>&1; then
    return 0
  else
    return 1
  fi
}

# Function to check Redis
check_redis() {
  if redis-cli -h $REDIS_HOST -p $REDIS_PORT ping | grep -q "PONG"; then
    return 0
  else
    return 1
  fi
}

# Function to check HTTP endpoint
check_http() {
  local url=$1
  local status_code=$(curl -s -o /dev/null -w "%{http_code}" $url)
  if [ "$status_code" -eq 200 ]; then
    return 0
  else
    return 1
  fi
}

# Function to print status
print_status() {
  local all_healthy=true
  local pending_count=0
  
  echo -e "\n${BLUE}=== AI Platform Health Status (${SECONDS}s elapsed) ===${NC}"
  
  for service in "${!SERVICE_STATUS[@]}"; do
    status=${SERVICE_STATUS[$service]}
    if [ "$status" == "healthy" ]; then
      echo -e "${GREEN}✓ $service${NC}"
    elif [ "$status" == "pending" ]; then
      echo -e "${YELLOW}⋯ $service${NC}"
      all_healthy=false
      pending_count=$((pending_count + 1))
    else
      echo -e "${RED}✗ $service${NC}"
      all_healthy=false
    fi
  done
  
  if [ "$all_healthy" = true ]; then
    return 0
  else
    if [ $pending_count -eq 0 ]; then
      return 2  # All services checked but some failed
    fi
    return 1  # Still waiting for some services
  fi
}

# Main function
main() {
  echo "Starting health checks for AI Platform services..."
  echo "Timeout set to ${TIMEOUT} seconds"
  
  SECONDS=0
  
  while [ $SECONDS -lt $TIMEOUT ]; do
    # Check PostgreSQL
    if [ "${SERVICE_STATUS[postgres]}" == "pending" ]; then
      if check_postgres; then
        SERVICE_STATUS["postgres"]="healthy"
        echo -e "${GREEN}✓ PostgreSQL is healthy (${SECONDS}s)${NC}"
      fi
    fi
    
    # Check Redis
    if [ "${SERVICE_STATUS[redis]}" == "pending" ]; then
      if check_redis; then
        SERVICE_STATUS["redis"]="healthy"
        echo -e "${GREEN}✓ Redis is healthy (${SECONDS}s)${NC}"
      fi
    fi
    
    # Check cleanrylie-api
    if [ "${SERVICE_STATUS[cleanrylie-api]}" == "pending" ]; then
      if check_http $CLEANRYLIE_API; then
        SERVICE_STATUS["cleanrylie-api"]="healthy"
        echo -e "${GREEN}✓ Cleanrylie API is healthy (${SECONDS}s)${NC}"
      fi
    fi
    
    # Check cleanrylie-frontend
    if [ "${SERVICE_STATUS[cleanrylie-frontend]}" == "pending" ]; then
      if check_http $CLEANRYLIE_FRONTEND; then
        SERVICE_STATUS["cleanrylie-frontend"]="healthy"
        echo -e "${GREEN}✓ Cleanrylie Frontend is healthy (${SECONDS}s)${NC}"
      fi
    fi
    
    # Check watchdog-api
    if [ "${SERVICE_STATUS[watchdog-api]}" == "pending" ]; then
      if check_http $WATCHDOG_API; then
        SERVICE_STATUS["watchdog-api"]="healthy"
        echo -e "${GREEN}✓ Watchdog API is healthy (${SECONDS}s)${NC}"
      fi
    fi
    
    # Check mindsdb
    if [ "${SERVICE_STATUS[mindsdb]}" == "pending" ]; then
      if check_http $MINDSDB_API; then
        SERVICE_STATUS["mindsdb"]="healthy"
        echo -e "${GREEN}✓ MindsDB is healthy (${SECONDS}s)${NC}"
      fi
    fi
    
    # Check vin-agent
    if [ "${SERVICE_STATUS[vin-agent]}" == "pending" ]; then
      if check_http $VIN_AGENT_API; then
        SERVICE_STATUS["vin-agent"]="healthy"
        echo -e "${GREEN}✓ VIN Agent is healthy (${SECONDS}s)${NC}"
      fi
    fi
    
    # Print current status
    print_status
    status=$?
    
    # If all services are healthy, exit with success
    if [ $status -eq 0 ]; then
      echo -e "\n${GREEN}All services are healthy!${NC}"
      echo "Total time: ${SECONDS} seconds"
      return 0
    fi
    
    # If all services have been checked but some failed, exit with error
    if [ $status -eq 2 ]; then
      echo -e "\n${RED}Some services failed health checks!${NC}"
      echo "Total time: ${SECONDS} seconds"
      return 1
    fi
    
    # Wait before next check
    sleep $CHECK_INTERVAL
  done
  
  # If we reach here, timeout occurred
  echo -e "\n${RED}Timeout after ${TIMEOUT} seconds!${NC}"
  print_status
  
  # Mark pending services as failed
  for service in "${!SERVICE_STATUS[@]}"; do
    if [ "${SERVICE_STATUS[$service]}" == "pending" ]; then
      SERVICE_STATUS[$service]="failed"
      echo -e "${RED}✗ $service timed out${NC}"
    fi
  done
  
  return 1
}

# Run main function
main
exit $?
