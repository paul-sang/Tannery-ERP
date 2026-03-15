from rest_framework import serializers
from .models import (
    ProductionStage, ProductionProcess, ProcessInput, ProcessOutput, ProcessChemical,
    ProductionBatch
)
from apps.inventory.serializers import ItemSerializer


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
            'id', 'process', 'item', 'item_details', 'quantity_percentage',
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
    class Meta:
        model = ProcessChemical
        fields = ['item', 'quantity_percentage', 'sequence_order', 'ph_target', 'temperature_celsius', 'duration_minutes']


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
            'start_date', 'end_date', 'status', 'manager', 'manager_name', 'notes'
        ]


class ProductionBatchWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductionBatch
        fields = ['process', 'status', 'notes']

    def create(self, validated_data):
        from django.utils import timezone

        # Auto-generate batch number
        count = ProductionBatch.objects.count() + 1
        timestamp = timezone.now().strftime('%Y%m%d')
        batch_number = f"BATCH-{timestamp}-{count:04d}"

        validated_data['batch_number'] = batch_number

        # Assign current user as manager
        request = self.context.get('request')
        if request and request.user:
            validated_data['manager'] = request.user

        return super().create(validated_data)
