"""
Vendor Relay Service - FastAPI Application

This service acts as a secure communication layer between Rylie SEO and the SEO vendor (CustomerScout).
It handles:
1. Receiving SEO task requests from Rylie SEO and forwarding them to CustomerScout
2. Receiving SEO reports from CustomerScout and transforming them for white-label delivery
3. Receiving publish notifications when content goes live

Security features:
- HMAC authentication for all vendor communications
- IP allowlist for additional security
- No direct exposure of vendor identity to clients
"""

import os
import hmac
import hashlib
import json
import logging
import time
from datetime import datetime
from typing import Dict, List, Optional, Union, Any
from ipaddress import IPv4Address, IPv4Network

import httpx
from fastapi import FastAPI, Depends, HTTPException, Header, Request, UploadFile, File, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator
from sqlalchemy import create_engine, Column, String, Boolean, DateTime, Text, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from starlette.status import HTTP_401_UNAUTHORIZED, HTTP_403_FORBIDDEN
import jwt
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("vendor-relay")

# App configuration
app = FastAPI(
    title="Rylie SEO Vendor Relay",
    description="Secure white-label communication layer for SEO services",
    version="1.0.0",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security configuration
VENDOR_HMAC_SECRET = os.getenv("VENDOR_HMAC_SECRET", "dev-secret-change-in-production")
VENDOR_API_KEY = os.getenv("VENDOR_API_KEY", "dev-api-key-change-in-production")
VENDOR_API_URL = os.getenv("VENDOR_API_URL", "https://api.customerscout.com/v1")
ALLOWED_IPS = [
    ip.strip() for ip in 
    os.getenv("ALLOWED_IPS", "127.0.0.1/32,10.0.0.0/8").split(",")
]
ALLOWED_IP_NETWORKS = [IPv4Network(ip) for ip in ALLOWED_IPS]

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/rylie_seo")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# JWT configuration for internal authentication
JWT_SECRET = os.getenv("JWT_SECRET", "dev-jwt-secret-change-in-production")
JWT_ALGORITHM = "HS256"

# -------------------- Database Models --------------------

class VendorCommunication(Base):
    """Model for tracking all vendor communications"""
    __tablename__ = "vendor_communications"
    
    id = Column(String, primary_key=True)
    request_id = Column(String, nullable=True)
    direction = Column(String, nullable=False)  # inbound or outbound
    message_type = Column(String, nullable=False)
    payload = Column(JSON, nullable=False)
    hmac_signature = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    processed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

# -------------------- Pydantic Models --------------------

class SeoTask(BaseModel):
    """Model for SEO task requests"""
    request_id: str
    sandbox_id: str
    task_type: str
    title: str
    description: str
    priority: str = "medium"
    deadline: Optional[str] = None
    details: Dict[str, Any]
    
    class Config:
        schema_extra = {
            "example": {
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
                    "metaDescription": "Professional oil change service at Example Dealership. Quick service, quality oil, competitive prices."
                }
            }
        }

class SeoReport(BaseModel):
    """Model for SEO reports from vendor"""
    request_id: str
    report_type: str
    title: str
    summary: str
    report_url: Optional[str] = None
    metrics: Optional[Dict[str, Any]] = None
    details: Dict[str, Any]
    
    class Config:
        schema_extra = {
            "example": {
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
                    "completedDate": "2025-06-10T14:30:00Z"
                }
            }
        }

class PublishNotification(BaseModel):
    """Model for publish notifications"""
    request_id: str
    publish_type: str
    title: str
    description: str
    published_url: str
    publish_date: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    details: Optional[Dict[str, Any]] = None
    
    class Config:
        schema_extra = {
            "example": {
                "request_id": "123e4567-e89b-12d3-a456-426614174000",
                "publish_type": "page",
                "title": "Oil Change Service Page",
                "description": "Your new service page is now live",
                "published_url": "https://example.com/services/oil-change",
                "publish_date": "2025-06-10T14:30:00Z",
                "details": {
                    "wordCount": 850,
                    "images": 3
                }
            }
        }

class ErrorResponse(BaseModel):
    """Model for error responses"""
    error: str
    detail: Optional[str] = None
    status_code: int

# -------------------- Dependencies --------------------

