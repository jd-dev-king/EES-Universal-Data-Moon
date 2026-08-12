import base64
import hashlib
import hmac
import os
import secrets
import time
from fastapi import HTTPException, Request, Response

COOKIE_NAME = "ees_data_moon_admin"
SESSION_TTL = int(os.getenv("DATA_MOON_ADMIN_SESSION_TTL", "28800"))


def _secret() -> bytes:
    value = os.getenv("DATA_MOON_SESSION_SECRET", "")
    if len(value) < 32:
        raise HTTPException(status_code=503, detail="Admin session secret is not configured.")
    return value.encode()


def _expected_password_hash() -> str:
    value = os.getenv("DATA_MOON_ADMIN_PASSWORD_HASH", "")
    if not value:
        raise HTTPException(status_code=503, detail="Admin password hash is not configured.")
    return value


def verify_password(password: str) -> bool:
    # Format: scrypt$N$r$p$salt_b64$digest_b64
    try:
        _, n, r, p, salt64, digest64 = _expected_password_hash().split("$", 5)
        salt = base64.urlsafe_b64decode(salt64.encode())
        expected = base64.urlsafe_b64decode(digest64.encode())
        actual = hashlib.scrypt(password.encode(), salt=salt, n=int(n), r=int(r), p=int(p), dklen=len(expected))
        return hmac.compare_digest(actual, expected)
    except HTTPException:
        raise
    except Exception:
        return False


def issue_session(response: Response, username: str) -> None:
    expires = int(time.time()) + SESSION_TTL
    nonce = secrets.token_urlsafe(12)
    payload = f"{username}|{expires}|{nonce}"
    signature = hmac.new(_secret(), payload.encode(), hashlib.sha256).hexdigest()
    token = base64.urlsafe_b64encode(f"{payload}|{signature}".encode()).decode()
    response.set_cookie(
        COOKIE_NAME, token, max_age=SESSION_TTL, httponly=True,
        secure=os.getenv("DATA_MOON_COOKIE_SECURE", "true").lower() == "true",
        samesite="none" if os.getenv("DATA_MOON_COOKIE_SECURE", "true").lower() == "true" else "lax",
        path="/",
    )


def clear_session(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/", samesite="none")


def require_admin(request: Request) -> str:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Admin authentication required.")
    try:
        decoded = base64.urlsafe_b64decode(token.encode()).decode()
        username, expires, nonce, signature = decoded.rsplit("|", 3)
        payload = f"{username}|{expires}|{nonce}"
        expected = hmac.new(_secret(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected) or int(expires) < int(time.time()):
            raise ValueError
        if username != os.getenv("DATA_MOON_ADMIN_USERNAME", "admin"):
            raise ValueError
        return username
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Admin session is invalid or expired.")
