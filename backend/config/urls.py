from django.conf import settings
from django.contrib import admin
from django.http import FileResponse, Http404, JsonResponse
from django.urls import include, path, re_path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView


def health(_request):
    return JsonResponse({"status": "ok"})


def spa_index(_request):
    """Serve the React app for client-side routes (/leads, /leads/5, ...).

    Only used in single-container deploys where frontend/dist is bundled
    into the image; otherwise nginx (docker-compose) or Vite (dev) does this.
    """
    index = settings.FRONTEND_DIST / "index.html"
    if not index.is_file():
        raise Http404
    return FileResponse(index.open("rb"), content_type="text/html")


urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", health),
    path("api/", include("accounts.urls")),
    path("api/", include("leads.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    re_path(r"^(?!api/|admin/|static/|health/).*$", spa_index),
]
