from rest_framework import serializers
from .models import (
    ProductCategory, UnitOfMeasure, Item, StockLot, StockMovement,
    InventoryDocument, InventoryDocumentLine
)

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

    class Meta:
        model = Item
        fields = [
            'id', 'sku', 'name', 'category', 'category_details', 
            'uom', 'uom_details', 'secondary_uom', 'secondary_uom_details',
            'min_stock_level', 'status', 'attributes', 'track_by_lot', 'current_stock'
        ]

class StockLotSerializer(serializers.ModelSerializer):
    item_details = ItemSerializer(source='item', read_only=True)

    class Meta:
        model = StockLot
        fields = [
            'id', 'item', 'item_details', 'lot_tracking_number', 
            'source_document_line',
            'current_primary_quantity', 'current_secondary_quantity'
        ]

class StockMovementSerializer(serializers.ModelSerializer):
    stock_lot_details = StockLotSerializer(source='stock_lot', read_only=True)
    item_details = ItemSerializer(source='item', read_only=True)
    user_name = serializers.CharField(source='user.username', read_only=True)
    document_number = serializers.CharField(
        source='document_line.document.document_number', read_only=True, default=''
    )

    class Meta:
        model = StockMovement
        fields = [
            'id', 'item', 'item_details', 'stock_lot', 'stock_lot_details',
            'document_line', 'document_number',
            'movement_type', 'quantity', 'secondary_quantity', 'date', 
            'reference_document', 'user', 'user_name'
        ]


# --- Inventory Document Serializers ---

class InventoryDocumentLineWriteSerializer(serializers.ModelSerializer):
    """Used for nested write operations when creating a document."""
    lot_tracking_number = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = InventoryDocumentLine
        fields = [
            'item', 'movement_type', 'quantity', 'secondary_quantity',
            'notes', 'lot_tracking_number'
        ]

class InventoryDocumentLineReadSerializer(serializers.ModelSerializer):
    """Used for reading document lines with full details."""
    item_details = ItemSerializer(source='item', read_only=True)
    stock_lot_details = StockLotSerializer(source='stock_lot', read_only=True)

    class Meta:
        model = InventoryDocumentLine
        fields = [
            'id', 'item', 'item_details', 'stock_lot', 'stock_lot_details',
            'movement_type', 'quantity', 'secondary_quantity', 'notes'
        ]

class InventoryDocumentWriteSerializer(serializers.ModelSerializer):
    """Handles creating a document with nested lines atomically."""
    lines = InventoryDocumentLineWriteSerializer(many=True)

    class Meta:
        model = InventoryDocument
        fields = [
            'document_type', 'notes', 'lines',
            'purchase_order', 'sales_order', 'production_batch'
        ]

    def validate_lines(self, value):
        if not value:
            raise serializers.ValidationError("At least one document line is required.")
        return value

    def create(self, validated_data):
        lines_data = validated_data.pop('lines')
        user = self.context['request'].user

        # Auto-generate document number
        from django.utils import timezone
        prefix_map = {
            'ADJ': 'ADJ', 'PUR': 'PUR', 'SAL': 'SAL',
            'PCN': 'PCN', 'POT': 'POT', 'TRF': 'TRF', 'INI': 'INI'
        }
        doc_type = validated_data['document_type']
        prefix = prefix_map.get(doc_type, 'DOC')
        count = InventoryDocument.objects.filter(document_type=doc_type).count() + 1
        timestamp = timezone.now().strftime('%Y%m%d')
        doc_number = f"{prefix}-{timestamp}-{count:04d}"

        document = InventoryDocument.objects.create(
            user=user,
            document_number=doc_number,
            **validated_data
        )

        for line_data in lines_data:
            lot_tracking_number = line_data.pop('lot_tracking_number', '')
            item = line_data['item']
            movement_type = line_data['movement_type']
            quantity = line_data['quantity']
            secondary_quantity = line_data.get('secondary_quantity')

            stock_lot = None

            # Handle lot-tracked items
            if item.track_by_lot:
                if movement_type == 'IN':
                    # Create a new lot or find existing one
                    if lot_tracking_number:
                        stock_lot, created = StockLot.objects.get_or_create(
                            lot_tracking_number=lot_tracking_number,
                            defaults={'item': item}
                        )
                    else:
                        # Auto-generate lot number
                        lot_count = StockLot.objects.filter(item=item).count() + 1
                        auto_lot_number = f"{item.sku}-{timestamp}-L{lot_count:04d}"
                        stock_lot = StockLot.objects.create(
                            item=item,
                            lot_tracking_number=auto_lot_number
                        )
                elif movement_type == 'OUT':
                    # For OUT, lot must exist
                    if lot_tracking_number:
                        try:
                            stock_lot = StockLot.objects.get(lot_tracking_number=lot_tracking_number)
                        except StockLot.DoesNotExist:
                            raise serializers.ValidationError(
                                f"Lot '{lot_tracking_number}' not found for item '{item.name}'."
                            )

            # Create the document line
            doc_line = InventoryDocumentLine.objects.create(
                document=document,
                stock_lot=stock_lot,
                **line_data
            )

            # Link source document line to newly created lots
            if stock_lot and movement_type == 'IN' and not stock_lot.source_document_line:
                stock_lot.source_document_line = doc_line
                stock_lot.save(update_fields=['source_document_line'])

            # Create the corresponding StockMovement
            # Map document movement type to StockMovement type
            if doc_type == 'ADJ':
                sm_type = StockMovement.MovementType.IN if movement_type == 'IN' else StockMovement.MovementType.OUT
            elif movement_type == 'IN':
                sm_type = StockMovement.MovementType.IN
            else:
                sm_type = StockMovement.MovementType.OUT

            StockMovement.objects.create(
                item=item,
                stock_lot=stock_lot,
                document_line=doc_line,
                movement_type=sm_type,
                quantity=quantity,
                secondary_quantity=secondary_quantity,
                reference_document=doc_number,
                user=user
            )

        return document


class InventoryDocumentReadSerializer(serializers.ModelSerializer):
    """Full read serializer with nested line details."""
    lines = InventoryDocumentLineReadSerializer(many=True, read_only=True)
    user_name = serializers.CharField(source='user.username', read_only=True)
    document_type_display = serializers.CharField(source='get_document_type_display', read_only=True)

    class Meta:
        model = InventoryDocument
        fields = [
            'id', 'document_number', 'document_type', 'document_type_display',
            'date', 'notes', 'user', 'user_name',
            'purchase_order', 'sales_order', 'production_batch',
            'lines'
        ]
