"""Unified error format for the whole API.

Every error response looks like:
    {
        "error": {
            "code": "validation_error",
            "message": "Invalid input.",
            "details": {"email": ["Enter a valid email address."]}
        }
    }

so the frontend can always read `error.message` for a toast and
`error.details` to highlight form fields.
"""

import logging

from django.core.exceptions import PermissionDenied
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def api_exception_handler(exc, context):
    # Map Django's native exceptions to their DRF equivalents first.
    if isinstance(exc, Http404):
        exc = exceptions.NotFound()
    elif isinstance(exc, PermissionDenied):
        exc = exceptions.PermissionDenied()

    response = exception_handler(exc, context)

    if response is None:
        # Unhandled exception -> log it and hide internals from the client.
        logger.exception("Unhandled API error", exc_info=exc)
        return Response(
            {"error": {"code": "server_error", "message": "Internal server error.", "details": None}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    if isinstance(exc, exceptions.ValidationError):
        code = "validation_error"
        message = "Invalid input."
        details = response.data
    else:
        codes = exc.get_codes() if isinstance(exc, exceptions.APIException) else None
        code = codes if isinstance(codes, str) else "error"
        data = response.data
        message = data.get("detail", str(exc)) if isinstance(data, dict) else str(exc)
        details = {k: v for k, v in data.items() if k != "detail"} if isinstance(data, dict) else None
        details = details or None

    response.data = {"error": {"code": code, "message": str(message), "details": details}}
    return response
