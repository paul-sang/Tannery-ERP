from rest_framework import viewsets
from .models import ProductionStage, ProductionProcess, ProductionBatch
from .serializers import (
    ProductionStageSerializer, ProductionProcessSerializer, ProductionBatchSerializer
)

class ProductionStageViewSet(viewsets.ModelViewSet):
    queryset = ProductionStage.objects.all().order_by('sequence_order')
    serializer_class = ProductionStageSerializer

class ProductionProcessViewSet(viewsets.ModelViewSet):
    queryset = ProductionProcess.objects.prefetch_related(
        'expected_inputs__item', 
        'expected_outputs__item', 
        'chemicals__item'
    ).select_related('stage').all()
    serializer_class = ProductionProcessSerializer
    search_fields = ['name', 'code', 'stage__name']
    filterset_fields = ['stage']
    ordering_fields = ['name', 'code', 'approximate_duration_hours']

class ProductionBatchViewSet(viewsets.ModelViewSet):
    queryset = ProductionBatch.objects.select_related('process', 'manager').all()
    serializer_class = ProductionBatchSerializer
    search_fields = ['batch_number', 'process__name', 'status']
    filterset_fields = ['status', 'process']
    ordering_fields = ['batch_number', 'start_date', 'status']
