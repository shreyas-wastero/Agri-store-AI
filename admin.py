from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display  = ['username', 'email', 'first_name', 'last_name', 'role', 'city', 'is_active']
    list_filter   = ['role', 'is_active', 'state']
    search_fields = ['username', 'email', 'first_name', 'last_name', 'city']
    list_editable = ['role']

    fieldsets = BaseUserAdmin.fieldsets + (
        ('AgriStore Profile', {
            'fields': ('role', 'phone', 'city', 'state', 'latitude', 'longitude',
                       'land_area_acres', 'primary_crop', 'profile_pic'),
        }),
    )
