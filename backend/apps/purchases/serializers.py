from rest_framework import serializers
from .models import Supplier, PurchaseOrder, PurchaseOrderDetail
from apps.inventory.serializers import ItemSerializer

class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = '__all__'

class PurchaseOrderDetailSerializer(serializers.ModelSerializer):
    item_details = ItemSerializer(source='item', read_only=True)
    class Meta:
        model = PurchaseOrderDetail
        fields = ['id', 'purchase_order', 'item', 'item_details', 'quantity', 'secondary_quantity', 'unit_price']

class PurchaseOrderSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    details = PurchaseOrderDetailSerializer(many=True, read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = [
            'id', 'order_number', 'supplier', 'supplier_name', 
            'order_date', 'status', 'total_amount', 'details'
        ]
