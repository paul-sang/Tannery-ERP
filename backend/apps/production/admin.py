from django.contrib import admin
from .models import (
    ProductionStage, ProductionProcess, ProcessInput, ProcessOutput, 
    ProcessChemical, ProductionBatch
)

# Inline models for recipe definition
class ProcessInputInline(admin.TabularInline):
    model = ProcessInput
    extra = 1

class ProcessOutputInline(admin.TabularInline):
    model = ProcessOutput
    extra = 1

class ProcessChemicalInline(admin.TabularInline):
    model = ProcessChemical
    extra = 1

@admin.register(ProductionStage)
class ProductionStageAdmin(admin.ModelAdmin):
    list_display = ('sequence_order', 'name')
    ordering = ('sequence_order',)

@admin.register(ProductionProcess)
class ProductionProcessAdmin(admin.ModelAdmin):
    list_display = ('name', 'stage')
    inlines = [ProcessInputInline, ProcessOutputInline, ProcessChemicalInline]

@admin.register(ProductionBatch)
class ProductionBatchAdmin(admin.ModelAdmin):
    list_display = ('batch_number', 'process', 'status', 'start_date', 'manager')
    list_filter = ('status', 'process')
    search_fields = ('batch_number',)
    # NOTE: Batch inputs/outputs/chemicals are now tracked via InventoryDocument.
    # Related documents can be viewed from the InventoryDocument admin.
