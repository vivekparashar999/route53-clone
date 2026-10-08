import os
from dataclasses import dataclass, field


def _csv(value: str) -> list[str]:
    return [v.strip() for v in value.split(",") if v.strip()]


@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./route53.db")
    cookie_name: str = "r53_session"
    cookie_secure: bool = os.getenv("COOKIE_SECURE", "0") == "1"
    session_days: int = 7
    cors_origins: list[str] = field(
        default_factory=lambda: _csv(os.getenv("CORS_ORIGINS", "http://localhost:3000"))
    )
    seed_demo: bool = os.getenv("SEED_DEMO", "1") == "1"


settings = Settings()
