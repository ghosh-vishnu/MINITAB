"""
Custom User model for authentication.
"""
import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Custom user model extending Django's AbstractUser.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, db_index=True)
    full_name = models.CharField(max_length=255, blank=True)
    # who created this user (super user creates child users)
    created_by = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='created_users'
    )
    # keep a simple user_type field for future roles (do not hardcode role logic)
    USER_TYPE_CHOICES = [
        ('SUPER', 'Super User'),
        ('CHILD', 'Child User'),
    ]
    user_type = models.CharField(max_length=16, choices=USER_TYPE_CHOICES, default='SUPER')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
    
    def __str__(self):
        return self.username



