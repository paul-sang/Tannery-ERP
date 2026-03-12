from rest_framework import viewsets
from .models import Customer, SalesOrder
from .serializers import CustomerSerializer, SalesOrderSerializer

class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    search_fields = ['name', 'tax_id']

class SalesOrderViewSet(viewsets.ModelViewSet):
    queryset = SalesOrder.objects.prefetch_related(
        'details__stock_lot__item'
    ).select_related('customer').all()
    serializer_class = SalesOrderSerializer
    search_fields = ['so_number', 'customer__name', 'status']
    filterset_fields = ['status']
    ordering_fields = ['so_number', 'order_date', 'expected_dispatch', 'total_amount']
