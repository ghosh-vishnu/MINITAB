"""
Serializers for authentication.
"""
from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from .models import User


class UserRegistrationSerializer(serializers.ModelSerializer):
    """
    Serializer for user registration.
    """
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password]
    )
    password_confirm = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password', 'password_confirm', 
                  'first_name', 'last_name', 'date_joined')
        read_only_fields = ('id', 'date_joined')
        extra_kwargs = {
            'email': {'required': True},
            'username': {'required': True},
        }

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({
                "password": "Password fields didn't match."
            })
        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
        )
        return user


class UserSerializer(serializers.ModelSerializer):
    """
    Serializer for user data.
    """
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 
                  'date_joined', 'last_login')
        read_only_fields = ('id', 'date_joined', 'last_login')


class LoginSerializer(serializers.Serializer):
    """
    Serializer for user login.
    Accepts either username or email.
    """
    username = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    password = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        username = attrs.get('username', '').strip()
        email = attrs.get('email', '').strip()
        password = attrs.get('password')

        if not password:
            raise serializers.ValidationError(
                'Password is required.'
            )

        # Determine if login is by username or email
        if email:
            # Login by email
            try:
                user = User.objects.get(email=email)
                if not user.check_password(password):
                    raise serializers.ValidationError(
                        'Unable to log in with provided credentials.'
                    )
            except User.DoesNotExist:
                raise serializers.ValidationError(
                    'Unable to log in with provided credentials.'
                )
        elif username:
            # Login by username
            user = authenticate(username=username, password=password)
            if not user:
                raise serializers.ValidationError(
                    'Unable to log in with provided credentials.'
                )
        else:
            raise serializers.ValidationError(
                'Must include either "username" or "email" and "password".'
            )

        if not user.is_active:
            raise serializers.ValidationError(
                'User account is disabled.'
            )
        
        attrs['user'] = user
        return attrs

