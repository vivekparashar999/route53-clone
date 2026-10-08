from fastapi import Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class ApiError(Exception):
    """Domain error rendered as {"detail": {"code", "message"}} (Route 53 error codes)."""

    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def not_found(what: str, ident: str | int) -> ApiError:
    code = "NoSuchHostedZone" if what == "hosted zone" else "NotFound"
    return ApiError(404, code, f"No {what} found with ID: {ident}")


def invalid_change(message: str) -> ApiError:
    return ApiError(400, "InvalidChangeBatch", message)


async def api_error_handler(_request: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(status_code=exc.status, content={"detail": {"code": exc.code, "message": exc.message}})


async def validation_error_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    first = exc.errors()[0] if exc.errors() else {}
    field = ".".join(str(p) for p in first.get("loc", []) if p != "body")
    message = f"{field}: {first.get('msg', 'Invalid input')}" if field else first.get("msg", "Invalid input")
    return JSONResponse(
        status_code=422,
        content={"detail": {"code": "InvalidInput", "message": message, "errors": jsonable_encoder(exc.errors())}},
    )
