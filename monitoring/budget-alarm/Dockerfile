# Budget Alarm Service Dockerfile
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    LOG_DIR=/app/logs \
    CONFIG_DIR=/app/config \
    HEALTH_CHECK_PORT=8080

# Create app directories
WORKDIR /app
RUN mkdir -p /app/logs /app/config

# Install dependencies
RUN pip install --no-cache-dir requests flask urllib3

# Create a non-root user
RUN groupadd -r budgetmon && \
    useradd -r -g budgetmon -s /bin/false budgetmon && \
    chown -R budgetmon:budgetmon /app

# Copy the budget monitor script
COPY budget_monitor.py /app/
RUN chmod +x /app/budget_monitor.py

# Set permissions
RUN chown -R budgetmon:budgetmon /app

# Switch to non-root user
USER budgetmon

# Expose health check port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Set entrypoint
ENTRYPOINT ["python", "/app/budget_monitor.py"]
