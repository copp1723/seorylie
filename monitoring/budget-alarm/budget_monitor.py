#!/usr/bin/env python3
"""
Budget Monitor for AI Agent Platform

This script monitors sandbox costs using Prometheus metrics and sends Slack
alerts when sandboxes exceed configured thresholds. It's designed to run
as a continuous monitoring service with health check endpoints.

Features:
- Monitors sandbox costs using Prometheus metrics
- Sends Slack alerts when sandboxes exceed thresholds (default $5 in 24h)
- Configurable thresholds and time windows
- Detailed cost breakdowns in alerts
- Multiple alert levels (warning, critical)
- Retry logic and error handling
- Comprehensive logging
- Health check endpoint
- Environment variable configuration
"""

import os
import time
import json
import logging
import threading
import datetime
from typing import Dict, List, Any, Optional, Tuple
from urllib.parse import urljoin

import requests
from flask import Flask, jsonify
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.path.join(os.getenv('LOG_DIR', '/app/logs'), 'budget_monitor.log'))
    ]
)
logger = logging.getLogger('budget_monitor')

# Configuration from environment variables with defaults
PROMETHEUS_URL = os.getenv('PROMETHEUS_URL', 'http://prometheus:9090')
SLACK_WEBHOOK_URL = os.getenv('SLACK_WEBHOOK_URL', '')
SLACK_CHANNEL = os.getenv('SLACK_CHANNEL', '#alerts')
COST_THRESHOLD_USD = float(os.getenv('COST_THRESHOLD_USD', '5.0'))
WARNING_THRESHOLD_PERCENT = float(os.getenv('WARNING_THRESHOLD_PERCENT', '70.0'))
CHECK_INTERVAL_MINUTES = int(os.getenv('CHECK_INTERVAL_MINUTES', '15'))
TIME_WINDOW_HOURS = int(os.getenv('TIME_WINDOW_HOURS', '24'))
HEALTH_CHECK_PORT = int(os.getenv('HEALTH_CHECK_PORT', '8080'))
RETRY_MAX_ATTEMPTS = int(os.getenv('RETRY_MAX_ATTEMPTS', '3'))
RETRY_BACKOFF_FACTOR = float(os.getenv('RETRY_BACKOFF_FACTOR', '0.5'))

# Global state for health monitoring
last_check_time = None
last_check_status = "Not started"
monitor_thread = None
is_running = True

# Create Flask app for health check
app = Flask(__name__)

