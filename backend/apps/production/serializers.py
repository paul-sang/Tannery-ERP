from rest_framework import serializers
from .models import Stage, ChemicalFormula, ProductionBatch

class StageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stage
        fields = '__all__'

class ChemicalFormulaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChemicalFormula
        fields = '__all__'

class ProductionBatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductionBatch
        fields = '__all__'
