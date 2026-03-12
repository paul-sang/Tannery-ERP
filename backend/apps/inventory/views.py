from django.db.models import Sum, Value
from django.db.models.functions import Coalesce
from decimal import Decimal
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import ProductCategory, UnitOfMeasure, Item, StockLot, StockMovement
from .serializers import (
    ProductCategorySerializer, UnitOfMeasureSerializer, ItemSerializer,
    StockLotSerializer, StockMovementSerializer
)

class ProductCategoryViewSet(viewsets.ModelViewSet):
    queryset = ProductCategory.objects.all()
    serializer_class = ProductCategorySerializer

    @action(detail=True, methods=['get'])
    def next_sku(self, request, pk=None):
        category = self.get_object()
        
        # Map category names to a 3-letter prefix
        prefix_map = {
            'RAW_HIDE': 'RWH',
            'CHEMICAL': 'CHM',
            'FINISHED_LEATHER': 'FIN',
            'SUPPLIES': 'SUP',
        }
        
        prefix = prefix_map.get(category.name, 'ITM')
        
        # Count existing items in this category to generate the sequence
        # Note: A real high-concurrency ERP would use a dedicated DB sequence, 
        # but counting works fine for this implementation stage.
        count = Item.objects.filter(category=category).count()
        next_seq = count + 1
        
        suggested_sku = f"{prefix}-{next_seq:04d}"
        return Response({'next_sku': suggested_sku})

class UnitOfMeasureViewSet(viewsets.ModelViewSet):
    queryset = UnitOfMeasure.objects.all()
    serializer_class = UnitOfMeasureSerializer

class ItemViewSet(viewsets.ModelViewSet):
    queryset = Item.objects.select_related('category', 'uom', 'secondary_uom').annotate(
        total_stock=Coalesce(Sum('lots__current_primary_quantity'), Value(Decimal('0.00')))
    ).all()
    serializer_class = ItemSerializer
    # Note: Search on JSONField 'attributes' is only fully supported natively
    # via icontains on PostgreSQL. SQLite does not support this cast seamlessly.
    search_fields = ['sku', 'name', 'category__name', 'uom__name']
    filterset_fields = ['category']
    ordering_fields = ['sku', 'name', 'category__name', 'uom__name']

    @action(detail=True, methods=['get'])
    def stock_report(self, request, pk=None):
        item = self.get_object()
        
        # Get active lots (qty > 0)
        active_lots = StockLot.objects.filter(item=item, current_primary_quantity__gt=0).order_by('lot_tracking_number')
        lots_data = StockLotSerializer(active_lots, many=True).data
        
        # Get recent movements (last 50)
        movements = StockMovement.objects.filter(stock_lot__item=item).order_by('-date', '-id')[:50]
        movements_data = StockMovementSerializer(movements, many=True).data
        
        return Response({
            'total_stock': item.total_stock if hasattr(item, 'total_stock') and item.total_stock is not None else 0,
            'active_lots': lots_data,
            'recent_movements': movements_data
        })

class StockLotViewSet(viewsets.ModelViewSet):
    queryset = StockLot.objects.select_related('item').all()
    serializer_class = StockLotSerializer
    search_fields = ['lot_tracking_number', 'item__name', 'item__sku']
    filterset_fields = ['item']
    ordering_fields = ['lot_tracking_number', 'current_primary_quantity']

class StockMovementViewSet(viewsets.ModelViewSet):
    queryset = StockMovement.objects.select_related('stock_lot', 'user').all()
    serializer_class = StockMovementSerializer
    filterset_fields = ['movement_type', 'stock_lot']
    ordering_fields = ['created_at', 'primary_quantity']
