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

# --- PROCESS RECIPE SERIALIZERS ---
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

class ProductionProcessSerializer(serializers.ModelSerializer):
    stage_name = serializers.CharField(source='stage.name', read_only=True)
    expected_inputs = ProcessInputSerializer(many=True, read_only=True)
    expected_outputs = ProcessOutputSerializer(many=True, read_only=True)
    chemicals = ProcessChemicalSerializer(many=True, read_only=True)

    class Meta:
        model = ProductionProcess
        fields = [
            'id', 'name', 'stage', 'stage_name', 'description', 
            'expected_inputs', 'expected_outputs', 'chemicals'
        ]

# --- BATCH EXECUTION SERIALIZER ---
# NOTE: Batch inputs/outputs/chemicals are now handled via InventoryDocument.
# Use the InventoryDocument API filtered by production_batch to retrieve
# consumption and output details for a given batch.
class ProductionBatchSerializer(serializers.ModelSerializer):
    process_name = serializers.CharField(source='process.name', read_only=True)
    manager_name = serializers.CharField(source='manager.username', read_only=True)

    class Meta:
        model = ProductionBatch
        fields = [
            'id', 'batch_number', 'process', 'process_name', 'start_date', 'end_date', 
            'status', 'manager', 'manager_name'
        ]
