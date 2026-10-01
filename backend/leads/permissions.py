from rest_framework.permissions import SAFE_METHODS, BasePermission


class CanDeleteLead(BasePermission):
    """Any authenticated user can read and edit leads (shared pipeline),
    but only the lead's owner or a staff user can delete it."""

    message = "Only the lead owner or an admin can delete this lead."

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS or request.method != "DELETE":
            return True
        return request.user.is_staff or obj.owner_id == request.user.id
