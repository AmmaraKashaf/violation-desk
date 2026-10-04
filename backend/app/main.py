"""FastAPI app: CORS, clean error responses, and the router."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from httpx import HTTPError
from postgrest.exceptions import APIError

from app.config import FRONTEND_ORIGIN
from app.routes import router

logger = logging.getLogger("violation_desk")

app = FastAPI(title="Violation Desk")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)
app.include_router(router)


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, error: RequestValidationError) -> JSONResponse:
    """Turn Pydantic's error list into one plain sentence the UI can show as-is."""
    messages: list[str] = []
    for item in error.errors():
        field = ".".join(str(part) for part in item["loc"] if part != "body")
        message = item["msg"].removeprefix("Value error, ")
        messages.append(f"{field}: {message}" if field else message)
    return JSONResponse(status_code=422, content={"detail": "; ".join(messages)})


@app.exception_handler(APIError)
@app.exception_handler(HTTPError)
@app.exception_handler(RuntimeError)
async def database_error(_: Request, error: Exception) -> JSONResponse:
    # Log the details for us; give the client a clean message, never a stack trace.
    logger.exception("Database error", exc_info=error)
    return JSONResponse(status_code=502, content={"detail": "The database could not be reached. Try again."})