class PrometheusClient:
    """Client for querying Prometheus metrics"""
    
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session = self._create_session()
        logger.info(f"Initialized Prometheus client with base URL: {base_url}")
    
    def _create_session(self) -> requests.Session:
        """Create a requests session with retry logic"""
        session = requests.Session()
        retry_strategy = Retry(
            total=RETRY_MAX_ATTEMPTS,
            backoff_factor=RETRY_BACKOFF_FACTOR,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET"]
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        return session
    
    def query(self, query: str, time: Optional[str] = None) -> Dict[str, Any]:
        """Query Prometheus with the given PromQL query"""
        params = {'query': query}
        if time:
            params['time'] = time
            
        try:
            url = urljoin(self.base_url, '/api/v1/query')
            response = self.session.get(url, params=params, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Error querying Prometheus: {e}")
            return {"status": "error", "data": {"result": []}}
    
    def query_range(self, query: str, start: str, end: str, step: str) -> Dict[str, Any]:
        """Query Prometheus for a range of time with the given PromQL query"""
        params = {
            'query': query,
            'start': start,
            'end': end,
            'step': step
        }
        
        try:
            url = urljoin(self.base_url, '/api/v1/query_range')
            response = self.session.get(url, params=params, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Error querying Prometheus range: {e}")
            return {"status": "error", "data": {"result": []}}
    
    def get_sandbox_costs(self, hours: int = 24) -> List[Dict[str, Any]]:
        """Get the cost for each sandbox over the specified time window"""
        query = f'sum by(sandbox_id) (increase(openai_cost_usd_total[{hours}h]))'
        result = self.query(query)
        
        if result['status'] != 'success':
            logger.error(f"Failed to get sandbox costs: {result}")
            return []
        
        sandbox_costs = []
        for metric in result.get('data', {}).get('result', []):
            sandbox_id = metric['metric'].get('sandbox_id', 'unknown')
            cost = float(metric['value'][1]) if len(metric['value']) > 1 else 0.0
            sandbox_costs.append({
                'sandbox_id': sandbox_id,
                'cost': cost,
                'timestamp': datetime.datetime.now().isoformat()
            })
        
        return sandbox_costs
    
    def get_sandbox_cost_breakdown(self, sandbox_id: str, hours: int = 24) -> Dict[str, float]:
        """Get cost breakdown by operation type for a specific sandbox"""
        query = f'sum by(operation_type) (increase(openai_cost_usd_total{{sandbox_id="{sandbox_id}"}}[{hours}h]))'
        result = self.query(query)
        
        if result['status'] != 'success':
            logger.error(f"Failed to get cost breakdown for sandbox {sandbox_id}: {result}")
            return {}
        
        breakdown = {}
        for metric in result.get('data', {}).get('result', []):
            operation_type = metric['metric'].get('operation_type', 'unknown')
            cost = float(metric['value'][1]) if len(metric['value']) > 1 else 0.0
            breakdown[operation_type] = cost
        
        return breakdown
    
    def get_sandbox_token_usage(self, sandbox_id: str, hours: int = 24) -> int:
        """Get token usage for a specific sandbox"""
        query = f'sum(increase(token_usage_total{{sandbox_id="{sandbox_id}"}}[{hours}h]))'
        result = self.query(query)
        
        if result['status'] != 'success':
            logger.error(f"Failed to get token usage for sandbox {sandbox_id}: {result}")
            return 0
        
        metrics = result.get('data', {}).get('result', [])
        if not metrics:
            return 0
        
        return int(float(metrics[0]['value'][1])) if len(metrics[0]['value']) > 1 else 0


class SlackNotifier:
    """Sends notifications to Slack"""
    
    def __init__(self, webhook_url: str, channel: str):
        self.webhook_url = webhook_url
        self.channel = channel
        self.session = self._create_session()
        logger.info(f"Initialized Slack notifier for channel: {channel}")
    
    def _create_session(self) -> requests.Session:
        """Create a requests session with retry logic"""
        session = requests.Session()
        retry_strategy = Retry(
            total=RETRY_MAX_ATTEMPTS,
            backoff_factor=RETRY_BACKOFF_FACTOR,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["POST"]
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        return session
    
    def send_alert(self, sandbox_id: str, cost: float, threshold: float, 
                   breakdown: Dict[str, float], token_usage: int, 
                   level: str = "warning") -> bool:
        """Send a Slack alert for a sandbox exceeding cost threshold"""
        if not self.webhook_url:
            logger.warning("Slack webhook URL not configured, skipping notification")
            return False
        
        # Determine color based on alert level
        color = "#ff9800" if level == "warning" else "#ff0000"
        
        # Format the cost breakdown
        breakdown_text = "\n".join([f"• *{op_type}*: ${cost:.2f}" for op_type, cost in breakdown.items()])
        if not breakdown_text:
            breakdown_text = "• *No breakdown available*"
        
        # Calculate percentage of threshold
        percent_of_threshold = (cost / threshold) * 100
        
        # Create the message payload
        payload = {
            "channel": self.channel,
            "attachments": [
                {
                    "color": color,
                    "title": f"{'⚠️ WARNING' if level == 'warning' else '🚨 CRITICAL'}: Sandbox Cost Alert",
                    "text": (
                        f"Sandbox *{sandbox_id}* has spent *${cost:.2f}* in the last {TIME_WINDOW_HOURS} hours, "
                        f"which is *{percent_of_threshold:.1f}%* of the ${threshold:.2f} threshold."
                    ),
                    "fields": [
                        {
                            "title": "Sandbox ID",
                            "value": sandbox_id,
                            "short": True
                        },
                        {
                            "title": "Current Cost",
                            "value": f"${cost:.2f}",
                            "short": True
                        },
                        {
                            "title": "Threshold",
                            "value": f"${threshold:.2f}",
                            "short": True
                        },
                        {
                            "title": "Time Window",
                            "value": f"{TIME_WINDOW_HOURS} hours",
                            "short": True
                        },
                        {
                            "title": "Token Usage",
                            "value": f"{token_usage:,}",
                            "short": True
                        },
                        {
                            "title": "Alert Level",
                            "value": level.upper(),
                            "short": True
                        },
                        {
                            "title": "Cost Breakdown",
                            "value": breakdown_text,
                            "short": False
                        }
                    ],
                    "footer": "AI Platform Budget Monitor",
                    "ts": int(time.time())
                }
            ]
        }
        
        try:
            response = self.session.post(
                self.webhook_url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            response.raise_for_status()
            logger.info(f"Sent {level} alert for sandbox {sandbox_id} with cost ${cost:.2f}")
            return True
        except requests.exceptions.RequestException as e:
            logger.error(f"Error sending Slack alert: {e}")
            return False


class BudgetMonitor:
    """Monitors sandbox costs and sends alerts when thresholds are exceeded"""
    
    def __init__(self, prometheus_url: str, slack_webhook_url: str, slack_channel: str,
                 cost_threshold: float, warning_threshold_percent: float,
                 check_interval_minutes: int, time_window_hours: int):
        self.prometheus = PrometheusClient(prometheus_url)
        self.slack = SlackNotifier(slack_webhook_url, slack_channel)
        self.cost_threshold = cost_threshold
        self.warning_threshold = cost_threshold * (warning_threshold_percent / 100)
        self.check_interval_seconds = check_interval_minutes * 60
        self.time_window_hours = time_window_hours
        self.alerted_sandboxes = {}  # Track which sandboxes we've already alerted about
        
        logger.info(f"Initialized Budget Monitor with cost threshold: ${cost_threshold:.2f}, "
                   f"warning threshold: ${self.warning_threshold:.2f}, "
                   f"check interval: {check_interval_minutes} minutes, "
                   f"time window: {time_window_hours} hours")
    
    def check_costs(self) -> List[Dict[str, Any]]:
        """Check costs for all sandboxes and return those exceeding thresholds"""
        global last_check_time, last_check_status
        
        try:
            logger.info(f"Checking sandbox costs for the last {self.time_window_hours} hours")
            last_check_time = datetime.datetime.now()
            
            # Get costs for all sandboxes
            sandbox_costs = self.prometheus.get_sandbox_costs(self.time_window_hours)
            logger.info(f"Found {len(sandbox_costs)} sandboxes with cost data")
            
            # Filter for sandboxes exceeding thresholds
            exceeding_sandboxes = []
            for sandbox in sandbox_costs:
                sandbox_id = sandbox['sandbox_id']
                cost = sandbox['cost']
                
                # Determine alert level
                if cost >= self.cost_threshold:
                    level = "critical"
                elif cost >= self.warning_threshold:
                    level = "warning"
                else:
                    continue
                
                # Get additional data for the alert
                breakdown = self.prometheus.get_sandbox_cost_breakdown(sandbox_id, self.time_window_hours)
                token_usage = self.prometheus.get_sandbox_token_usage(sandbox_id, self.time_window_hours)
                
                # Add to the list of sandboxes exceeding thresholds
                exceeding_sandboxes.append({
                    'sandbox_id': sandbox_id,
                    'cost': cost,
                    'level': level,
                    'breakdown': breakdown,
                    'token_usage': token_usage
                })
            
            last_check_status = "Success"
            return exceeding_sandboxes
        
        except Exception as e:
            last_check_status = f"Error: {str(e)}"
            logger.error(f"Error checking sandbox costs: {e}", exc_info=True)
            return []
    
    def send_alerts(self, exceeding_sandboxes: List[Dict[str, Any]]) -> None:
        """Send alerts for sandboxes exceeding thresholds"""
        now = time.time()
        
        for sandbox in exceeding_sandboxes:
            sandbox_id = sandbox['sandbox_id']
            cost = sandbox['cost']
            level = sandbox['level']
            breakdown = sandbox['breakdown']
            token_usage = sandbox['token_usage']
            
            # Check if we've already alerted about this sandbox recently
            # Only alert again if it's been more than 6 hours or the level changed
            last_alert = self.alerted_sandboxes.get(sandbox_id, {})
            last_time = last_alert.get('time', 0)
            last_level = last_alert.get('level', '')
            
            if (now - last_time < 6 * 3600) and (level == last_level):
                logger.info(f"Skipping alert for sandbox {sandbox_id} (already alerted recently)")
                continue
            
            # Send the alert
            success = self.slack.send_alert(
                sandbox_id, cost, self.cost_threshold, breakdown, token_usage, level
            )
            
            if success:
                # Update the alerted sandboxes tracker
                self.alerted_sandboxes[sandbox_id] = {
                    'time': now,
                    'level': level,
                    'cost': cost
                }
    
    def run_once(self) -> None:
        """Run a single check and alert cycle"""
        try:
            exceeding_sandboxes = self.check_costs()
            if exceeding_sandboxes:
                logger.info(f"Found {len(exceeding_sandboxes)} sandboxes exceeding thresholds")
                self.send_alerts(exceeding_sandboxes)
            else:
                logger.info("No sandboxes exceeding thresholds")
        except Exception as e:
            logger.error(f"Error in monitoring cycle: {e}", exc_info=True)
    
    def run(self) -> None:
        """Run the monitoring loop"""
        logger.info("Starting budget monitoring loop")
        
        while is_running:
            try:
                self.run_once()
            except Exception as e:
                logger.error(f"Unexpected error in monitoring loop: {e}", exc_info=True)
            
            # Sleep until the next check
            logger.info(f"Sleeping for {self.check_interval_seconds} seconds until next check")
            time.sleep(self.check_interval_seconds)


# Flask routes for health check
@app.route('/health')
def health_check():
    """Health check endpoint"""
    global last_check_time, last_check_status, monitor_thread
    
    # Check if the monitoring thread is alive
    thread_status = "Running" if monitor_thread and monitor_thread.is_alive() else "Not running"
    
    # Calculate time since last check
    time_since_check = None
    if last_check_time:
        time_since_check = (datetime.datetime.now() - last_check_time).total_seconds()
    
    # Determine overall health
    is_healthy = (
        thread_status == "Running" and
        (time_since_check is None or time_since_check < CHECK_INTERVAL_MINUTES * 60 * 2)
    )
    
    return jsonify({
        'status': 'healthy' if is_healthy else 'unhealthy',
        'monitor_thread': thread_status,
        'last_check_time': last_check_time.isoformat() if last_check_time else None,
        'last_check_status': last_check_status,
        'time_since_check_seconds': time_since_check,
        'config': {
            'prometheus_url': PROMETHEUS_URL,
            'cost_threshold': COST_THRESHOLD_USD,
            'warning_threshold_percent': WARNING_THRESHOLD_PERCENT,
            'check_interval_minutes': CHECK_INTERVAL_MINUTES,
            'time_window_hours': TIME_WINDOW_HOURS,
        }
    }), 200 if is_healthy else 500


@app.route('/metrics')
def metrics():
    """Prometheus metrics endpoint"""
    global last_check_time, last_check_status
    
    # Simple metrics for Prometheus to scrape
    metrics_text = []
    
    # Add health metrics
    thread_alive = 1 if (monitor_thread and monitor_thread.is_alive()) else 0
    metrics_text.append(f'budget_monitor_thread_alive {thread_alive}')
    
    # Add last check time
    if last_check_time:
        check_time_seconds = int(last_check_time.timestamp())
        metrics_text.append(f'budget_monitor_last_check_timestamp_seconds {check_time_seconds}')
    
    # Add check status
    check_success = 1 if last_check_status == "Success" else 0
    metrics_text.append(f'budget_monitor_last_check_success {check_success}')
    
    # Add configuration metrics
    metrics_text.append(f'budget_monitor_cost_threshold_usd {COST_THRESHOLD_USD}')
    metrics_text.append(f'budget_monitor_warning_threshold_percent {WARNING_THRESHOLD_PERCENT}')
    metrics_text.append(f'budget_monitor_check_interval_minutes {CHECK_INTERVAL_MINUTES}')
    metrics_text.append(f'budget_monitor_time_window_hours {TIME_WINDOW_HOURS}')
    
    return "\n".join(metrics_text), 200, {'Content-Type': 'text/plain'}


def start_monitoring():
    """Start the monitoring thread"""
    global monitor_thread, is_running
    
    # Create and start the monitor
    monitor = BudgetMonitor(
        prometheus_url=PROMETHEUS_URL,
        slack_webhook_url=SLACK_WEBHOOK_URL,
        slack_channel=SLACK_CHANNEL,
        cost_threshold=COST_THRESHOLD_USD,
        warning_threshold_percent=WARNING_THRESHOLD_PERCENT,
        check_interval_minutes=CHECK_INTERVAL_MINUTES,
        time_window_hours=TIME_WINDOW_HOURS
    )
    
    is_running = True
    monitor_thread = threading.Thread(target=monitor.run, daemon=True)
    monitor_thread.start()
    logger.info("Started monitoring thread")


def stop_monitoring():
    """Stop the monitoring thread"""
    global is_running
    is_running = False
    logger.info("Stopping monitoring thread")


def main():
    """Main entry point"""
    try:
        # Log startup information
        logger.info("Starting Budget Monitor")
        logger.info(f"Prometheus URL: {PROMETHEUS_URL}")
        logger.info(f"Slack Channel: {SLACK_CHANNEL}")
        logger.info(f"Cost Threshold: ${COST_THRESHOLD_USD:.2f}")
        logger.info(f"Warning Threshold: {WARNING_THRESHOLD_PERCENT}%")
        logger.info(f"Check Interval: {CHECK_INTERVAL_MINUTES} minutes")
        logger.info(f"Time Window: {TIME_WINDOW_HOURS} hours")
        
        # Create logs directory if it doesn't exist
        log_dir = os.getenv('LOG_DIR', '/app/logs')
        os.makedirs(log_dir, exist_ok=True)
        
        # Start the monitoring thread
        start_monitoring()
        
        # Start the Flask app for health checks
        logger.info(f"Starting health check server on port {HEALTH_CHECK_PORT}")
        app.run(host='0.0.0.0', port=HEALTH_CHECK_PORT)
    
    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt, shutting down")
        stop_monitoring()
    
    except Exception as e:
        logger.critical(f"Fatal error: {e}", exc_info=True)
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())
