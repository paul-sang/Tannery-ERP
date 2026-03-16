from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import User
from .serializers import UserSerializer


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    search_fields = ['username', 'email', 'first_name', 'last_name']
    filterset_fields = ['role', 'is_active']


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me_view(request):
    """Return authenticated user's profile with role."""
    serializer = UserSerializer(request.user)
    return Response(serializer.data)