def get_db():
    """Database session dependency"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def verify_hmac(
    request: Request,
    x_vendor_signature: str = Header(...),
    x_vendor_timestamp: str = Header(...),
):
    """Verify HMAC signature from vendor"""
    # Get request body
    body = await request.body()
    
    # Reconstruct the message that was signed
    message = f"{x_vendor_timestamp}.{body.decode('utf-8')}"
    
    # Verify the signature
    computed_signature = hmac.new(
        VENDOR_HMAC_SECRET.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()
    
    # Check if signatures match
    if not hmac.compare_digest(computed_signature, x_vendor_signature):
        logger.warning(f"Invalid HMAC signature from {request.client.host}")
        raise HTTPException(
            status_code=HTTP_401_UNAUTHORIZED,
            detail="Invalid signature"
        )
    
    # Check timestamp to prevent replay attacks (5 minute window)
    try:
        timestamp = int(x_vendor_timestamp)
        current_time = int(time.time())
        if abs(current_time - timestamp) > 300:
            logger.warning(f"Expired timestamp from {request.client.host}")
            raise HTTPException(
                status_code=HTTP_401_UNAUTHORIZED,
                detail="Expired timestamp"
            )
    except ValueError:
        raise HTTPException(
            status_code=HTTP_401_UNAUTHORIZED,
            detail="Invalid timestamp format"
        )
    
    return True

async def verify_ip_allowlist(request: Request):
    """Verify that the request IP is in the allowlist"""
    client_ip = request.client.host
    
    # Always allow localhost for development
    if client_ip == "127.0.0.1" or client_ip == "::1":
        return True
    
    # Check if IP is in allowed networks
    try:
        client_ip_obj = IPv4Address(client_ip)
        for network in ALLOWED_IP_NETWORKS:
            if client_ip_obj in network:
                return True
        
        logger.warning(f"IP not in allowlist: {client_ip}")
        raise HTTPException(
            status_code=HTTP_403_FORBIDDEN,
            detail="IP not in allowlist"
        )
    except ValueError:
        logger.warning(f"Invalid IP format: {client_ip}")
        raise HTTPException(
            status_code=HTTP_403_FORBIDDEN,
            detail="Invalid IP format"
        )

async def verify_internal_jwt(
    authorization: str = Header(...),
):
    """Verify JWT token for internal requests"""
    try:
        # Remove 'Bearer ' prefix
        if authorization.startswith("Bearer "):
            token = authorization[7:]
        else:
            token = authorization
        
        # Decode and verify the token
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        
        # Check if sandbox_id is in the payload
        if "sandbox_id" not in payload:
            raise HTTPException(
                status_code=HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing sandbox_id"
            )
        
        return payload
    except jwt.PyJWTError as e:
        logger.warning(f"JWT validation error: {str(e)}")
        raise HTTPException(
            status_code=HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}"
        )

# -------------------- Helper Functions --------------------

def sanitize_vendor_data(data: Dict) -> Dict:
    """Remove vendor-specific information from data"""
    # Create a copy to avoid modifying the original
    sanitized = data.copy()
    
    # Remove or replace vendor-specific fields
    vendor_fields = [
        "vendor_id", "customerscout_id", "cs_id", "vendor_name", 
        "vendor_email", "vendor_phone", "vendor_contact", "cs_"
    ]
    
    # Recursively sanitize nested dictionaries
    for key, value in list(sanitized.items()):
        # Check if key contains vendor-specific terms
        if any(field in key.lower() for field in vendor_fields):
            del sanitized[key]
        # Replace vendor name in string values
        elif isinstance(value, str):
            sanitized[key] = value.replace("CustomerScout", "Rylie SEO")
        # Recursively sanitize nested dictionaries
        elif isinstance(value, dict):
            sanitized[key] = sanitize_vendor_data(value)
        # Recursively sanitize lists of dictionaries
        elif isinstance(value, list) and all(isinstance(item, dict) for item in value):
            sanitized[key] = [sanitize_vendor_data(item) for item in value]
    
    return sanitized

async def forward_to_vendor(endpoint: str, data: Dict) -> Dict:
    """Forward request to vendor API"""
    async with httpx.AsyncClient() as client:
        # Prepare the request
        url = f"{VENDOR_API_URL}/{endpoint}"
        headers = {
            "X-API-Key": VENDOR_API_KEY,
            "Content-Type": "application/json",
        }
        
        # Add timestamp and calculate HMAC
        timestamp = str(int(time.time()))
        message = f"{timestamp}.{json.dumps(data)}"
        signature = hmac.new(
            VENDOR_HMAC_SECRET.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        
        headers["X-Timestamp"] = timestamp
        headers["X-Signature"] = signature
        
        # Send request to vendor
        try:
            response = await client.post(url, json=data, headers=headers)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Vendor API error: {str(e)}")
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"Vendor API error: {e.response.text}"
            )
        except httpx.RequestError as e:
            logger.error(f"Vendor API request failed: {str(e)}")
            raise HTTPException(
                status_code=503,
                detail="Vendor API unavailable"
            )

async def log_communication(
    db: Session,
    direction: str,
    message_type: str,
    payload: Dict,
    request_id: Optional[str] = None,
    hmac_signature: Optional[str] = None,
    ip_address: Optional[str] = None,
):
    """Log vendor communication to database"""
    from uuid import uuid4
    
    comm = VendorCommunication(
        id=str(uuid4()),
        request_id=request_id,
        direction=direction,
        message_type=message_type,
        payload=payload,
        hmac_signature=hmac_signature,
        ip_address=ip_address,
        processed=False,
    )
    
    db.add(comm)
    db.commit()
    return comm

# -------------------- API Endpoints --------------------

@app.get("/")
async def root():
    """Root endpoint for health check"""
    return {"status": "ok", "service": "Rylie SEO Vendor Relay", "version": "1.0.0"}

@app.post("/vendor/seo/task", response_model=Dict)
async def submit_seo_task(
    task: SeoTask,
    db: Session = Depends(get_db),
    jwt_payload: Dict = Depends(verify_internal_jwt),
):
    """Submit SEO task to vendor"""
    # Verify sandbox_id in JWT matches the one in the request
    if jwt_payload["sandbox_id"] != task.sandbox_id:
        raise HTTPException(
            status_code=HTTP_403_FORBIDDEN,
            detail="Sandbox ID mismatch"
        )
    
    # Log outbound communication
    await log_communication(
        db=db,
        direction="outbound",
        message_type="task",
        payload=task.dict(),
        request_id=task.request_id,
        ip_address=None,
    )
    
    # Forward to vendor
    vendor_response = await forward_to_vendor("tasks", task.dict())
    
    # Return sanitized response
    return {
        "success": True,
        "message": "Task submitted successfully",
        "task_id": task.request_id,
        "status": "pending"
    }

@app.post("/vendor/seo/report")
async def receive_seo_report(
    request: Request,
    report: SeoReport = Body(...),
    db: Session = Depends(get_db),
    _: bool = Depends(verify_hmac),
    __: bool = Depends(verify_ip_allowlist),
):
    """Receive SEO report from vendor"""
    # Log inbound communication
    await log_communication(
        db=db,
        direction="inbound",
        message_type="report",
        payload=report.dict(),
        request_id=report.request_id,
        hmac_signature=request.headers.get("x-vendor-signature"),
        ip_address=request.client.host,
    )
    
    # Sanitize vendor data
    sanitized_report = sanitize_vendor_data(report.dict())
    
    # TODO: Store report in database and trigger notification
    # This would be implemented in G3: White-Label Reporting Pipeline
    
    return {"success": True, "message": "Report received successfully"}

@app.post("/vendor/seo/publish")
async def receive_publish_notification(
    request: Request,
    notification: PublishNotification = Body(...),
    db: Session = Depends(get_db),
    _: bool = Depends(verify_hmac),
    __: bool = Depends(verify_ip_allowlist),
):
    """Receive publish notification from vendor"""
    # Log inbound communication
    await log_communication(
        db=db,
        direction="inbound",
        message_type="publish",
        payload=notification.dict(),
        request_id=notification.request_id,
        hmac_signature=request.headers.get("x-vendor-signature"),
        ip_address=request.client.host,
    )
    
    # Sanitize vendor data
    sanitized_notification = sanitize_vendor_data(notification.dict())
    
    # TODO: Store notification in database and trigger WebSocket event
    # This would be implemented in G6: Real-Time Publish Notifier
    
    return {"success": True, "message": "Publish notification received successfully"}

@app.post("/vendor/seo/file")
async def receive_vendor_file(
    request: Request,
    file: UploadFile = File(...),
    request_id: str = Body(...),
    file_type: str = Body(...),
    db: Session = Depends(get_db),
    _: bool = Depends(verify_hmac),
    __: bool = Depends(verify_ip_allowlist),
):
    """Receive file from vendor (PDF report, image, etc.)"""
    # Read file content
    content = await file.read()
    
    # Log inbound communication (without file content)
    await log_communication(
        db=db,
        direction="inbound",
        message_type="file",
        payload={
            "request_id": request_id,
            "file_type": file_type,
            "filename": file.filename,
            "content_type": file.content_type,
            "size": len(content)
        },
        request_id=request_id,
        hmac_signature=request.headers.get("x-vendor-signature"),
        ip_address=request.client.host,
    )
    
    # TODO: Process file (store in S3, transform PDF, etc.)
    # This would be implemented in G3: White-Label Reporting Pipeline
    
    return {"success": True, "message": "File received successfully"}

# -------------------- Error Handlers --------------------

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions"""
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail, "status_code": exc.status_code},
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle general exceptions"""
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "status_code": 500},
    )

# -------------------- Main Entry Point --------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
