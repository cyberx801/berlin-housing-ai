"""FastAPI service for the demo rent model (docs/contracts/PREDICTION_API.md, draft.2; D-058).

Every non-2xx answer uses the contract's error envelope, including FastAPI's own validation errors.
The service holds no secrets and logs no request payloads.
"""
import json
import logging
import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .inference import API_VERSION, ENUMS, RentModel

log = logging.getLogger("rent_api")
DEFAULT_ARTIFACT_DIR = Path(__file__).resolve().parents[1] / "artifacts" / "rent_v1"


def _request_id(request: Request) -> str:
    raw = request.headers.get("x-request-id", "")
    try:
        return str(uuid.UUID(raw))
    except ValueError:
        return str(uuid.uuid4())


def _envelope(status: int, rid: str, code: str, message: str, details=None, retryable=False) -> JSONResponse:
    body = {"api_version": API_VERSION, "request_id": rid,
            "error": {"code": code, "message": message, "details": details or [], "retryable": retryable}}
    return JSONResponse(body, status_code=status, headers={"X-Request-ID": rid})


def create_app(artifact_dir=None) -> FastAPI:
    directory = Path(artifact_dir or os.environ.get("RENT_MODEL_DIR") or DEFAULT_ARTIFACT_DIR)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        try:
            app.state.model = RentModel(str(directory))
            log.info("loaded %s", app.state.model.version)
        except Exception:  # the service stays up and reports MODEL_UNAVAILABLE
            log.exception("model failed to load from %s", directory)
            app.state.model = None
        yield

    app = FastAPI(title="Berlin Housing AI rent service (demo model)", version=API_VERSION, lifespan=lifespan,
                  docs_url="/api/docs", openapi_url="/api/openapi.json", redoc_url=None)

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError):
        details = [{"field": str(e["loc"][-1]), "issue": e["msg"]} for e in exc.errors()]
        return _envelope(422, _request_id(request), "VALIDATION_ERROR", f"Request has {len(details)} invalid field(s).", details)

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException):
        code = "NOT_FOUND" if exc.status_code == 404 else "METHOD_NOT_ALLOWED" if exc.status_code == 405 else "INTERNAL_ERROR"
        return _envelope(exc.status_code, _request_id(request), code, str(exc.detail))

    @app.exception_handler(Exception)
    async def _unexpected(request: Request, exc: Exception):
        log.exception("unhandled error")
        return _envelope(500, _request_id(request), "INTERNAL_ERROR", "Unexpected error.")

    @app.get("/api/v1/health")
    async def health(request: Request):
        model = request.app.state.model
        return {"status": "ok" if model else "down", "model_loaded": model is not None,
                "model_version": model.version if model else None, "api_version": API_VERSION}

    @app.get("/api/v1/models/rent/current")
    async def model_card(request: Request):
        rid, model = _request_id(request), request.app.state.model
        if model is None:
            return _envelope(503, rid, "MODEL_UNAVAILABLE", "Model is not loaded.", retryable=True)
        m, s = model.meta, model.schema
        return {"api_version": API_VERSION, "request_id": rid, "name": m["name"], "version": model.version, "trained_at": m["trained_at"],
                "status": m["status"], "synthetic": bool(m["data"].get("synthetic", True)), "data_reference_date": s["data_reference_date"],
                "reference_period": s["reference_period"], "target": m["target"], "split_protocol": m["split_protocol"],
                "interval": m["interval"], "metrics": m["metrics"], "caveat_test": m["caveat_test"],
                "data": {"source_slug": m["data"]["source_slug"], "license": m["data"]["license"], "provenance": m["data"]["provenance"]},
                "limitations": m["limitations"]}

    @app.get("/api/v1/schema/rent")
    async def schema(request: Request):
        rid, model = _request_id(request), request.app.state.model
        if model is None:
            return _envelope(503, rid, "MODEL_UNAVAILABLE", "Model is not loaded.", retryable=True)
        s = model.schema
        return {"api_version": API_VERSION, "request_id": rid, "bezirke": s["bezirke"],
                "ortsteile_by_bezirk": {b: sorted(o) for b, o in s["ortsteil_by_bezirk"].items()},
                "enums": {k: sorted(v) for k, v in ENUMS.items()}, "model_ranges": s["ranges"],
                "ignored_request_fields": s["ignored_request_fields"], "enum_map": s["enum_map"]}

    @app.post("/api/v1/predictions/rent")
    async def predict_rent(request: Request):
        rid, model = _request_id(request), request.app.state.model
        if model is None:
            return _envelope(503, rid, "MODEL_UNAVAILABLE", "Model is not loaded.", retryable=True)
        try:
            payload = json.loads(await request.body())
        except (json.JSONDecodeError, UnicodeDecodeError):
            return _envelope(422, rid, "VALIDATION_ERROR", "Request body is not valid JSON.", [{"field": "body", "issue": "not valid JSON"}])
        status, body = model.predict(payload, request_id=rid)
        return JSONResponse(body, status_code=status, headers={"X-Request-ID": rid})

    return app


app = create_app()
