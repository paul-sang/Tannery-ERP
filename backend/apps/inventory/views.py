from django.db.models import Sum, Value
from django.db.models.functions import Coalesce
from decimal import Decimal
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import (
    ProductCategory, UnitOfMeasure, Item, StockLot, StockMovement,
    InventoryDocument, InventoryDocumentLine
)
from .serializers import (
    ProductCategorySerializer, UnitOfMeasureSerializer, ItemSerializer,
    StockLotSerializer, StockMovementSerializer,
    InventoryDocumentWriteSerializer, InventoryDocumentReadSerializer
)

class ProductCategoryViewSet(viewsets.ModelViewSet):
    queryset = ProductCategory.objects.all()
    serializer_class = ProductCategorySerializer

    @action(detail=True, methods=['get'])
    def next_sku(self, request, pk=None):
        category = self.get_object()
        
        prefix_map = {
            'RAW_HIDE': 'RWH',
            'CHEMICAL': 'CHM',
            'FINISHED_LEATHER': 'FIN',
            'SUPPLIES': 'SUP',
        }
        
        prefix = prefix_map.get(category.name, 'ITM')
        count = Item.objects.filter(category=category).count()
        next_seq = count + 1
        
        suggested_sku = f"{prefix}-{next_seq:04d}"
        return Response({'next_sku': suggested_sku})

class UnitOfMeasureViewSet(viewsets.ModelViewSet):
    queryset = UnitOfMeasure.objects.all()
    serializer_class = UnitOfMeasureSerializer

class ItemViewSet(viewsets.ModelViewSet):
    queryset = Item.objects.select_related('category', 'uom', 'secondary_uom').all()
    serializer_class = ItemSerializer
    search_fields = ['sku', 'name', 'category__name', 'uom__name']
    filterset_fields = ['category', 'track_by_lot']
    ordering_fields = ['id', 'sku', 'name', 'category__name', 'uom__name', 'current_stock']
    ordering = ['-id']

    @action(detail=True, methods=['get'])
    def stock_report(self, request, pk=None):
        item = self.get_object()
        
        # Get active lots (qty > 0)
        active_lots = StockLot.objects.filter(item=item, current_primary_quantity__gt=0).order_by('lot_tracking_number')
        lots_data = StockLotSerializer(active_lots, many=True).data
        
        # Get recent movements (last 50) globally for the item or its lots
        from django.db.models import Q
        movements = StockMovement.objects.select_related(
            'stock_lot', 'item', 'user', 'document_line__document'
        ).filter(
            Q(stock_lot__item=item) | Q(item=item)
        ).order_by('-date', '-id')[:50]
        movements_data = StockMovementSerializer(movements, many=True).data
        
        return Response({
            'current_stock': item.current_stock,
            'track_by_lot': item.track_by_lot,
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
    queryset = StockMovement.objects.select_related(
        'stock_lot', 'item', 'user', 'document_line__document'
    ).all()
    serializer_class = StockMovementSerializer
    filterset_fields = ['movement_type', 'stock_lot', 'item']
    ordering_fields = ['date', 'quantity']
    ordering = ['-date']

class InventoryDocumentViewSet(viewsets.ModelViewSet):
    queryset = InventoryDocument.objects.select_related('user').prefetch_related(
        'lines__item', 'lines__stock_lot'
    ).all()
    search_fields = ['document_number', 'notes']
    filterset_fields = ['document_type']
    ordering_fields = ['date', 'document_number']
    ordering = ['-date']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return InventoryDocumentWriteSerializer
        return InventoryDocumentReadSerializer
