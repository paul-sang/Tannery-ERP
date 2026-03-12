from rest_framework import serializers
from .models import (
    ProductionStage, ProductionProcess, ProcessInput, ProcessOutput, ProcessChemical,
    ProductionBatch, BatchInput, BatchOutput, BatchChemicalUsage
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

# --- ACTUAL BATCH EXECUTION SERIALIZERS ---
class BatchInputSerializer(serializers.ModelSerializer):
    lot_tracking_number = serializers.CharField(source='stock_lot.lot_tracking_number', read_only=True)
    item_name = serializers.CharField(source='stock_lot.item.name', read_only=True)
    class Meta:
        model = BatchInput
        fields = ['id', 'batch', 'stock_lot', 'lot_tracking_number', 'item_name', 'quantity_weight', 'hide_count']

class BatchOutputSerializer(serializers.ModelSerializer):
    item_details = ItemSerializer(source='item', read_only=True)
    class Meta:
        model = BatchOutput
        fields = ['id', 'batch', 'item', 'item_details', 'quantity', 'hide_count']

class BatchChemicalUsageSerializer(serializers.ModelSerializer):
    lot_tracking_number = serializers.CharField(source='stock_lot.lot_tracking_number', read_only=True)
    item_name = serializers.CharField(source='stock_lot.item.name', read_only=True)
    class Meta:
        model = BatchChemicalUsage
        fields = ['id', 'batch', 'stock_lot', 'lot_tracking_number', 'item_name', 'planned_quantity', 'actual_quantity']

class ProductionBatchSerializer(serializers.ModelSerializer):
    process_name = serializers.CharField(source='process.name', read_only=True)
    manager_name = serializers.CharField(source='manager.username', read_only=True)
    
    inputs = BatchInputSerializer(many=True, read_only=True)
    outputs = BatchOutputSerializer(many=True, read_only=True)
    chemical_usage = BatchChemicalUsageSerializer(many=True, read_only=True)

    class Meta:
        model = ProductionBatch
        fields = [
            'id', 'batch_number', 'process', 'process_name', 'start_date', 'end_date', 
            'status', 'manager', 'manager_name', 'inputs', 'outputs', 'chemical_usage'
        ]
