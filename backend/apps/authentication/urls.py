"""
URLs for authentication.
"""
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView,
    login_view,
    logout_view,
    user_profile_view
)
from .views import ChildUserListCreateView, toggle_user_status

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', login_view, name='login'),
    path('logout/', logout_view, name='logout'),
    path('profile/', user_profile_view, name='profile'),
    path('users/', ChildUserListCreateView.as_view(), name='child_users'),
    path('users/<uuid:id>/status/', toggle_user_status, name='user_status'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]
