"""
Tests for the Vendor Relay Service main.py

This test suite verifies:
1. HMAC authentication
2. IP allowlist verification
3. All API endpoints
4. Data sanitization
5. Database logging
"""

import json
import time
import hmac
import hashlib
from datetime import datetime
from unittest.mock import patch, MagicMock, AsyncMock

import pytest
from fastapi.testclient import TestClient
from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.main import (
    app, 
    verify_hmac, 
    verify_ip_allowlist, 
    verify_internal_jwt, 
    sanitize_vendor_data,
    forward_to_vendor,
    log_communication,
    VendorCommunication,
)

# Test client
client = TestClient(app)

# Test constants
TEST_HMAC_SECRET = "test-hmac-secret"
TEST_JWT_SECRET = "test-jwt-secret"
TEST_VENDOR_API_KEY = "test-vendor-api-key"
TEST_VENDOR_API_URL = "https://test-api.customerscout.com/v1"
TEST_ALLOWED_IPS = ["127.0.0.1/32", "10.0.0.0/8"]

# Mock data
MOCK_SEO_TASK = {
    "request_id": "123e4567-e89b-12d3-a456-426614174000",
    "sandbox_id": "123e4567-e89b-12d3-a456-426614174001",
    "task_type": "page",
    "title": "New Service Page",
    "description": "Create a new service page for our dealership",
    "priority": "high",
    "deadline": "2025-06-15",
    "details": {
        "url": "/services/oil-change",
        "seoTitle": "Oil Change Service | Example Dealership",
        "metaDescription": "Professional oil change service at Example Dealership."
    }
}

MOCK_SEO_REPORT = {
    "request_id": "123e4567-e89b-12d3-a456-426614174000",
    "report_type": "page_completion",
    "title": "Service Page Completion Report",
    "summary": "Your service page has been completed and is now live.",
    "report_url": "https://example.com/reports/123.pdf",
    "metrics": {
        "wordCount": 850,
        "readabilityScore": 72
    },
    "details": {
        "url": "/services/oil-change",
        "completedDate": "2025-06-10T14:30:00Z",
        "customerscout_id": "cs-12345",  # This should be sanitized
        "vendor_name": "CustomerScout"   # This should be sanitized
    }
}

MOCK_PUBLISH_NOTIFICATION = {
    "request_id": "123e4567-e89b-12d3-a456-426614174000",
    "publish_type": "page",
    "title": "Oil Change Service Page",
    "description": "Your new service page is now live",
    "published_url": "https://example.com/services/oil-change",
    "publish_date": "2025-06-10T14:30:00Z",
    "details": {
        "wordCount": 850,
        "images": 3,
        "vendor_contact": "support@customerscout.com"  # This should be sanitized
    }
}

MOCK_JWT_PAYLOAD = {
    "sub": "123",
    "name": "Test User",
    "sandbox_id": "123e4567-e89b-12d3-a456-426614174001",
    "exp": int(time.time()) + 3600
}

