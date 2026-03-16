from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet, me_view

router = DefaultRouter()
router.register(r'', UserViewSet)

urlpatterns = [
    path('me/', me_view, name='user-me'),
    path('', include(router.urls)),
]
