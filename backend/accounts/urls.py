from django.urls import path
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import MeView, UserListView

LoginView = extend_schema_view(post=extend_schema(summary="Log in (get JWT pair)"))(TokenObtainPairView)
RefreshView = extend_schema_view(post=extend_schema(summary="Refresh access token"))(TokenRefreshView)

urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/refresh/", RefreshView.as_view(), name="token-refresh"),
    path("auth/me/", MeView.as_view(), name="me"),
    path("users/", UserListView.as_view(), name="user-list"),
]
