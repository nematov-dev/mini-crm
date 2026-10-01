from django.contrib.auth import get_user_model
from drf_spectacular.utils import extend_schema
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from leads.serializers import UserShortSerializer

from .serializers import MeSerializer

User = get_user_model()


@extend_schema(summary="Current user")
class MeView(generics.RetrieveAPIView):
    serializer_class = MeSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


@extend_schema(summary="Active users (for the lead owner selector)")
class UserListView(generics.ListAPIView):
    serializer_class = UserShortSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None
    queryset = User.objects.filter(is_active=True).order_by("username")
