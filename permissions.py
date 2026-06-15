from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsOwnerOrReadOnly(BasePermission):
    """Allow read to anyone; write only to the object owner."""
    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        return obj.owner == request.user or request.user.is_staff


class IsWarehouseOwner(BasePermission):
    """Only users with role=owner may access."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and (
            request.user.is_owner or request.user.is_staff
        )
