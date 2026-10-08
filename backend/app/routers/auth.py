from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..auth import create_session, current_user, verify_password
from ..config import settings
from ..database import get_db
from ..errors import ApiError
from ..models import Account, SessionToken, User
from ..schemas import LoginIn, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


def user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id, username=user.username, account_id=user.account_id,
        account_alias=user.account.alias, display_name=user.display_name,
    )


@router.post("/login", response_model=UserOut)
def login(body: LoginIn, response: Response, db: Session = Depends(get_db)) -> UserOut:
    account_key = body.account.strip().replace("-", "").lower()
    user = db.scalar(
        select(User)
        .join(Account)
        .where(or_(Account.id == account_key, Account.alias == account_key), User.username == body.username.strip())
    )
    if user is None or not verify_password(body.password, user.password_hash):
        raise ApiError(401, "Unauthorized", "Your authentication information is incorrect. Please try again.")
    session = create_session(db, user)
    response.set_cookie(
        settings.cookie_name, session.token, max_age=settings.session_days * 86400,
        httponly=True, samesite="lax", secure=settings.cookie_secure, path="/",
    )
    return user_out(user)


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, db: Session = Depends(get_db)) -> Response:
    token = request.cookies.get(settings.cookie_name)
    if token:
        session = db.get(SessionToken, token)
        if session:
            db.delete(session)
            db.commit()
    response.status_code = 204
    response.delete_cookie(settings.cookie_name, path="/")
    return response


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)) -> UserOut:
    return user_out(user)