# Helper functions for tests
def generate_hmac_headers(body_json, secret=TEST_HMAC_SECRET):
    """Generate HMAC headers for testing"""
    timestamp = str(int(time.time()))
    message = f"{timestamp}.{json.dumps(body_json)}"
    signature = hmac.new(
        secret.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()
    
    return {
        "X-Vendor-Signature": signature,
        "X-Vendor-Timestamp": timestamp
    }

def generate_jwt_token(payload=MOCK_JWT_PAYLOAD, secret=TEST_JWT_SECRET):
    """Generate JWT token for testing"""
    import jwt
    return jwt.encode(payload, secret, algorithm="HS256")

# Fixtures
@pytest.fixture
def mock_db_session():
    """Mock database session"""
    session = MagicMock(spec=Session)
    session.add = MagicMock()
    session.commit = MagicMock()
    session.query = MagicMock()
    return session

@pytest.fixture
def mock_request():
    """Mock FastAPI request"""
    request = MagicMock()
    request.client.host = "127.0.0.1"
    request.body = AsyncMock(return_value=b'{"test": "data"}')
    request.headers = {}
    return request

# Environment variable patches
@pytest.fixture(autouse=True)
def mock_env_vars(monkeypatch):
    """Mock environment variables"""
    monkeypatch.setenv("VENDOR_HMAC_SECRET", TEST_HMAC_SECRET)
    monkeypatch.setenv("JWT_SECRET", TEST_JWT_SECRET)
    monkeypatch.setenv("VENDOR_API_KEY", TEST_VENDOR_API_KEY)
    monkeypatch.setenv("VENDOR_API_URL", TEST_VENDOR_API_URL)
    monkeypatch.setenv("ALLOWED_IPS", ",".join(TEST_ALLOWED_IPS))

# -------------------- Unit Tests --------------------

class TestHMACAuthentication:
    """Tests for HMAC authentication"""
    
    @pytest.mark.asyncio
    async def test_valid_hmac(self, mock_request):
        """Test that valid HMAC signatures pass verification"""
        # Setup
        body = b'{"test": "data"}'
        timestamp = str(int(time.time()))
        message = f"{timestamp}.{body.decode('utf-8')}"
        signature = hmac.new(
            TEST_HMAC_SECRET.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        
        mock_request.body.return_value = body
        
        # Execute
        result = await verify_hmac(
            request=mock_request,
            x_vendor_signature=signature,
            x_vendor_timestamp=timestamp
        )
        
        # Assert
        assert result is True
    
    @pytest.mark.asyncio
    async def test_invalid_hmac(self, mock_request):
        """Test that invalid HMAC signatures fail verification"""
        # Setup
        body = b'{"test": "data"}'
        timestamp = str(int(time.time()))
        invalid_signature = "invalid-signature"
        
        mock_request.body.return_value = body
        
        # Execute & Assert
        with pytest.raises(HTTPException) as excinfo:
            await verify_hmac(
                request=mock_request,
                x_vendor_signature=invalid_signature,
                x_vendor_timestamp=timestamp
            )
        
        assert excinfo.value.status_code == 401
        assert "Invalid signature" in excinfo.value.detail
    
    @pytest.mark.asyncio
    async def test_expired_timestamp(self, mock_request):
        """Test that expired timestamps fail verification"""
        # Setup
        body = b'{"test": "data"}'
        expired_timestamp = str(int(time.time()) - 600)  # 10 minutes ago
        message = f"{expired_timestamp}.{body.decode('utf-8')}"
        signature = hmac.new(
            TEST_HMAC_SECRET.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        
        mock_request.body.return_value = body
        
        # Execute & Assert
        with pytest.raises(HTTPException) as excinfo:
            await verify_hmac(
                request=mock_request,
                x_vendor_signature=signature,
                x_vendor_timestamp=expired_timestamp
            )
        
        assert excinfo.value.status_code == 401
        assert "Expired timestamp" in excinfo.value.detail

class TestIPAllowlist:
    """Tests for IP allowlist verification"""
    
    @pytest.mark.asyncio
    async def test_allowed_ip(self, mock_request):
        """Test that allowed IPs pass verification"""
        # Setup - already set to 127.0.0.1 in fixture
        
        # Execute
        result = await verify_ip_allowlist(mock_request)
        
        # Assert
        assert result is True
    
    @pytest.mark.asyncio
    async def test_allowed_network_ip(self, mock_request):
        """Test that IPs in allowed networks pass verification"""
        # Setup
        mock_request.client.host = "10.0.0.5"
        
        # Execute
        result = await verify_ip_allowlist(mock_request)
        
        # Assert
        assert result is True
    
    @pytest.mark.asyncio
    async def test_disallowed_ip(self, mock_request):
        """Test that disallowed IPs fail verification"""
        # Setup
        mock_request.client.host = "192.168.1.1"
        
        # Execute & Assert
        with pytest.raises(HTTPException) as excinfo:
            await verify_ip_allowlist(mock_request)
        
        assert excinfo.value.status_code == 403
        assert "IP not in allowlist" in excinfo.value.detail

class TestJWTAuthentication:
    """Tests for JWT authentication"""
    
    @pytest.mark.asyncio
    async def test_valid_jwt(self):
        """Test that valid JWT tokens pass verification"""
        # Setup
        token = generate_jwt_token()
        
        # Execute
        result = await verify_internal_jwt(f"Bearer {token}")
        
        # Assert
        assert result["sandbox_id"] == MOCK_JWT_PAYLOAD["sandbox_id"]
    
    @pytest.mark.asyncio
    async def test_invalid_jwt(self):
        """Test that invalid JWT tokens fail verification"""
        # Setup
        invalid_token = "invalid-token"
        
        # Execute & Assert
        with pytest.raises(HTTPException) as excinfo:
            await verify_internal_jwt(f"Bearer {invalid_token}")
        
        assert excinfo.value.status_code == 401
        assert "Invalid token" in excinfo.value.detail
    
    @pytest.mark.asyncio
    async def test_missing_sandbox_id(self):
        """Test that JWT tokens without sandbox_id fail verification"""
        # Setup
        payload = MOCK_JWT_PAYLOAD.copy()
        del payload["sandbox_id"]
        token = generate_jwt_token(payload)
        
        # Execute & Assert
        with pytest.raises(HTTPException) as excinfo:
            await verify_internal_jwt(f"Bearer {token}")
        
        assert excinfo.value.status_code == 401
        assert "missing sandbox_id" in excinfo.value.detail

class TestDataSanitization:
    """Tests for data sanitization"""
    
    def test_sanitize_vendor_data(self):
        """Test that vendor-specific data is sanitized"""
        # Setup
        data = {
            "title": "Test Report",
            "vendor_id": "v-12345",
            "customerscout_id": "cs-12345",
            "vendor_name": "CustomerScout",
            "description": "This report was created by CustomerScout",
            "nested": {
                "vendor_contact": "support@customerscout.com",
                "cs_reference": "REF-12345"
            },
            "list_data": [
                {"vendor_item": "item1", "name": "CustomerScout Item"},
                {"vendor_item": "item2", "name": "Another CustomerScout Item"}
            ]
        }
        
        # Execute
        sanitized = sanitize_vendor_data(data)
        
        # Assert
        assert "vendor_id" not in sanitized
        assert "customerscout_id" not in sanitized
        assert "vendor_name" not in sanitized
        assert "CustomerScout" not in sanitized["description"]
        assert "Rylie SEO" in sanitized["description"]
        assert "vendor_contact" not in sanitized["nested"]
        assert "cs_reference" not in sanitized["nested"]
        assert "vendor_item" not in sanitized["list_data"][0]
        assert "CustomerScout" not in sanitized["list_data"][0]["name"]
        assert "Rylie SEO" in sanitized["list_data"][0]["name"]

class TestDatabaseLogging:
    """Tests for database logging"""
    
    @pytest.mark.asyncio
    async def test_log_communication(self, mock_db_session):
        """Test that communications are logged correctly"""
        # Setup
        direction = "inbound"
        message_type = "report"
        payload = {"test": "data"}
        request_id = "123e4567-e89b-12d3-a456-426614174000"
        hmac_signature = "test-signature"
        ip_address = "127.0.0.1"
        
        # Execute
        result = await log_communication(
            db=mock_db_session,
            direction=direction,
            message_type=message_type,
            payload=payload,
            request_id=request_id,
            hmac_signature=hmac_signature,
            ip_address=ip_address
        )
        
        # Assert
        mock_db_session.add.assert_called_once()
        mock_db_session.commit.assert_called_once()
        assert isinstance(result, VendorCommunication)
        assert result.direction == direction
        assert result.message_type == message_type
        assert result.payload == payload
        assert result.request_id == request_id
        assert result.hmac_signature == hmac_signature
        assert result.ip_address == ip_address
        assert result.processed is False

# -------------------- API Endpoint Tests --------------------

class TestRootEndpoint:
    """Tests for the root endpoint"""
    
    def test_root_endpoint(self):
        """Test that the root endpoint returns a health check response"""
        # Execute
        response = client.get("/")
        
        # Assert
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
        assert "Rylie SEO Vendor Relay" in response.json()["service"]

class TestTaskEndpoint:
    """Tests for the task submission endpoint"""
    
    @patch("src.main.forward_to_vendor")
    @patch("src.main.log_communication")
    def test_submit_seo_task(self, mock_log, mock_forward, mock_db_session):
        """Test that SEO tasks can be submitted"""
        # Setup
        mock_forward.return_value = {"status": "success"}
        mock_log.return_value = None
        
        headers = {
            "Authorization": f"Bearer {generate_jwt_token()}"
        }
        
        # Execute
        with patch("src.main.get_db", return_value=mock_db_session):
            response = client.post(
                "/vendor/seo/task",
                json=MOCK_SEO_TASK,
                headers=headers
            )
        
        # Assert
        assert response.status_code == 200
        assert response.json()["success"] is True
        assert response.json()["task_id"] == MOCK_SEO_TASK["request_id"]
        mock_log.assert_called_once()
        mock_forward.assert_called_once()
    
    def test_submit_seo_task_sandbox_mismatch(self):
        """Test that sandbox ID mismatch fails verification"""
        # Setup
        payload = MOCK_JWT_PAYLOAD.copy()
        payload["sandbox_id"] = "different-sandbox-id"
        token = generate_jwt_token(payload)
        
        headers = {
            "Authorization": f"Bearer {token}"
        }
        
        # Execute
        response = client.post(
            "/vendor/seo/task",
            json=MOCK_SEO_TASK,
            headers=headers
        )
        
        # Assert
        assert response.status_code == 403
        assert "Sandbox ID mismatch" in response.json()["error"]

class TestReportEndpoint:
    """Tests for the report receiving endpoint"""
    
    @patch("src.main.log_communication")
    def test_receive_seo_report(self, mock_log, mock_db_session, mock_request):
        """Test that SEO reports can be received"""
        # Setup
        mock_log.return_value = None
        
        headers = generate_hmac_headers(MOCK_SEO_REPORT)
        
        # Execute
        with patch("src.main.get_db", return_value=mock_db_session):
            with patch("src.main.verify_ip_allowlist", return_value=True):
                with patch("src.main.verify_hmac", return_value=True):
                    response = client.post(
                        "/vendor/seo/report",
                        json=MOCK_SEO_REPORT,
                        headers=headers
                    )
        
        # Assert
        assert response.status_code == 200
        assert response.json()["success"] is True
        mock_log.assert_called_once()

class TestPublishEndpoint:
    """Tests for the publish notification endpoint"""
    
    @patch("src.main.log_communication")
    def test_receive_publish_notification(self, mock_log, mock_db_session):
        """Test that publish notifications can be received"""
        # Setup
        mock_log.return_value = None
        
        headers = generate_hmac_headers(MOCK_PUBLISH_NOTIFICATION)
        
        # Execute
        with patch("src.main.get_db", return_value=mock_db_session):
            with patch("src.main.verify_ip_allowlist", return_value=True):
                with patch("src.main.verify_hmac", return_value=True):
                    response = client.post(
                        "/vendor/seo/publish",
                        json=MOCK_PUBLISH_NOTIFICATION,
                        headers=headers
                    )
        
        # Assert
        assert response.status_code == 200
        assert response.json()["success"] is True
        mock_log.assert_called_once()

class TestFileEndpoint:
    """Tests for the file receiving endpoint"""
    
    @patch("src.main.log_communication")
    def test_receive_vendor_file(self, mock_log, mock_db_session):
        """Test that files can be received"""
        # Setup
        mock_log.return_value = None
        
        # Create a test file
        test_file_content = b"Test file content"
        
        # Create form data
        form_data = {
            "file": ("test.pdf", test_file_content, "application/pdf"),
            "request_id": "123e4567-e89b-12d3-a456-426614174000",
            "file_type": "report"
        }
        
        # Generate HMAC for the form data (simplified for testing)
        timestamp = str(int(time.time()))
        message = f"{timestamp}.{json.dumps({'test': 'data'})}"
        signature = hmac.new(
            TEST_HMAC_SECRET.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        
        headers = {
            "X-Vendor-Signature": signature,
            "X-Vendor-Timestamp": timestamp
        }
        
        # Execute
        with patch("src.main.get_db", return_value=mock_db_session):
            with patch("src.main.verify_ip_allowlist", return_value=True):
                with patch("src.main.verify_hmac", return_value=True):
                    response = client.post(
                        "/vendor/seo/file",
                        files={"file": ("test.pdf", test_file_content, "application/pdf")},
                        data={"request_id": "123e4567-e89b-12d3-a456-426614174000", "file_type": "report"},
                        headers=headers
                    )
        
        # Assert
        assert response.status_code == 200
        assert response.json()["success"] is True
        mock_log.assert_called_once()

# -------------------- Integration Tests --------------------

@pytest.mark.integration
class TestEndToEndFlow:
    """End-to-end tests for the vendor relay service"""
    
    @patch("src.main.forward_to_vendor")
    @patch("src.main.log_communication")
    def test_full_workflow(self, mock_log, mock_forward, mock_db_session):
        """Test the full workflow from task submission to report and publish notification"""
        # Setup
        mock_forward.return_value = {"status": "success"}
        mock_log.return_value = None
        
        # Step 1: Submit task
        task_headers = {
            "Authorization": f"Bearer {generate_jwt_token()}"
        }
        
        # Step 2: Receive report
        report_headers = generate_hmac_headers(MOCK_SEO_REPORT)
        
        # Step 3: Receive publish notification
        publish_headers = generate_hmac_headers(MOCK_PUBLISH_NOTIFICATION)
        
        # Execute
        with patch("src.main.get_db", return_value=mock_db_session):
            with patch("src.main.verify_ip_allowlist", return_value=True):
                with patch("src.main.verify_hmac", return_value=True):
                    # Step 1: Submit task
                    task_response = client.post(
                        "/vendor/seo/task",
                        json=MOCK_SEO_TASK,
                        headers=task_headers
                    )
                    
                    # Step 2: Receive report
                    report_response = client.post(
                        "/vendor/seo/report",
                        json=MOCK_SEO_REPORT,
                        headers=report_headers
                    )
                    
                    # Step 3: Receive publish notification
                    publish_response = client.post(
                        "/vendor/seo/publish",
                        json=MOCK_PUBLISH_NOTIFICATION,
                        headers=publish_headers
                    )
        
        # Assert
        assert task_response.status_code == 200
        assert task_response.json()["success"] is True
        
        assert report_response.status_code == 200
        assert report_response.json()["success"] is True
        
        assert publish_response.status_code == 200
        assert publish_response.json()["success"] is True
        
        # Verify log_communication was called for each step
        assert mock_log.call_count == 3
        
        # Verify forward_to_vendor was called for task submission
        mock_forward.assert_called_once()
