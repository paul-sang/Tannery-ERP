from rest_framework import serializers
from .models import (
    ProductionStage, ProductionProcess, ProcessInput, ProcessOutput, ProcessChemical,
    ProductionBatch
)
from apps.inventory.serializers import ItemSerializer
from apps.inventory.models import Item


class ProductionStageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductionStage
        fields = '__all__'


# --- Recipe line serializers (read) ---

class ProcessInputSerializer(serializers.ModelSerializer):
    item_details = ItemSerializer(source='item', read_only=True)
    class Meta:
        model = ProcessInput
        fields = ['id', 'process', 'item', 'item_details', 'expected_percentage']

class ProcessOutputSerializer(serializers.ModelSerializer):
    item_details = ItemSerializer(source='item', read_only=True)
    class Meta:
        model = ProcessOutput
        fields = ['id', 'process', 'item', 'item_details', 'expected_yield_percentage']

class ProcessChemicalSerializer(serializers.ModelSerializer):
    item_details = ItemSerializer(source='item', read_only=True)
    class Meta:
        model = ProcessChemical
        fields = [
            'id', 'process', 'item', 'item_details', 'instruction', 'quantity_percentage',
            'sequence_order', 'ph_target', 'temperature_celsius', 'duration_minutes'
        ]


# --- Recipe line serializers (write — for nested create) ---

class ProcessInputWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProcessInput
        fields = ['item', 'expected_percentage']

class ProcessOutputWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProcessOutput
        fields = ['item', 'expected_yield_percentage']

class ProcessChemicalWriteSerializer(serializers.ModelSerializer):
    item = serializers.PrimaryKeyRelatedField(queryset=Item.objects.all(), allow_null=True, required=False)

    class Meta:
        model = ProcessChemical
        fields = ['item', 'instruction', 'quantity_percentage', 'sequence_order', 'ph_target', 'temperature_celsius', 'duration_minutes']


# --- Process serializers ---

class ProductionProcessReadSerializer(serializers.ModelSerializer):
    stage_name = serializers.CharField(source='stage.name', read_only=True)
    expected_inputs = ProcessInputSerializer(many=True, read_only=True)
    expected_outputs = ProcessOutputSerializer(many=True, read_only=True)
    chemicals = ProcessChemicalSerializer(many=True, read_only=True)

    class Meta:
        model = ProductionProcess
        fields = [
            'id', 'name', 'stage', 'stage_name', 'description', 'is_active',
            'expected_inputs', 'expected_outputs', 'chemicals'
        ]


class ProductionProcessWriteSerializer(serializers.ModelSerializer):
    expected_inputs = ProcessInputWriteSerializer(many=True, required=False)
    expected_outputs = ProcessOutputWriteSerializer(many=True, required=False)
    chemicals = ProcessChemicalWriteSerializer(many=True, required=False)

    class Meta:
        model = ProductionProcess
        fields = [
            'name', 'stage', 'description', 'is_active',
            'expected_inputs', 'expected_outputs', 'chemicals'
        ]

    def create(self, validated_data):
        inputs_data = validated_data.pop('expected_inputs', [])
        outputs_data = validated_data.pop('expected_outputs', [])
        chemicals_data = validated_data.pop('chemicals', [])

        process = ProductionProcess.objects.create(**validated_data)

        for inp in inputs_data:
            ProcessInput.objects.create(process=process, **inp)
        for out in outputs_data:
            ProcessOutput.objects.create(process=process, **out)
        for chem in chemicals_data:
            ProcessChemical.objects.create(process=process, **chem)

        return process

    def update(self, instance, validated_data):
        inputs_data = validated_data.pop('expected_inputs', None)
        outputs_data = validated_data.pop('expected_outputs', None)
        chemicals_data = validated_data.pop('chemicals', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Replace-all strategy for nested collections
        if inputs_data is not None:
            instance.expected_inputs.all().delete()
            for inp in inputs_data:
                ProcessInput.objects.create(process=instance, **inp)

        if outputs_data is not None:
            instance.expected_outputs.all().delete()
            for out in outputs_data:
                ProcessOutput.objects.create(process=instance, **out)

        if chemicals_data is not None:
            instance.chemicals.all().delete()
            for chem in chemicals_data:
                ProcessChemical.objects.create(process=instance, **chem)

        return instance


# --- Batch serializers ---

class ProductionBatchReadSerializer(serializers.ModelSerializer):
    process_name = serializers.CharField(source='process.name', read_only=True)
    stage_name = serializers.CharField(source='process.stage.name', read_only=True)
    manager_name = serializers.CharField(source='manager.username', read_only=True, default='')

    class Meta:
        model = ProductionBatch
        fields = [
            'id', 'batch_number', 'process', 'process_name', 'stage_name',
            'base_weight', 'quantity_hides',
            'start_date', 'end_date', 'status', 'manager', 'manager_name', 'notes'
        ]


class InitialLotSerializer(serializers.Serializer):
    lot_id = serializers.IntegerField()
    item_id = serializers.IntegerField()
    quantity = serializers.DecimalField(max_digits=12, decimal_places=2)


class ProductionBatchWriteSerializer(serializers.ModelSerializer):
    initial_lots = InitialLotSerializer(many=True, write_only=True, required=False)

    class Meta:
        model = ProductionBatch
        fields = ['id', 'batch_number', 'process', 'status', 'notes', 'base_weight', 'quantity_hides', 'initial_lots']
        read_only_fields = ['id', 'batch_number']

    def create(self, validated_data):
        from django.utils import timezone
        from django.db import transaction
        from apps.inventory.models import InventoryDocument, InventoryDocumentLine, StockLot, Item

        initial_lots = validated_data.pop('initial_lots', [])

        # Auto-generate batch number
        count = ProductionBatch.objects.count() + 1
        timestamp = timezone.now().strftime('%Y%m%d')
        batch_number = f"BATCH-{timestamp}-{count:04d}"

        validated_data['batch_number'] = batch_number

        # Assign current user as manager
        request = self.context.get('request')
        user = None
        if request and request.user:
            validated_data['manager'] = request.user
            user = request.user

        with transaction.atomic():
            batch = super().create(validated_data)
            
            if initial_lots and user:
                # Create PCN document for initial lots (hides)
                # Ensure unique doc number
                doc_count = InventoryDocument.objects.count() + 1
                doc_number = f"PCN-{timestamp}-{doc_count:04d}"
                doc = InventoryDocument.objects.create(
                    document_number=doc_number,
                    document_type=InventoryDocument.DocumentType.PRODUCTION_CONSUMPTION,
                    user=user,
                    production_batch=batch,
                    notes=f"Initial raw material consumption for Batch {batch_number}"
                )
                
                for lot_data in initial_lots:
                    item = Item.objects.get(id=lot_data['item_id'])
                    stock_lot = StockLot.objects.get(id=lot_data['lot_id'])
                    InventoryDocumentLine.objects.create(
                        document=doc,
                        item=item,
                        stock_lot=stock_lot,
                        movement_type=InventoryDocumentLine.MovementType.OUT,
                        quantity=lot_data['quantity']
                    )

        return batch
