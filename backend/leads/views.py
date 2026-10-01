from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from . import services
from .filters import LeadFilter
from .models import Lead
from .permissions import CanDeleteLead
from .serializers import (
    LeadActivitySerializer,
    LeadSerializer,
    LeadStatsSerializer,
    LeadStatusSerializer,
)


@extend_schema_view(
    list=extend_schema(
        summary="List leads",
        description=(
            "Paginated list. Filters: `status` (repeatable), `source` (repeatable), `owner`, "
            "`created_after`, `created_before`. Search: `search` over name/email/phone. "
            "Sorting: `ordering` = created_at | updated_at | name | status (prefix `-` for desc)."
        ),
    ),
    retrieve=extend_schema(summary="Get lead details"),
    create=extend_schema(summary="Create a lead"),
    update=extend_schema(summary="Replace a lead"),
    partial_update=extend_schema(summary="Update lead fields"),
    destroy=extend_schema(summary="Delete a lead (owner or admin only)"),
)
class LeadViewSet(viewsets.ModelViewSet):
    serializer_class = LeadSerializer
    permission_classes = [IsAuthenticated, CanDeleteLead]
    filterset_class = LeadFilter
    search_fields = ("name", "email", "phone")
    ordering_fields = ("created_at", "updated_at", "name", "status")
    ordering = ("-created_at",)

    def get_queryset(self):
        return Lead.objects.select_related("owner")

    def perform_create(self, serializer):
        serializer.instance = services.create_lead(
            data=dict(serializer.validated_data), actor=self.request.user
        )

    def perform_update(self, serializer):
        serializer.instance = services.update_lead(
            lead=serializer.instance,
            data=dict(serializer.validated_data),
            actor=self.request.user,
        )

    @extend_schema(
        summary="Change lead status",
        request=LeadStatusSerializer,
        responses=LeadSerializer,
    )
    @action(detail=True, methods=["post"], url_path="status")
    def change_status(self, request, pk=None):
        lead = self.get_object()
        serializer = LeadStatusSerializer(data=request.data, context={"lead": lead})
        serializer.is_valid(raise_exception=True)
        lead = services.change_status(
            lead=lead, status=serializer.validated_data["status"], actor=request.user
        )
        return Response(LeadSerializer(lead).data)

    @extend_schema(summary="Lead activity history", responses=LeadActivitySerializer(many=True))
    @action(detail=True, methods=["get"])
    def activities(self, request, pk=None):
        lead = self.get_object()
        qs = lead.activities.select_related("actor")
        page = self.paginate_queryset(qs)
        serializer = LeadActivitySerializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @extend_schema(
        summary="Dashboard statistics",
        description="Aggregates over all leads; accepts the same filters as the list endpoint.",
        responses=LeadStatsSerializer,
    )
    @action(detail=False, methods=["get"], pagination_class=None)
    def stats(self, request):
        qs = self.filter_queryset(self.get_queryset())
        return Response(LeadStatsSerializer(services.get_stats(qs)).data, status=status.HTTP_200_OK)
