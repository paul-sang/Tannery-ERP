from rest_framework import viewsets
from .models import Supplier, PurchaseOrder
from .serializers import SupplierSerializer, PurchaseOrderSerializer

class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    search_fields = ['name', 'tax_id']

class PurchaseOrderViewSet(viewsets.ModelViewSet):
    queryset = PurchaseOrder.objects.prefetch_related('details__item').select_related('supplier').all()
    serializer_class = PurchaseOrderSerializer
    search_fields = ['order_number', 'supplier__name', 'status']
    filterset_fields = ['status']
    ordering_fields = ['order_number', 'order_date', 'total_amount']
