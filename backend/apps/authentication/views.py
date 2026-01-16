"""
Views for authentication.
"""
from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model

from .serializers import (
    UserRegistrationSerializer,
    UserSerializer as AuthUserSerializer,
    LoginSerializer
)
from apps.rbac.serializers import UserSerializer as RBACUserSerializer
from apps.rbac.utils import log_activity, get_client_ip, get_user_agent
from .permissions import IsSuperUser
from .serializers import ChildUserCreateSerializer, ChildUserListSerializer
from rest_framework.permissions import IsAuthenticated
from rest_framework import generics
from django.shortcuts import get_object_or_404

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    """
    User registration endpoint.
    """
    queryset = User.objects.all()
    permission_classes = [AllowAny]
    serializer_class = UserRegistrationSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        
        # Use RBAC serializer to include roles and permissions
        user_serializer = RBACUserSerializer(user, context={'request': request})
        
        return Response({
            'user': user_serializer.data,
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """
    User login endpoint.
    """
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.validated_data['user']
    
    # Generate JWT tokens
    refresh = RefreshToken.for_user(user)
    
    # Log login activity
    log_activity(
        user=user,
        action_type='login',
        model_name='User',
        description=f"User logged in: {user.username}",
        object_id=user.id,
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request)
    )
    
    # Use RBAC serializer to include roles and permissions
    user_serializer = RBACUserSerializer(user, context={'request': request})
    
    return Response({
        'user': user_serializer.data,
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """
    User logout endpoint (blacklist refresh token).
    """
    try:
        refresh_token = request.data.get('refresh')
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except AttributeError:
                # Blacklist not configured, just return success
                pass
            except Exception:
                # Token invalid or already blacklisted
                pass
        
        # Log logout activity
        log_activity(
            user=request.user,
            action_type='logout',
            model_name='User',
            description=f"User logged out: {request.user.username}",
            object_id=request.user.id,
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request)
        )
        
        return Response(
            {'message': 'Successfully logged out.'},
            status=status.HTTP_200_OK
        )
    except Exception as e:
        return Response(
            {'error': 'Invalid token.'},
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_profile_view(request):
    """
    Get current user profile.
    """
    # Use RBAC serializer to include roles and permissions
    serializer = RBACUserSerializer(request.user, context={'request': request})
    return Response(serializer.data, status=status.HTTP_200_OK)


class ChildUserListCreateView(generics.ListCreateAPIView):
    """List child users created by the logged-in superuser, and create child users.

    Only accessible to superusers.
    """
    permission_classes = [IsAuthenticated, IsSuperUser]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ChildUserCreateSerializer
        return ChildUserListSerializer

    def get_queryset(self):
        # Return only child users created by this super user
        return User.objects.filter(created_by=self.request.user, user_type='CHILD').order_by('-created_at')

    def perform_create(self, serializer):
        user = serializer.save()
        # Set audit fields and mark as child
        user.created_by = self.request.user
        user.user_type = 'CHILD'
        user.save()


@api_view(['PATCH'])
@permission_classes([IsAuthenticated, IsSuperUser])
def toggle_user_status(request, id):
    """Enable or disable a child user. Only superuser who created the child user may toggle."""
    try:
        user = get_object_or_404(User, id=id, created_by=request.user)
        is_active = request.data.get('is_active')
        if is_active is None:
            return Response({'error': 'is_active (boolean) is required.'}, status=status.HTTP_400_BAD_REQUEST)

        user.is_active = bool(is_active)
        user.save()
        return Response({'id': str(user.id), 'is_active': user.is_active}, status=status.HTTP_200_OK)
    except Exception:
        return Response({'error': 'Unable to update user status.'}, status=status.HTTP_400_BAD_REQUEST)

