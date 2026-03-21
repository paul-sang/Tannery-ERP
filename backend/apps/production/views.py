from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import ProductionStage, ProductionProcess, ProductionBatch
from .serializers import (
    ProductionStageSerializer,
    ProductionProcessReadSerializer, ProductionProcessWriteSerializer,
    ProductionBatchReadSerializer, ProductionBatchWriteSerializer
)


class ProductionStageViewSet(viewsets.ModelViewSet):
    queryset = ProductionStage.objects.all().order_by('sequence_order')
    serializer_class = ProductionStageSerializer


class ProductionProcessViewSet(viewsets.ModelViewSet):
    queryset = ProductionProcess.objects.prefetch_related(
        'expected_inputs__item__uom', 'expected_inputs__item__category',
        'expected_outputs__item__uom', 'expected_outputs__item__category',
        'chemicals__item__uom', 'chemicals__item__category'
    ).select_related('stage').all()
    search_fields = ['name', 'stage__name']
    filterset_fields = ['stage', 'is_active']
    ordering_fields = ['name', 'stage__name', 'is_active']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return ProductionProcessWriteSerializer
        return ProductionProcessReadSerializer


class ProductionBatchViewSet(viewsets.ModelViewSet):
    queryset = ProductionBatch.objects.select_related(
        'process__stage', 'manager'
    ).all()
    search_fields = ['batch_number', 'process__name', 'status']
    filterset_fields = ['status', 'process', 'process__stage', 'manager']
    ordering_fields = ['batch_number', 'start_date', 'status']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return ProductionBatchWriteSerializer
        return ProductionBatchReadSerializer

    @action(detail=True, methods=['post'])
    def consume(self, request, pk=None):
        """Record material consumption for this batch via InventoryDocument."""
        batch = self.get_object()
        from apps.inventory.serializers import InventoryDocumentWriteSerializer

        data = request.data.copy()
        data['document_type'] = 'PCN'
        data['production_batch'] = batch.id

        # Force all lines to OUT (consumption)
        if 'lines' in data:
            for line in data['lines']:
                line['movement_type'] = 'OUT'

        serializer = InventoryDocumentWriteSerializer(data=data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        doc = serializer.save()

        return Response({
            'detail': f'Consumption document {doc.document_number} created.',
            'document_id': doc.id,
            'document_number': doc.document_number
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def produce(self, request, pk=None):
        """Record production output for this batch via InventoryDocument."""
        batch = self.get_object()
        from apps.inventory.serializers import InventoryDocumentWriteSerializer

        data = request.data.copy()
        data['document_type'] = 'POT'
        data['production_batch'] = batch.id

        # Force all lines to IN (output)
        if 'lines' in data:
            for line in data['lines']:
                line['movement_type'] = 'IN'

        serializer = InventoryDocumentWriteSerializer(data=data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        doc = serializer.save()

        return Response({
            'detail': f'Production output document {doc.document_number} created.',
            'document_id': doc.id,
            'document_number': doc.document_number
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def summary(self, request, pk=None):
        """Return full batch report: recipe, consumption docs, output docs."""
        batch = self.get_object()
        from apps.inventory.models import InventoryDocument
        from apps.inventory.serializers import InventoryDocumentReadSerializer

        # Get linked documents
        docs = InventoryDocument.objects.filter(production_batch=batch).prefetch_related(
            'lines__item', 'lines__stock_lot'
        ).order_by('date')

        consumption_docs = docs.filter(document_type='PCN')
        output_docs = docs.filter(document_type='POT')

        # Get recipe
        from .serializers import ProductionProcessReadSerializer
        recipe_data = ProductionProcessReadSerializer(batch.process).data

        return Response({
            'batch': ProductionBatchReadSerializer(batch).data,
            'recipe': recipe_data,
            'consumption_documents': InventoryDocumentReadSerializer(consumption_docs, many=True).data,
            'output_documents': InventoryDocumentReadSerializer(output_docs, many=True).data,
            'total_consumption_docs': consumption_docs.filter(status=InventoryDocument.Status.ACTIVE).count(),
            'total_output_docs': output_docs.filter(status=InventoryDocument.Status.ACTIVE).count()
        })

    @action(detail=True, methods=['patch'])
    def update_status(self, request, pk=None):
        """Update batch status with optional end_date on completion."""
        batch = self.get_object()
        new_status = request.data.get('status')
        revert_inventory = request.data.get('revert_inventory', False)

        if new_status not in dict(ProductionBatch.Status.choices):
            return Response({'detail': 'Invalid status.'}, status=status.HTTP_400_BAD_REQUEST)

        # Handle Reversal if CANCELLED
        if new_status == 'CANCELLED' and revert_inventory:
            from apps.inventory.models import InventoryDocument, StockMovement
            from django.db import transaction
            
            with transaction.atomic():
                docs = InventoryDocument.objects.filter(production_batch=batch, status=InventoryDocument.Status.ACTIVE)
                for doc in docs:
                    # Create reversing movements for each movement associated with this doc
                    movements = StockMovement.objects.filter(document_line__document=doc)
                    for sm in movements:
                        rev_type = StockMovement.MovementType.IN if sm.movement_type == StockMovement.MovementType.OUT else StockMovement.MovementType.OUT
                        StockMovement.objects.create(
                            item=sm.item,
                            stock_lot=sm.stock_lot,
                            document_line=sm.document_line,
                            movement_type=rev_type,
                            quantity=sm.quantity,
                            secondary_quantity=sm.secondary_quantity,
                            reference_document=f"REV-{sm.reference_document}",
                            user=request.user
                        )
                    doc.status = InventoryDocument.Status.VOIDED
                    doc.save(update_fields=['status'])

        batch.status = new_status
        if new_status in ['COMPLETED', 'CANCELLED']:
            from django.utils import timezone
            batch.end_date = timezone.now()

        batch.save()
        return Response(ProductionBatchReadSerializer(batch).data)
