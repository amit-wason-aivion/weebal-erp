import os
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from .database import get_db
from .models import User

# Configuration
SECRET_KEY = "SUPER_SECRET_AIVION_KEY_CHANGE_IN_PROD"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480 # 8 hours

# Use pbkdf2_sha256 which is pure-python and very stable on all systems
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

def get_current_company(
    current_user: User = Depends(get_current_user), 
    x_company_id: Optional[int] = Header(None, alias="X-Company-ID"),
    company_id: Optional[int] = None
):
    """
    Extracts company_id from headers, query params, or the user's direct assignment.
    For non-superadmins: Strictly uses their assigned company_id.
    For superadmins: Requires a company context via header or query param.
    """
    if current_user.role != "superadmin":
        if not current_user.company_id:
            raise HTTPException(status_code=403, detail="User is not assigned to any company.")
        return current_user.company_id
        
    # Superadmin context resolution
    effective_id = x_company_id or company_id or current_user.company_id
    
    if not effective_id:
        raise HTTPException(status_code=400, detail="Superadmin must provide X-Company-ID header or company_id query param.")
        
    return effective_id

def check_report_access(current_user: User = Depends(get_current_user)):
    """Restricts access to 'Admin', 'superadmin', and 'Viewer' roles only."""
    user_role = (current_user.role or "").lower()
    if user_role not in ["admin", "superadmin", "viewer"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Access denied. Only Admins and Viewers can access reports."
        )
    return current_user

def check_admin_access(current_user: User = Depends(get_current_user)):
    """Strictly for Company Admin or Global Superadmin."""
    user_role = (current_user.role or "").lower()
    if user_role not in ["admin", "superadmin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Admin access required for this operation."
        )
    return current_user
