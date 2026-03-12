from rest_framework import serializers
from .models import Customer, SalesOrder, SalesOrderDetail
from apps.inventory.serializers import StockLotSerializer

class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = '__all__'

class SalesOrderDetailSerializer(serializers.ModelSerializer):
    stock_lot_details = StockLotSerializer(source='stock_lot', read_only=True)
    class Meta:
        model = SalesOrderDetail
        fields = ['id', 'sales_order', 'stock_lot', 'stock_lot_details', 'quantity', 'secondary_quantity', 'unit_price']

class SalesOrderSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    details = SalesOrderDetailSerializer(many=True, read_only=True)

    class Meta:
        model = SalesOrder
        fields = [
            'id', 'order_number', 'customer', 'customer_name', 
            'order_date', 'status', 'total_amount', 'details'
        ]
