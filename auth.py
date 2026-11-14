import os
from datetime import datetime, timedelta
import jwt
import bcrypt
from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel
from database import SessionLocal, User

router = APIRouter(prefix="/auth", tags=["auth"])

oauth = OAuth()

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")
IS_PROD = FRONTEND_URL.startswith("https://")

SECRET_KEY = os.getenv("JWT_SECRET_KEY", os.getenv("SECRET_KEY", "super-secret-dev-key-change-me"))
ALGORITHM = "HS256"

oauth.register(
    name="google",
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)


class SignupRequest(BaseModel):
    email: str
    password: str
    name: str = "User"


class LoginRequest(BaseModel):
    email: str
    password: str


def create_jwt_token(user_id: int | str, email: str) -> str:
    expire = datetime.utcnow() + timedelta(days=7)
    payload = {"sub": str(user_id), "email": str(email), "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(request: Request) -> dict:
    """Checks if user is logged in via Authorization Bearer header OR cookie."""
    token = None

    # 1. Check Authorization: Bearer <token> header first (works across Vercel + Render on all browsers)
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()

    # 2. Fallback to cookie
    if not token:
        token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(status_code=401, detail="not logged in")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return {"user_id": int(payload["sub"]), "email": payload["email"]}
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="invalid or expired session")


@router.post("/signup")
async def signup(data: SignupRequest):
    db = SessionLocal()
    try:
        exist = db.query(User).filter(User.email == data.email.lower()).first()
        if exist:
            return JSONResponse({"error": "Email already registered"}, status_code=401)

        salt = bcrypt.gensalt()
        hashed_pw = bcrypt.hashpw(data.password.encode("utf-8"), salt).decode("utf-8")
        new_user = User(
            email=data.email.lower(),
            name=data.name,
            hashed_password=hashed_pw,
            auth_provider="local",
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        token = create_jwt_token(new_user.id, new_user.email)
        response = JSONResponse({
            "success": True,
            "message": "account created",
            "user_id": new_user.id,
            "email": new_user.email,
            "token": token,
        })
        response.set_cookie(
            key="access_token",
            value=token,
            httponly=True,
            max_age=7 * 24 * 3600,
            samesite="none" if IS_PROD else "lax",
            secure=True if IS_PROD else False,
        )
        return response
    finally:
        db.close()


@router.post("/login")
async def login(data: LoginRequest):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == data.email.lower()).first()
        if not user or not user.hashed_password:
            return JSONResponse(
                {"error": "Invalid email or password (or use Google Login)"},
                status_code=401,
            )
        if not bcrypt.checkpw(data.password.encode("utf-8"), user.hashed_password.encode("utf-8")):
            return JSONResponse({"error": "Invalid email or password"}, status_code=401)

        token = create_jwt_token(user.id, user.email)
        response = JSONResponse({
            "success": True,
            "message": "logged in",
            "user_id": user.id,
            "email": user.email,
            "token": token,
        })
        response.set_cookie(
            key="access_token",
            value=token,
            httponly=True,
            max_age=7 * 24 * 3600,
            samesite="none" if IS_PROD else "lax",
            secure=True if IS_PROD else False,
        )
        return response
    finally:
        db.close()


@router.get("/google/login")
async def google_login(request: Request):
    redirect_uri = str(request.url_for("google_callback"))
    # Ensure HTTPS callback URL when running behind Render's reverse proxy
    if IS_PROD and redirect_uri.startswith("http://"):
        redirect_uri = redirect_uri.replace("http://", "https://", 1)
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/google/callback")
async def google_callback(request: Request):
    token_data = await oauth.google.authorize_access_token(request)
    user_info = token_data.get("userinfo")

    if not user_info:
        raise HTTPException(status_code=400, detail="Google login failed")

    email = user_info["email"].lower()
    name = user_info.get("name", "Google User")

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(email=email, name=name, auth_provider="google")
            db.add(user)
            db.commit()
            db.refresh(user)

        jwt_token = create_jwt_token(user.id, user.email)
        # Pass ?token= in redirect URL so Brave/Chrome/Safari on Vercel can store it immediately
        response = RedirectResponse(url=f"{FRONTEND_URL}?token={jwt_token}")
        response.set_cookie(
            key="access_token",
            value=jwt_token,
            httponly=True,
            max_age=7 * 24 * 3600,
            samesite="none" if IS_PROD else "lax",
            secure=True if IS_PROD else False,
        )
        return response
    finally:
        db.close()


@router.post("/logout")
async def logout():
    response = JSONResponse({"success": True, "message": "logged out"})
    response.delete_cookie(
        "access_token",
        samesite="none" if IS_PROD else "lax",
        secure=True if IS_PROD else False,
    )
    return response


@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    return {"user_id": user["user_id"], "email": user["email"]}



