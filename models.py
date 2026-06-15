"""
accounts/models.py — Custom User model
Roles: farmer | owner | admin
"""

from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    ROLE_FARMER = 'farmer'
    ROLE_OWNER  = 'owner'
    ROLE_ADMIN  = 'admin'
    ROLE_CHOICES = [
        (ROLE_FARMER, 'Farmer'),
        (ROLE_OWNER,  'Warehouse Owner'),
        (ROLE_ADMIN,  'Admin'),
    ]

    role         = models.CharField(max_length=10, choices=ROLE_CHOICES, default=ROLE_FARMER)
    phone        = models.CharField(max_length=15, blank=True)
    city         = models.CharField(max_length=100, blank=True)
    state        = models.CharField(max_length=100, default='Karnataka')
    latitude     = models.FloatField(null=True, blank=True)
    longitude    = models.FloatField(null=True, blank=True)
    profile_pic  = models.ImageField(upload_to='profiles/', null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    # Farmer-specific
    land_area_acres = models.FloatField(null=True, blank=True)
    primary_crop    = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return f"{self.get_full_name()} ({self.role})"

    @property
    def is_farmer(self):
        return self.role == self.ROLE_FARMER

    @property
    def is_owner(self):
        return self.role == self.ROLE_OWNER
