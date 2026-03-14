from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ProductCategoryViewSet, UnitOfMeasureViewSet, ItemViewSet, 
    StockLotViewSet, StockMovementViewSet, InventoryDocumentViewSet
)

router = DefaultRouter()
router.register(r'categories', ProductCategoryViewSet)
router.register(r'uom', UnitOfMeasureViewSet)
router.register(r'items', ItemViewSet)
router.register(r'lots', StockLotViewSet)
router.register(r'movements', StockMovementViewSet)
router.register(r'documents', InventoryDocumentViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
