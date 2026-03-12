from rest_framework import serializers
from .models import ProductCategory, UnitOfMeasure, Item, StockLot, StockMovement

class ProductCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductCategory
        fields = '__all__'

class UnitOfMeasureSerializer(serializers.ModelSerializer):
    class Meta:
        model = UnitOfMeasure
        fields = '__all__'

class ItemSerializer(serializers.ModelSerializer):
    category_details = ProductCategorySerializer(source='category', read_only=True)
    uom_details = UnitOfMeasureSerializer(source='uom', read_only=True)
    secondary_uom_details = UnitOfMeasureSerializer(source='secondary_uom', read_only=True)
    total_stock = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Item
        fields = [
            'id', 'sku', 'name', 'category', 'category_details', 
            'uom', 'uom_details', 'secondary_uom', 'secondary_uom_details',
            'min_stock_level', 'status', 'attributes', 'total_stock'
        ]

class StockLotSerializer(serializers.ModelSerializer):
    item_details = ItemSerializer(source='item', read_only=True)

    class Meta:
        model = StockLot
        fields = [
            'id', 'item', 'item_details', 'lot_tracking_number', 
            'source_batch', 'source_purchase_detail', 
            'current_primary_quantity', 'current_secondary_quantity'
        ]

class StockMovementSerializer(serializers.ModelSerializer):
    stock_lot_details = StockLotSerializer(source='stock_lot', read_only=True)
    user_name = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = StockMovement
        fields = [
            'id', 'stock_lot', 'stock_lot_details', 'movement_type', 
            'quantity', 'secondary_quantity', 'date', 
            'reference_document', 'user', 'user_name'
        ]
