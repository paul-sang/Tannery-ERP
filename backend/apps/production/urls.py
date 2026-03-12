from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProductionStageViewSet, ProductionProcessViewSet, ProductionBatchViewSet

router = DefaultRouter()
router.register(r'stages', ProductionStageViewSet)
router.register(r'processes', ProductionProcessViewSet)
router.register(r'batches', ProductionBatchViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
