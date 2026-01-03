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

